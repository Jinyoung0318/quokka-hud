/**
 * 지평선에 심긴 풀. 끝이 살랑이는 정도의 움직임만 준다.
 *
 * 해의 진동(48틱)과 어긋나게 20틱 주기를 쓴다.
 * 주기가 같으면 화면 전체가 한 박자로 움직여서 부자연스럽다.
 */

import { HORIZON_Y, LOGICAL_SIZE } from "./canvas";
import type { ScenePalette } from "./palette";
import { createRandom, fillPixel } from "./pixel";
import type { Frame } from "./loop";

const GRASS_COUNT = 11;
const GRASS_SEED = 0x47_52_41_53;

/** 8fps 기준 20틱 = 2.5초에 한 번 좌우로 오간다. */
const SWAY_PERIOD_TICKS = 20;

interface Blade {
  x: number;
  height: number;
  phase: number;
}

const BLADES: readonly Blade[] = createBlades();

function createBlades(): Blade[] {
  const random = createRandom(GRASS_SEED);
  const blades: Blade[] = [];

  for (let i = 0; i < GRASS_COUNT; i += 1) {
    blades.push({
      x: Math.floor(random() * LOGICAL_SIZE),
      height: 2 + Math.floor(random() * 3),
      phase: Math.floor(random() * SWAY_PERIOD_TICKS),
    });
  }

  return blades;
}

export function drawGrass(
  ctx: CanvasRenderingContext2D,
  palette: ScenePalette,
  frame: Frame,
): void {
  for (const blade of BLADES) {
    const t = ((frame.tick + blade.phase) % SWAY_PERIOD_TICKS) / SWAY_PERIOD_TICKS;
    const sway = Math.round(Math.sin(t * Math.PI * 2));

    // 밑동은 땅에 박혀 있고 끝만 흔들린다.
    for (let i = 0; i < blade.height; i += 1) {
      const y = HORIZON_Y - 1 - i;
      const isTip = i === blade.height - 1;
      fillPixel(ctx, blade.x + (isTip ? sway : 0), y, palette.grass);
    }
  }
}
