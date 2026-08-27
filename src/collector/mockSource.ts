/**
 * 브라우저용 목 수집기.
 *
 * 브라우저에서는 프로세스를 띄울 수 없다. 폴링 루프와 화면 배선이
 * 제대로 돌아가는지 브라우저에서 확인할 수 있게 그럴듯한 값을 만들어 준다.
 *
 * 아주 천천히 줄어들게 해뒀다. 값이 고정이면 폴링이 도는지 알 수 없고,
 * 빨리 줄면 개발용 슬라이더로 확인하는 데 방해가 된다.
 */

import type { UsageSnapshot } from "../snapshot";
import type { UsageSource } from "./source";

/** 분당 줄어드는 양. 한 시간이면 아침에서 해질녘까지 간다. */
const DRAIN_PCT_PER_MINUTE = 1;
const WEEKLY_DRAIN_PCT_PER_MINUTE = 0.2;

/** 5시간 창이라 리셋도 그만큼 뒤로 잡는다. */
const SESSION_WINDOW_MS = 5 * 60 * 60 * 1000;
const WEEKLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function createMockSource(startedAt: number = Date.now()): UsageSource {
  return {
    name: "mock",

    async fetch(now = new Date()): Promise<UsageSnapshot> {
      const minutes = Math.max(0, (now.getTime() - startedAt) / 60_000);

      return {
        remainingPct: clampPct(100 - minutes * DRAIN_PCT_PER_MINUTE),
        weeklyRemainingPct: clampPct(100 - minutes * WEEKLY_DRAIN_PCT_PER_MINUTE),
        resetAt: new Date(startedAt + SESSION_WINDOW_MS).toISOString(),
        weeklyResetAt: new Date(startedAt + WEEKLY_WINDOW_MS).toISOString(),
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
