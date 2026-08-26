/**
 * 잔여율을 네 개의 대표값으로 스냅한다.
 *
 * 화면은 원본 잔여율을 보지 않고 스냅값에서 유도된 궤도 위치만 본다.
 * 스냅이 경계 떨림을 막으므로 히스테리시스는 두지 않는다.
 */

export type SkyPhase = "morning" | "noon" | "dusk" | "night";

/** 한 바퀴를 이루는 단계 수. */
export const PHASE_COUNT = 4;

/**
 * 궤도 순서대로 놓은 단계 정의.
 * 인덱스가 곧 궤도 위치이므로 순서를 바꾸면 안 된다.
 */
export const PHASES: ReadonlyArray<{
  readonly phase: SkyPhase;
  /** 이 단계를 대표하는 잔여율. */
  readonly snapped: number;
  /** 이 값 이상이면 이 단계. 내림차순으로 검사한다. */
  readonly atLeast: number;
}> = [
  { phase: "morning", snapped: 75, atLeast: 62.5 },
  { phase: "noon", snapped: 50, atLeast: 37.5 },
  { phase: "dusk", snapped: 25, atLeast: 12.5 },
  { phase: "night", snapped: 0, atLeast: 0 },
];

/** 잔여율을 75 / 50 / 25 / 0 중 하나로 스냅한다. */
export function snapRemaining(remainingPct: number): number {
  return PHASES[phaseIndexOf(remainingPct)].snapped;
}

/** 잔여율이 속한 단계의 궤도 인덱스(0~3). */
export function phaseIndexOf(remainingPct: number): number {
  for (let i = 0; i < PHASES.length; i += 1) {
    if (remainingPct >= PHASES[i].atLeast) return i;
  }
  return PHASES.length - 1;
}

export function phaseOf(remainingPct: number): SkyPhase {
  return PHASES[phaseIndexOf(remainingPct)].phase;
}

/** 궤도 위치에 해당하는 단계 이름. 이동 중에는 출발한 단계를 가리킨다. */
export function phaseAtOrbit(orbit: number): SkyPhase {
  return PHASES[Math.floor(wrapOrbit(orbit)) % PHASE_COUNT].phase;
}

/** 궤도 위치를 0 이상 PHASE_COUNT 미만으로 감는다. */
export function wrapOrbit(orbit: number): number {
  return ((orbit % PHASE_COUNT) + PHASE_COUNT) % PHASE_COUNT;
}
