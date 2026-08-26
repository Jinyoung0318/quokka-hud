/**
 * 궤도 진행 애니메이션.
 *
 * 궤도 위치는 실수이며 **증가만 한다**. 한 바퀴(PHASE_COUNT)를 돌면 감긴다.
 * 이 성질 하나로 두 규칙이 동시에 지켜진다.
 *
 *   - 값이 내려가면 (75 -> 50) 다음 단계로 순방향 진행
 *   - 값이 올라가면 (0 -> 75) 되감지 않고 남은 밤을 마저 지나 아침에 도착
 *
 * 목표를 정할 때 항상 "앞으로 얼마나 더 가야 하는가"만 계산하므로
 * 뒤로 가는 경로는 애초에 만들어지지 않는다.
 */

import { PHASE_COUNT } from "./skyState";

/**
 * 스냅값이 바뀌었을 때 새 위치까지 이동하는 데 걸리는 시간.
 * 5000~10000 사이에서 조정한다. 이동 거리와 무관하게 이 시간이 걸리므로
 * 리셋으로 한 바퀴를 도는 경우에도 같은 시간 안에 완주한다.
 */
export const CYCLE_TRANSITION_MS = 7000;

/**
 * 천체의 가감속이라 사인 곡선을 쓴다.
 * quad/cubic 보다 출발과 도착이 완만해서 7초짜리 긴 이동에 덜 튄다.
 */
function easeInOutSine(t: number): number {
  return (1 - Math.cos(Math.PI * t)) / 2;
}

export class CycleAnimator {
  /** 현재 궤도 위치. 단조 증가한다. */
  private position: number;
  private from: number;
  private to: number;
  private elapsed: number;
  private readonly duration: number;

  constructor(initialPhaseIndex: number, duration = CYCLE_TRANSITION_MS) {
    this.position = initialPhaseIndex;
    this.from = initialPhaseIndex;
    this.to = initialPhaseIndex;
    this.elapsed = duration;
    this.duration = duration;
  }

  get orbit(): number {
    return this.position;
  }

  get isMoving(): boolean {
    return this.elapsed < this.duration;
  }

  /**
   * 목표 단계를 정한다.
   *
   * 현재 위치에서 목표까지의 거리를 순방향으로만 잰다.
   * 이동 중에 불리면 지금 위치에서 새 목표로 이어서 진행한다.
   */
  setPhase(phaseIndex: number): void {
    const ahead = forwardDistance(this.position, phaseIndex);
    const target = this.position + ahead;

    // 이미 같은 목표로 가고 있으면 진행 중인 이동을 흔들지 않는다.
    if (Math.abs(target - this.to) < 1e-9) return;

    this.from = this.position;
    this.to = target;
    this.elapsed = 0;
  }

  advance(deltaMs: number): void {
    if (!this.isMoving) return;

    this.elapsed = Math.min(this.elapsed + deltaMs, this.duration);
    const t = this.duration === 0 ? 1 : this.elapsed / this.duration;
    this.position = this.from + (this.to - this.from) * easeInOutSine(t);
  }
}

/**
 * 현재 위치에서 목표 단계까지 순방향으로 가야 하는 거리.
 *
 * 이미 목표에 정확히 서 있으면 0, 그 외에는 항상 0보다 크고
 * PHASE_COUNT 이하다. 뒤로 가는 값은 나오지 않는다.
 */
function forwardDistance(position: number, phaseIndex: number): number {
  const diff = phaseIndex - position;
  return ((diff % PHASE_COUNT) + PHASE_COUNT) % PHASE_COUNT;
}
