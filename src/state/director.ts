/**
 * 씬 진행 담당.
 *
 * 궤도(해와 하늘)와 연출(쿼카 · 잎 · 물)을 한 시계로 굴린다.
 * 둘 다 CycleAnimator 하나를 보므로 전환 시간이 저절로 같아진다.
 *
 * 전환 도중에 값이 또 바뀌어도 둘 다 "지금 상태"를 이어받는다.
 * 궤도는 현재 위치에서 다음 목표로 이어가고, 연출은 resumePoint() 가
 * 고른 지점부터 시작한다. 한쪽만 0 부터 다시 시작하면 그쪽만 되감겨서
 * 쿼카가 순간이동한다.
 *
 * 소비냐 리셋이냐는 수관 크기를 비교해서 가른다. 단계별 수관이
 * 1 > 0.74 > 0.5 > 0.3 으로 단조 감소하므로, 목표가 지금보다 크다는 것은
 * 잔여율이 올라갔다는 뜻이다. 궤도 거리로는 이걸 구분할 수 없다.
 * (밤 -> 아침도, 아침 -> 낮도 궤도로는 똑같이 한 칸 전진이다.)
 */

import { CycleAnimator } from "./cycle";
import {
  CANOPY_LEVEL,
  HOME_AT,
  WATER_LEVEL,
  consuming,
  resetResumePoint,
  resetting,
  resting,
  resumePoint,
  type Choreography,
  type TransitionPlan,
} from "./choreography";

export class SceneDirector {
  private readonly cycle: CycleAnimator;

  private targetPhaseIndex: number;

  /** 진행 중인 전환의 계획. 멈춰 있으면 null. */
  private plan: TransitionPlan | null = null;
  private consumingNow = false;

  private canopy: number;
  private water: number;

  constructor(initialPhaseIndex: number) {
    this.cycle = new CycleAnimator(initialPhaseIndex);
    this.targetPhaseIndex = initialPhaseIndex;
    this.canopy = CANOPY_LEVEL[initialPhaseIndex];
    this.water = WATER_LEVEL[initialPhaseIndex];
  }

  get orbit(): number {
    return this.cycle.orbit;
  }

  get isMoving(): boolean {
    return this.cycle.isMoving;
  }

  /** 지금 프레임에 그릴 연출. */
  get choreography(): Choreography {
    if (!this.cycle.isMoving || !this.plan) {
      return resting(this.canopy, this.water);
    }

    const plan = this.plan;
    // 남은 구간을 전환 시간에 맞춰 늘려 쓴다. 이어받아 시작 지점이 뒤에 있어도
    // 해와 같은 시각에 끝나고, 전체가 한 번의 전환 시간을 넘지 않는다.
    const progress = plan.startAt + (1 - plan.startAt) * this.cycle.progress;

    return this.consumingNow ? consuming(plan, progress) : resetting(plan, progress);
  }

  /**
   * 새 단계를 목표로 잡는다.
   *
   * 전환 도중에 불리면 지금 화면에 보이는 자리 · 동작 · 수관 · 물에서
   * 이어간다. 그래야 쿼카가 되감기지 않고 잎이 되돌아나지 않는다.
   */
  setPhase(phaseIndex: number): void {
    if (phaseIndex === this.targetPhaseIndex) return;

    const current = this.choreography;
    const targetCanopy = CANOPY_LEVEL[phaseIndex];
    const targetWater = WATER_LEVEL[phaseIndex];
    const consume = targetCanopy < current.canopy;

    const resume = consume ? resumePoint(current) : resetResumePoint(current);

    this.plan = {
      startAt: resume.startAt,
      origin: resume.origin,
      startCanopy: current.canopy,
      startWater: current.water,
      targetCanopy,
      targetWater,
    };
    this.consumingNow = consume;

    this.targetPhaseIndex = phaseIndex;
    this.canopy = targetCanopy;
    this.water = targetWater;

    this.cycle.setPhase(phaseIndex);
  }

  advance(deltaMs: number): void {
    const wasMoving = this.cycle.isMoving;
    this.cycle.advance(deltaMs);

    // 전환이 끝나면 계획을 버리고 가운데 선 상태로 돌아간다.
    if (wasMoving && !this.cycle.isMoving) {
      this.plan = null;
    }
  }
}

/** 가운데 지점. 연출이 끝나면 늘 여기 서 있다. */
export { HOME_AT };
