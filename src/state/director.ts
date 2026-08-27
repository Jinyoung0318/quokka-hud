/**
 * 씬 진행 담당.
 *
 * 궤도(해와 하늘)와 연출(쿼카 · 수관 · 물)을 한 시계로 굴린다.
 * 둘 다 CycleAnimator 하나를 보므로 전환 시간이 저절로 같아진다.
 *
 * 소비냐 리셋이냐는 수관 크기를 비교해서 가른다. 단계별 수관이
 * 1 > 0.74 > 0.5 > 0.3 으로 단조 감소하므로, 목표가 지금보다 크다는 것은
 * 잔여율이 올라갔다는 뜻이다. 궤도 거리로는 이걸 구분할 수 없다.
 * (밤 -> 아침도, 아침 -> 낮도 궤도로는 똑같이 한 칸 전진이다.)
 */

import { CycleAnimator } from "./cycle";
import {
  CANOPY_LEVEL,
  WATER_LEVEL,
  consuming,
  resetting,
  resting,
  type Choreography,
} from "./choreography";

export class SceneDirector {
  private readonly cycle: CycleAnimator;

  private targetPhaseIndex: number;

  /** 전환이 시작될 때 화면에 보이던 값. 여기서 목표까지 간다. */
  private startCanopy: number;
  private startWater: number;
  private targetCanopy: number;
  private targetWater: number;

  constructor(initialPhaseIndex: number) {
    this.cycle = new CycleAnimator(initialPhaseIndex);
    this.targetPhaseIndex = initialPhaseIndex;
    this.startCanopy = this.targetCanopy = CANOPY_LEVEL[initialPhaseIndex];
    this.startWater = this.targetWater = WATER_LEVEL[initialPhaseIndex];
  }

  get orbit(): number {
    return this.cycle.orbit;
  }

  get isMoving(): boolean {
    return this.cycle.isMoving;
  }

  /** 지금 프레임에 그릴 연출. */
  get choreography(): Choreography {
    if (!this.cycle.isMoving) {
      return resting(this.targetCanopy, this.targetWater);
    }

    const progress = this.cycle.progress;
    const args = [
      progress,
      this.startCanopy,
      this.startWater,
      this.targetCanopy,
      this.targetWater,
    ] as const;

    return this.targetCanopy < this.startCanopy ? consuming(...args) : resetting(...args);
  }

  /**
   * 새 단계를 목표로 잡는다.
   *
   * 전환 도중에 불리면 지금 화면에 보이는 수관과 물에서 이어간다.
   * 그래야 잎이 되돌아났다가 다시 사라지는 일이 없다.
   */
  setPhase(phaseIndex: number): void {
    if (phaseIndex === this.targetPhaseIndex) return;

    const current = this.choreography;
    this.startCanopy = current.canopy;
    this.startWater = current.water;

    this.targetPhaseIndex = phaseIndex;
    this.targetCanopy = CANOPY_LEVEL[phaseIndex];
    this.targetWater = WATER_LEVEL[phaseIndex];

    this.cycle.setPhase(phaseIndex);
  }

  advance(deltaMs: number): void {
    this.cycle.advance(deltaMs);
  }
}
