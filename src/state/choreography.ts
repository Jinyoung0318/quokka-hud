/**
 * 전환 연출.
 *
 * 잔여율이 한 단계 내려가면 쿼카가 나무로 걸어가 잎을 한 장 뜯어먹고,
 * 연못으로 가서 물을 마신 뒤 가운데로 돌아온다. 순서가 곧 인과라서
 * 잎을 먹기 전에 물을 마시면 안 된다. 타임라인 상수의 순서가 그 규칙이다.
 *
 * 값이 올라가면(리셋) 쿼카는 가운데서 반응만 하고, 잎이 다시 돋고
 * 연못에 물이 차오른다.
 *
 * 전환 도중에 값이 또 바뀌면 처음부터 다시 하지 않는다. 해가 지금 궤도
 * 위치를 이어받듯 쿼카도 지금 자리와 동작을 이어받는다. resumePoint() 가
 * 새 타임라인의 어느 지점부터 시작할지 정하고, 그 지점의 위치가 지금
 * 서 있는 자리와 같아지도록 origin 을 넘긴다. 그래서 순간이동이 없다.
 *
 * 이 파일은 화면 좌표를 모른다. 지점을 수직선 위의 값으로만 다루고
 * 실제 픽셀 위치는 render/layout.ts 가 정한다.
 */

import { PHASE_COUNT } from "./skyState";

/** 쿼카가 서는 지점. */
export type Station = "tree" | "home" | "pond";

/**
 * 지점을 수직선 위에 늘어놓은 값.
 *
 * 이동을 "어디서 어디로"가 아니라 이 값 하나로 다루면, 구간 한가운데서
 * 새 연출로 갈아타도 지금 자리를 그대로 넘겨줄 수 있다.
 */
export const TREE_AT = 0;
export const HOME_AT = 1;
export const POND_AT = 2;

export const STATION_AT: Readonly<Record<Station, number>> = {
  tree: TREE_AT,
  home: HOME_AT,
  pond: POND_AT,
};

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
  /** 지점 좌표. 0 나무, 1 가운데, 2 연못. 사이 값은 이동 중이라는 뜻이다. */
  position: number;
  /** 왼쪽으로 가면 -1, 오른쪽이면 1. 걷는 스프라이트를 붙일 때 쓴다. */
  facing: -1 | 1;
  action: QuokkaAction;
  /** 수관 크기 0~1. 1 이 가장 풍성하다. */
  canopy: number;
  /** 그릴 물 높이. 차오르는 중에는 소수가 나온다. */
  water: number;
  /** 앞발에 뜯은 잎을 들고 있는가. 나무에서 연못까지만 참이다. */
  heldLeaf: boolean;
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

/** 잎이 사라지는 순간과 수위가 내려가는 순간. 각 동작의 한가운데. */
const BITE_AT = (WALK_TO_TREE_END + EAT_END) / 2;
const SIP_AT = (WALK_TO_POND_END + DRINK_END) / 2;

/**
 * 리셋 연출의 구간. 잎이 먼저 돋고 물이 뒤따라 차오른다.
 * 조금 겹쳐야 화면이 비는 구간 없이 이어진다.
 */
const REGROW_FROM = 0.15;
const REGROW_TO = 0.6;
const REFILL_FROM = 0.35;
const REFILL_TO = 0.9;

/**
 * 리셋일 때 가운데로 돌아오는 구간.
 * 이미 가운데에 있으면 지나가기만 한다.
 */
const RETURN_END = 0.15;

// ---------------------------------------------------------------- 계산

function ramp(value: number, from: number, to: number): number {
  if (to <= from) return 1;
  if (value <= from) return 0;
  if (value >= to) return 1;
  return (value - from) / (to - from);
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

// ---------------------------------------------------------------- 이어받기

/** 새 전환을 어디서부터 시작할지. */
export interface ResumePoint {
  /** 새 타임라인에서 시작할 진행도. */
  startAt: number;
  /** 그 지점에서의 위치. 지금 서 있는 자리와 같아야 순간이동이 없다. */
  origin: number;
}

/**
 * 진행 중이던 연출에서 새 소비 연출로 갈아탈 지점을 고른다.
 *
 * 지금 무엇을 하고 있었는지에 따라 앞 구간을 건너뛴다.
 *   - 먹는 중이면        -> 먹기부터
 *   - 잎을 들고 있으면    -> 들고 연못으로 가는 구간부터 (지금 자리에서)
 *   - 마시는 중이면      -> 마시기부터
 *   - 그 밖에(이동 중 등) -> 지금 자리에서 나무로 걸어가는 구간부터
 *
 * 마지막 경우에는 남은 거리에 맞춰 시작 진행도를 당긴다. 그래야 코앞에서
 * 다시 시작해도 한 구간을 통째로 쓰며 기어가지 않는다.
 */
export function resumePoint(current: Choreography): ResumePoint {
  if (current.action === "eating") {
    return { startAt: WALK_TO_TREE_END, origin: TREE_AT };
  }

  if (current.heldLeaf) {
    const travelled = clamp((current.position - TREE_AT) / (POND_AT - TREE_AT), 0, 1);
    return {
      startAt: lerp(EAT_END, WALK_TO_POND_END, travelled),
      origin: TREE_AT,
    };
  }

  if (current.action === "drinking") {
    return { startAt: WALK_TO_POND_END, origin: POND_AT };
  }

  // 나무까지 남은 거리. 한 구간이 감당하는 거리는 가운데~나무다.
  const remaining = clamp(
    Math.abs(current.position - TREE_AT) / Math.abs(HOME_AT - TREE_AT),
    0,
    1,
  );

  return {
    startAt: WALK_TO_TREE_END * (1 - remaining),
    origin: current.position,
  };
}

/** 리셋으로 갈아탈 때. 지금 자리에서 가운데로 돌아온 뒤 반응한다. */
export function resetResumePoint(current: Choreography): ResumePoint {
  return { startAt: 0, origin: current.position };
}

// ---------------------------------------------------------------- 연출

export interface TransitionPlan {
  /** 이 진행도부터 시작한다. 처음부터면 0. */
  startAt: number;
  /** startAt 시점의 위치. */
  origin: number;
  startCanopy: number;
  startWater: number;
  targetCanopy: number;
  targetWater: number;
}

/** 아무 일도 없을 때. 가운데 서서 idle. */
export function resting(canopy: number, water: number): Choreography {
  return {
    position: HOME_AT,
    facing: 1,
    action: "idle",
    canopy,
    water,
    heldLeaf: false,
  };
}

/**
 * 소비 전환. 나무 -> 잎 -> 연못 -> 물 -> 복귀.
 *
 * 잎을 뜯는 순간 수관이 줄면서 동시에 앞발에 잎이 생기고, 그 잎은
 * 연못에서 물을 마시기 시작할 때 사라진다. 뜯은 잎을 들고 가는 셈이라
 * 나무와 연못이 한 동작으로 이어진다.
 *
 * plan.startAt 이 0 보다 크면 그 앞 구간은 이미 끝난 것으로 친다.
 * 첫 걷기 구간만 plan.origin 에서 출발하므로 어디서 갈아타도 이어진다.
 */
export function consuming(plan: TransitionPlan, progress: number): Choreography {
  // 수관은 뜯는 순간 한 번에 줄어야 잎이 떨어져 나온 것으로 보인다.
  const canopy = progress >= BITE_AT ? plan.targetCanopy : plan.startCanopy;
  const water = progress >= SIP_AT ? plan.targetWater : plan.startWater;

  // 뜯은 순간부터 물을 마시기 시작할 때까지 들고 있다.
  const heldLeaf = progress >= BITE_AT && progress < WALK_TO_POND_END;
  const rest = { canopy, water, heldLeaf };

  if (progress < WALK_TO_TREE_END) {
    const travel = ramp(progress, plan.startAt, WALK_TO_TREE_END);
    return {
      position: lerp(plan.origin, TREE_AT, travel),
      facing: plan.origin > TREE_AT ? -1 : 1,
      action: "walking",
      ...rest,
    };
  }

  if (progress < EAT_END) {
    return { position: TREE_AT, facing: 1, action: "eating", ...rest };
  }

  if (progress < WALK_TO_POND_END) {
    return {
      position: lerp(TREE_AT, POND_AT, ramp(progress, EAT_END, WALK_TO_POND_END)),
      facing: 1,
      action: "walking",
      ...rest,
    };
  }

  if (progress < DRINK_END) {
    return { position: POND_AT, facing: 1, action: "drinking", ...rest };
  }

  return {
    position: lerp(POND_AT, HOME_AT, ramp(progress, DRINK_END, 1)),
    facing: -1,
    action: "walking",
    ...rest,
  };
}

/**
 * 리셋 전환. 수관과 물이 돌아온다.
 *
 * 쿼카는 가운데서 반응만 하는 것이 기본이지만, 갈아타는 순간 다른 자리에
 * 있었다면 먼저 걸어서 돌아온다. 그래야 순간이동이 없다.
 *
 * 수관도 물도 소수를 그대로 넘긴다. 뜯어먹을 때와 달리 서서히
 * 우거지고 차오르는 것이 보여야 한다.
 */
export function resetting(plan: TransitionPlan, progress: number): Choreography {
  const grown = ramp(progress, REGROW_FROM, REGROW_TO);
  const filled = ramp(progress, REFILL_FROM, REFILL_TO);

  const away = Math.abs(plan.origin - HOME_AT) > 1e-6;
  const returning = away && progress < RETURN_END;

  return {
    position: lerp(plan.origin, HOME_AT, ramp(progress, plan.startAt, RETURN_END)),
    facing: plan.origin > HOME_AT ? -1 : 1,
    action: returning ? "walking" : "reacting",
    canopy: lerp(plan.startCanopy, plan.targetCanopy, grown),
    water: lerp(plan.startWater, plan.targetWater, filled),
    heldLeaf: false,
  };
}
