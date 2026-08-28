/**
 * 사용량 폴링.
 *
 * 앱이 뜨면 곧바로 한 번 조회하고, 그다음부터 주기적으로 돈다.
 *
 * 조회나 파싱이 실패해도 멈추지 않는다. 마지막 성공 값을 그대로 들고
 * stale 만 세워서 내보낸다. 캐릭터가 멈추면 고장난 것처럼 보인다.
 *
 * 연속으로 실패하면 주기를 늘린다. 고른 주기에 비례해 물러나고,
 * 한 번이라도 성공하면 곧바로 원래 주기로 돌아온다.
 */

import type { UsageSnapshot } from "../snapshot";
import type { UsageFailure, UsageFetchResult, UsageSource } from "./source";
import { DEFAULT_POLL_MINUTES, pollIntervalMs } from "../pollInterval";

/** 주기를 넘겨주지 않았을 때 쓰는 값. 고를 수 있는 주기는 pollInterval.ts 에 있다. */
export const POLL_INTERVAL_MS = pollIntervalMs(DEFAULT_POLL_MINUTES);

/**
 * 연속 실패 시 주기를 몇 배로 늘릴지. 실패가 쌓이면 뒤쪽 값을 쓰고 마지막에서 멈춘다.
 *
 * 고정된 분이 아니라 배수인 것은 주기를 고를 수 있게 되었기 때문이다.
 * 10분 고정으로 두면 1분 주기에서는 열 배로 뛰고 5분 주기에서는 두 배에
 * 그친다. 같은 실패에 물러나는 정도가 주기마다 달라질 이유가 없다.
 *
 *   1분 -> 5 · 10 · 15분      2분 -> 10 · 20 · 30분      5분 -> 25 · 30 · 30분
 */
export const BACKOFF_MULTIPLIERS: readonly number[] = [5, 10, 15];

/**
 * 아무리 물러나도 이보다 길게 기다리지 않는다.
 *
 * 없으면 5분 주기가 15배까지 가서 75분이 된다. 그동안 화면은 stale 인 채로
 * 멈춰 있는데, 리셋이 지나가도 한 시간 넘게 모른다.
 */
export const BACKOFF_CAP_MS = 30 * 60 * 1000;

export interface UsagePollerOptions {
  source: UsageSource;
  /**
   * 새 값이 나올 때마다 불린다.
   *
   * 실패했을 때도 불린다. 그때는 직전 값에 stale 만 세운 것이 넘어온다.
   * 성공한 적이 한 번도 없으면 실패해도 부르지 않는다. 내보낼 값이 없다.
   */
  onSnapshot: (snapshot: UsageSnapshot) => void;
  /**
   * 조회에 실패할 때마다 불린다.
   *
   * everSucceeded 는 이 앱이 뜬 뒤로 한 번이라도 값을 받아본 적이 있는지다.
   * 없으면 화면에 띄울 것이 아무것도 없어서 안내를 보여줘야 하고, 있으면
   * 마지막 값을 stale 로 유지하면 된다. 부르는 쪽에서 이걸 다시 세게 하면
   * 폴러와 두 벌로 갈린다.
   */
  onFailure?: (failure: UsageFailure, everSucceeded: boolean) => void;
  /** 테스트에서 시계를 넘기기 위한 자리. */
  now?: () => Date;
  /**
   * 성공한 뒤 다음 조회까지 기다리는 시간.
   *
   * 예약할 때마다 물어보므로 도중에 바뀌어도 다음 회차부터 반영된다.
   * 넘기지 않으면 POLL_INTERVAL_MS 를 쓴다.
   */
  intervalMs?: () => number;
}

export interface UsagePollerHandle {
  stop(): void;
  /**
   * 예약된 시각을 기다리지 않고 지금 한 번 조회한다.
   *
   * 주기를 바꾼 직후에 부르면 새 주기가 곧바로 걸린다. 이미 조회 중이면
   * 아무것도 하지 않는다. 그 조회가 끝나면서 어차피 다시 예약된다.
   */
  pollNow(): void;
}

/** 폴링을 시작한다. */
export function startUsagePolling(options: UsagePollerOptions): UsagePollerHandle {
  const now = options.now ?? (() => new Date());
  const intervalMs = options.intervalMs ?? (() => POLL_INTERVAL_MS);

  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = true;
  let inFlight = false;
  let failures = 0;
  let last: UsageSnapshot | null = null;
  /** 이 앱이 뜬 뒤로 한 번이라도 값을 받아봤는가. */
  let everSucceeded = false;

  const schedule = (delayMs: number) => {
    if (!running) return;
    timer = setTimeout(() => {
      void tick();
    }, delayMs);
  };

  const tick = async (): Promise<void> => {
    if (!running || inFlight) return;
    inFlight = true;

    let result: UsageFetchResult;
    try {
      result = await options.source.fetch(now());
    } catch (error) {
      // 수집기는 실패를 값으로 돌려주기로 했지만, 그래도 여기서 막는다.
      // 폴링이 예외로 끊기면 캐릭터가 멈춘다.
      const message = error instanceof Error ? error.message : String(error);
      console.warn("[collector] 조회 중 예외 ·", message);
      result = { ok: false, failure: { kind: "unknown", message } };
    } finally {
      inFlight = false;
    }

    if (!running) return;

    if (result.ok) {
      failures = 0;
      last = result.snapshot;
      everSucceeded = true;
      options.onSnapshot(result.snapshot);
      schedule(intervalMs());
      return;
    }

    failures += 1;

    // 마지막 값을 유지하고 stale 만 세운다.
    if (last !== null) {
      last = { ...last, stale: true };
      options.onSnapshot(last);
    }

    // 원인을 그대로 넘긴다. 한 번도 성공한 적이 없으면 화면에 띄울 값이
    // 없어서, 여기서 알려주지 않으면 실패가 아무 흔적도 남기지 않는다.
    options.onFailure?.(result.failure, everSucceeded);

    schedule(backoffFor(failures, intervalMs()));
  };

  // 앱이 뜨자마자 한 번. 주기를 기다리지 않는다.
  void tick();

  return {
    stop() {
      running = false;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    },

    pollNow() {
      if (!running || inFlight) return;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      void tick();
    },
  };
}

/**
 * 연속 실패 횟수에 해당하는 주기. 마지막 배수에서 더 늘어나지 않고,
 * 상한을 넘지도 않는다.
 */
export function backoffFor(failures: number, baseMs: number = POLL_INTERVAL_MS): number {
  if (failures < 1) return baseMs;
  const index = Math.min(failures - 1, BACKOFF_MULTIPLIERS.length - 1);
  return Math.min(baseMs * BACKOFF_MULTIPLIERS[index], BACKOFF_CAP_MS);
}
