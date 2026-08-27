/**
 * 브라우저용 목 수집기.
 *
 * 브라우저에서는 프로세스를 띄울 수 없다. 폴링 루프와 화면 배선이
 * 제대로 돌아가는지 브라우저에서 확인할 수 있게 그럴듯한 값을 만들어 준다.
 *
 * 기본은 고정값이다. 흐르게 켜면 시간에 비례해 줄어들고, 0 아래로 내려가면
 * 100 으로 되감아서 리셋 연출까지 확인할 수 있다.
 *
 * 흐름을 켜고 끄는 것은 개발용 도구(src/dev/)가 한다. 여기서는 그럴 수 있는
 * 손잡이만 내놓는다. dev 폴더를 통째로 지워도 이 파일은 고정값 수집기로 남는다.
 */

import type { UsageSnapshot } from "../snapshot";
import type { UsageSource } from "./source";

/** 시작 잔여율. 흐름을 끄면 계속 이 값이다. */
export const MOCK_START_PCT = 100;

/**
 * 흐를 때 줄어드는 속도. 10초에 1%.
 * 100 에서 0 까지 약 16분이고 단계 경계는 4분마다 지난다.
 */
export const MOCK_DRAIN_PCT = 1;
export const MOCK_DRAIN_PERIOD_MS = 10_000;

/** 주간 잔여율은 훨씬 천천히 줄어야 그럴듯하다. */
const WEEKLY_DRAIN_RATIO = 0.2;

/** 5시간 창이라 리셋도 그만큼 뒤로 잡는다. */
const SESSION_WINDOW_MS = 5 * 60 * 60 * 1000;
const WEEKLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface MockUsageSource extends UsageSource {
  /**
   * 시간에 따라 줄어들게 할지 정한다.
   * 끄면 지금 값에서 멈추고, 켜면 켠 시점부터 다시 잰다.
   */
  setDraining(draining: boolean): void;
  /** 지금 잔여율. */
  readonly remainingPct: number;
}

export function createMockSource(startPct: number = MOCK_START_PCT): MockUsageSource {
  let remaining = clampPct(startPct);
  let weekly = clampPct(startPct);
  let draining = false;

  /** 마지막으로 값을 잰 시각. null 이면 다음 조회에서 기준만 잡는다. */
  let measuredAt: number | null = null;

  return {
    name: "mock",

    get remainingPct(): number {
      return remaining;
    },

    setDraining(next: boolean): void {
      if (next === draining) return;
      draining = next;
      // 켠 순간부터 다시 잰다. 꺼져 있던 시간이 한꺼번에 빠지면 곤란하다.
      measuredAt = null;
    },

    async fetch(now = new Date()): Promise<UsageSnapshot> {
      const at = now.getTime();

      if (draining && measuredAt !== null) {
        const steps = Math.max(0, at - measuredAt) / MOCK_DRAIN_PERIOD_MS;
        remaining -= steps * MOCK_DRAIN_PCT;
        weekly -= steps * MOCK_DRAIN_PCT * WEEKLY_DRAIN_RATIO;

        // 다 쓰면 되감는다. 리셋 연출을 보려면 값이 올라가는 순간이 필요하다.
        if (remaining < 0) {
          remaining = MOCK_START_PCT;
          weekly = MOCK_START_PCT;
        }
        if (weekly < 0) weekly = MOCK_START_PCT;
      }

      measuredAt = at;

      return {
        remainingPct: round1(clampPct(remaining)),
        weeklyRemainingPct: round1(clampPct(weekly)),
        resetAt: new Date(at + SESSION_WINDOW_MS).toISOString(),
        weeklyResetAt: new Date(at + WEEKLY_WINDOW_MS).toISOString(),
        model: null,
        fetchedAt: now.toISOString(),
        stale: false,
      };
    },
  };
}

function clampPct(value: number): number {
  return value < 0 ? 0 : value > 100 ? 100 : value;
}

/** 소수점이 길게 붙으면 개발 패널에서 읽기 나쁘다. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
