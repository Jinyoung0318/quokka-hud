/**
 * 사용량 폴링.
 *
 * 앱이 뜨면 곧바로 한 번 조회하고, 그다음부터 주기적으로 돈다.
 *
 * 조회나 파싱이 실패해도 멈추지 않는다. 마지막 성공 값을 그대로 들고
 * stale 만 세워서 내보낸다. 캐릭터가 멈추면 고장난 것처럼 보인다.
 *
 * 연속으로 실패하면 주기를 늘린다. 429 를 부르지 않기 위한 것이고,
 * 한 번이라도 성공하면 곧바로 기본 주기로 돌아온다.
 */

import type { UsageSnapshot } from "../snapshot";
import type { UsageSource } from "./source";

/** 기본 주기. 이보다 짧게 하지 않는다. */
export const POLL_INTERVAL_MS = 5 * 60 * 1000;

/**
 * 연속 실패 시의 주기. 실패가 쌓이면 뒤쪽 값을 쓰고 마지막에서 멈춘다.
 * 10분 -> 20분 -> 30분(상한).
 */
export const BACKOFF_INTERVALS_MS: readonly number[] = [
  10 * 60 * 1000,
  20 * 60 * 1000,
  30 * 60 * 1000,
];

export interface UsagePollerOptions {
  source: UsageSource;
  /**
   * 새 값이 나올 때마다 불린다.
   *
   * 실패했을 때도 불린다. 그때는 직전 값에 stale 만 세운 것이 넘어온다.
   * 성공한 적이 한 번도 없으면 실패해도 부르지 않는다. 내보낼 값이 없다.
   */
  onSnapshot: (snapshot: UsageSnapshot) => void;
  /** 테스트에서 시계를 넘기기 위한 자리. */
  now?: () => Date;
}

/** 폴링을 시작하고 멈추는 함수를 돌려준다. */
export function startUsagePolling(options: UsagePollerOptions): () => void {
  const now = options.now ?? (() => new Date());

  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = true;
  let inFlight = false;
  let failures = 0;
  let last: UsageSnapshot | null = null;

  const schedule = (delayMs: number) => {
    if (!running) return;
    timer = setTimeout(() => {
      void tick();
    }, delayMs);
  };

  const tick = async (): Promise<void> => {
    if (!running || inFlight) return;
    inFlight = true;

    let snapshot: UsageSnapshot | null = null;
    try {
      snapshot = await options.source.fetch(now());
    } catch (error) {
      // 수집기는 실패를 null 로 돌려주기로 했지만, 그래도 여기서 막는다.
      // 폴링이 예외로 끊기면 캐릭터가 멈춘다.
      console.warn("[collector] 조회 중 예외 ·", error);
      snapshot = null;
    } finally {
      inFlight = false;
    }

    if (!running) return;

    if (snapshot !== null) {
      failures = 0;
      last = snapshot;
      options.onSnapshot(snapshot);
      schedule(POLL_INTERVAL_MS);
      return;
    }

    failures += 1;

    // 마지막 값을 유지하고 stale 만 세운다.
    if (last !== null) {
      last = { ...last, stale: true };
      options.onSnapshot(last);
    }

    schedule(backoffFor(failures));
  };

  // 앱이 뜨자마자 한 번. 주기를 기다리지 않는다.
  void tick();

  return () => {
    running = false;
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };
}

/** 연속 실패 횟수에 해당하는 주기. 마지막 값에서 더 늘어나지 않는다. */
export function backoffFor(failures: number): number {
  if (failures < 1) return POLL_INTERVAL_MS;
  const index = Math.min(failures - 1, BACKOFF_INTERVALS_MS.length - 1);
  return BACKOFF_INTERVALS_MS[index];
}
