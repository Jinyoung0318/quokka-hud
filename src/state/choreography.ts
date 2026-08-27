/**
 * 전환 연출.
 *
 * 잔여율이 한 단계 내려가면 쿼카가 나무로 걸어가 잎을 뜯어먹고,
 * 연못으로 가서 물을 마신 뒤 가운데로 돌아온다. 순서가 곧 인과라서
 * 잎을 먹기 전에 물을 마시면 안 된다. 타임라인 상수의 순서가 그 규칙이다.
 *
 * 값이 올라가면(리셋) 쿼카는 가운데서 반응만 하고, 수관이 다시 우거지고
 * 연못에 물이 차오른다.
 *
 * 이 파일은 좌표를 모른다. "어느 지점에 있는가"만 정하고 화면 위치는
 * render/layout.ts 가 정한다.
 */

import { PHASE_COUNT } from "./skyState";

/** 쿼카가 서는 지점. */
export type Station = "tree" | "home" | "pond";

export type QuokkaAction = "idle" | "walking" | "eating" | "drinking" | "reacting";

/** 물의 최대치. 아침(스냅값 75)의 값이다. */
export const MAX_WATER = 4;

/**
 * 단계별 수관 크기와 물 높이. 인덱스는 궤도 단계와 같다.
 * (0 morning, 1 noon, 2 dusk, 3 night)
 *
 * 정확한 잔여량은 연못 수위가 네 칸으로 보여준다. 나무는 분위기 담당이라
 * 개수를 세게 하지 않고 수관 전체가 커지고 작아지기만 한다.
 *
 * 밤에도 0 으로 만들지 않는다. 0 이면 리셋할 때 수관이 통째로
 * 솟아나 부자연스럽다.
 */
export const CANOPY_LEVEL: readonly number[] = [1, 0.74, 0.5, 0.3];
export const WATER_LEVEL: readonly number[] = [4, 3, 2, 1];

if (CANOPY_LEVEL.length !== PHASE_COUNT || WATER_LEVEL.length !== PHASE_COUNT) {
  throw new Error("수관/물 정의가 단계 수와 맞지 않습니다");
}

export interface Choreography {
  /** 출발 지점. 서 있을 때는 to 와 같다. */
  from: Station;
  /** 도착 지점. */
  to: Station;
  /** from 에서 to 까지의 진행도 0~1. 서 있으면 1. */
  travel: number;
  action: QuokkaAction;
  /** 수관 크기 0~1. 1 이 가장 풍성하다. */
  canopy: number;
  /** 그릴 물 높이. 차오르는 중에는 소수가 나온다. */
  water: number;
}

// ---------------------------------------------------------------- 타임라인

/**
 * 소비 전환의 구간 경계(0~1). 순서를 바꾸면 연출이 깨진다.
 *
 *   0.00 ~ 0.20  가운데 -> 나무
 *   0.20 ~ 0.34  잎을 뜯어먹는다
 *   0.34 ~ 0.58  나무 -> 연못
 *   0.58 ~ 0.72  물을 마신다
 *   0.72 ~ 1.00  연못 -> 가운데
 */
const WALK_TO_TREE_END = 0.2;
const EAT_END = 0.34;
const WALK_TO_POND_END = 0.58;
const DRINK_END = 0.72;

/** 수관이 줄어드는 순간과 수위가 내려가는 순간. 각 동작의 한가운데. */
const BITE_AT = (WALK_TO_TREE_END + EAT_END) / 2;
const SIP_AT = (WALK_TO_POND_END + DRINK_END) / 2;

/**
 * 리셋 연출의 구간. 수관이 먼저 우거지고 물이 뒤따라 차오른다.
 * 조금 겹쳐야 화면이 비는 구간 없이 이어진다.
 */
const REGROW_FROM = 0.15;
const REGROW_TO = 0.6;
const REFILL_FROM = 0.35;
const REFILL_TO = 0.9;

// ---------------------------------------------------------------- 계산

function ramp(value: number, from: number, to: number): number {
  if (value <= from) return 0;
  if (value >= to) return 1;
  return (value - from) / (to - from);
}

function segment(value: number, from: number, to: number): number {
  return ramp(value, from, to);
}

/** 아무 일도 없을 때. 가운데 서서 idle. */
export function resting(canopy: number, water: number): Choreography {
  return {
    from: "home",
    to: "home",
    travel: 1,
    action: "idle",
    canopy,
    water,
  };
}

/**
 * 소비 전환. 나무 -> 잎 -> 연못 -> 물 -> 복귀.
 *
 * 한 번에 두 단계를 건너뛰면(75 -> 25) 수관과 물이 한 번에 두 칸만큼
 * 줄어든다. 동작은 그대로 한 번씩만 한다.
 */
export function consuming(
  progress: number,
  startCanopy: number,
  startWater: number,
  targetCanopy: number,
  targetWater: number,
): Choreography {
  // 수관은 뜯는 순간 한 번에 줄어야 잎이 떨어져 나온 것으로 보인다.
  const canopy = progress >= BITE_AT ? targetCanopy : startCanopy;
  const water = progress >= SIP_AT ? targetWater : startWater;

  if (progress < WALK_TO_TREE_END) {
    return {
      from: "home",
      to: "tree",
      travel: segment(progress, 0, WALK_TO_TREE_END),
      action: "walking",
      canopy,
      water,
    };
  }

  if (progress < EAT_END) {
    return { from: "tree", to: "tree", travel: 1, action: "eating", canopy, water };
  }

  if (progress < WALK_TO_POND_END) {
    return {
      from: "tree",
      to: "pond",
      travel: segment(progress, EAT_END, WALK_TO_POND_END),
      action: "walking",
      canopy,
      water,
    };
  }

  if (progress < DRINK_END) {
    return { from: "pond", to: "pond", travel: 1, action: "drinking", canopy, water };
  }

  return {
    from: "pond",
    to: "home",
    travel: segment(progress, DRINK_END, 1),
    action: "walking",
    canopy,
    water,
  };
}

/**
 * 리셋 전환. 쿼카는 가운데서 반응만 하고 수관과 물이 돌아온다.
 *
 * 수관도 물도 소수를 그대로 넘긴다. 뜯어먹을 때와 달리 서서히
 * 우거지고 차오르는 것이 보여야 한다.
 */
export function resetting(
  progress: number,
  startCanopy: number,
  startWater: number,
  targetCanopy: number,
  targetWater: number,
): Choreography {
  const grown = ramp(progress, REGROW_FROM, REGROW_TO);
  const filled = ramp(progress, REFILL_FROM, REFILL_TO);

  return {
    from: "home",
    to: "home",
    travel: 1,
    action: "reacting",
    canopy: startCanopy + (targetCanopy - startCanopy) * grown,
    water: startWater + (targetWater - startWater) * filled,
  };
}

/** 왼쪽으로 가면 -1, 오른쪽이면 1. 걷는 스프라이트를 붙일 때 쓴다. */
export function facingOf(choreography: Choreography): -1 | 1 {
  const order: Record<Station, number> = { tree: 0, home: 1, pond: 2 };
  const delta = order[choreography.to] - order[choreography.from];
  return delta < 0 ? -1 : 1;
}
