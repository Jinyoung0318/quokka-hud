/**
 * 별. 밤에만 보이고 랜덤한 간격으로 깜빡인다.
 *
 * 별마다 깜빡임 주기가 다르므로 전체를 보면 불규칙하게 반짝이는데,
 * 각각은 결정론적이라 같은 궤도 위치면 언제 봐도 같은 하늘이다.
 */

import { HORIZON_Y, LOGICAL_SIZE } from "./canvas";
import { STAR, STAR_DIM } from "./palette";
import { clamp01, createRandom, fillPixel } from "./pixel";
import { PHASE_COUNT, wrapOrbit } from "../state/skyState";
import type { Frame } from "./loop";

const STAR_COUNT = 42;
const STAR_SEED = 0x51_4f_4b_41;

/** 별이 가장 밝은 궤도 위치. night 단계. */
const NIGHT_ORBIT = 3;
/** 이만큼 떨어지면 완전히 사라진다. 즉 dusk 와 morning 에서는 안 보인다. */
const FADE_DISTANCE = 1;

/** 별빛도 픽셀 아트답게 단계로 끊는다. */
const ALPHA_STEPS = 4;

/** 지평선 바로 위는 비워둔다. 달이 뜨고 지는 자리와 겹치면 지저분하다. */
const HORIZON_CLEARANCE = 8;

interface Star {
  x: number;
  y: number;
  /** 이 별이 한 번 깜빡이기까지 걸리는 tick 수. */
  period: number;
  /** 다른 별과 어긋나게 하는 오프셋. */
  phase: number;
  /** 꺼져 있는 tick 수. */
  blinkLength: number;
  /** 늘 밝은 별과 조금 흐린 별을 섞는다. */
  dim: boolean;
}

const STARS: readonly Star[] = createStars();

function createStars(): Star[] {
  const random = createRandom(STAR_SEED);
  const stars: Star[] = [];

  for (let i = 0; i < STAR_COUNT; i += 1) {
    stars.push({
      x: Math.floor(random() * LOGICAL_SIZE),
      y: Math.floor(random() * (HORIZON_Y - HORIZON_CLEARANCE)),
      // 24~88 tick = 3~11초. 별마다 제각각이라 규칙성이 눈에 띄지 않는다.
      period: 24 + Math.floor(random() * 64),
      phase: Math.floor(random() * 64),
      blinkLength: 1 + Math.floor(random() * 2),
      dim: random() < 0.4,
    });
  }

  return stars;
}

/** 궤도 위치가 밤에서 얼마나 떨어져 있는지. 감김을 고려한 최단 거리. */
function distanceFromNight(orbit: number): number {
  const raw = Math.abs(wrapOrbit(orbit) - NIGHT_ORBIT);
  return Math.min(raw, PHASE_COUNT - raw);
}

/** 궤도 위치에 따른 별빛 세기 0~1. */
function starVisibility(orbit: number): number {
  const raw = clamp01(1 - distanceFromNight(orbit) / FADE_DISTANCE);
  return Math.round(raw * ALPHA_STEPS) / ALPHA_STEPS;
}

export function drawStars(
  ctx: CanvasRenderingContext2D,
  orbit: number,
  frame: Frame,
): void {
  const visibility = starVisibility(orbit);
  if (visibility <= 0) return;

  const previousAlpha = ctx.globalAlpha;
  ctx.globalAlpha = visibility;

  for (const star of STARS) {
    // 주기 안에서 짧게 꺼진다. 대부분의 시간은 켜져 있다.
    const position = (frame.tick + star.phase) % star.period;
    if (position < star.blinkLength) continue;

    fillPixel(ctx, star.x, star.y, star.dim ? STAR_DIM : STAR);
  }

  ctx.globalAlpha = previousAlpha;
}
