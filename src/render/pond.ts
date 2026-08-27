/**
 * 화면 오른쪽의 연못.
 *
 * 땅에 팬 타원 웅덩이고, 물은 바닥에서부터 차오른다.
 * 수위는 소수를 받는다. 소비할 때는 한 칸이 즉시 내려가지만
 * 리셋할 때는 천천히 차오르므로 중간값이 들어온다.
 *
 * 반짝임 주기(14틱)는 풀 · 잎 · 해와 겹치지 않게 잡았다.
 */

import {
  POND_CENTER_X,
  POND_CENTER_Y,
  POND_RADIUS_X,
  POND_RADIUS_Y,
} from "./layout";
import { MAX_WATER } from "../state/choreography";
import type { ScenePalette } from "./palette";
import { fillRect } from "./pixel";
import type { Frame } from "./loop";

/** 8fps 기준 14틱 = 1.75초. */
const SHIMMER_PERIOD_TICKS = 14;

/** 수면에서 이 깊이까지는 밝은 물빛, 그 아래는 깊은 물빛. */
const SURFACE_DEPTH = 2;

export function drawPond(
  ctx: CanvasRenderingContext2D,
  palette: ScenePalette,
  waterLevel: number,
  frame: Frame,
): void {
  const bottomY = POND_CENTER_Y + POND_RADIUS_Y;
  const filled = clamp01(waterLevel / MAX_WATER);

  // 수면 높이. 가득 차면 웅덩이 맨 위, 비면 맨 아래에 걸린다.
  const surfaceY = bottomY - filled * (POND_RADIUS_Y * 2);

  for (let dy = -POND_RADIUS_Y; dy <= POND_RADIUS_Y; dy += 1) {
    const y = POND_CENTER_Y + dy;
    const halfWidth = rowHalfWidth(dy);
    if (halfWidth < 1) continue;

    // 마른 웅덩이 바닥. 물이 덮지 않은 부분은 이대로 남는다.
    fillRect(
      ctx,
      POND_CENTER_X - halfWidth,
      y,
      halfWidth * 2,
      1,
      palette.groundDeep,
    );

    if (y < surfaceY) continue;

    // 물은 가장자리를 한 칸 남기고 채워 웅덩이 턱이 보이게 한다.
    const waterHalf = Math.max(1, halfWidth - 1);
    const isSurface = y - surfaceY < SURFACE_DEPTH;

    fillRect(
      ctx,
      POND_CENTER_X - waterHalf,
      y,
      waterHalf * 2,
      1,
      isSurface ? palette.water : palette.waterDeep,
    );
  }

  drawShimmer(ctx, palette, surfaceY, frame);
}

/** 타원 한 줄의 반너비. */
function rowHalfWidth(dy: number): number {
  const ratio = 1 - (dy * dy) / (POND_RADIUS_Y * POND_RADIUS_Y);
  if (ratio <= 0) return 0;
  return Math.round(POND_RADIUS_X * Math.sqrt(ratio));
}

/** 수면에 반짝이는 점 두 개. 물이 살아 있다는 표시 정도만. */
function drawShimmer(
  ctx: CanvasRenderingContext2D,
  palette: ScenePalette,
  surfaceY: number,
  frame: Frame,
): void {
  const y = Math.ceil(surfaceY);
  const dy = y - POND_CENTER_Y;
  const halfWidth = rowHalfWidth(dy);
  if (halfWidth < 3) return;

  const phase = frame.tick % SHIMMER_PERIOD_TICKS;
  if (phase >= SHIMMER_PERIOD_TICKS / 2) return;

  const drift = phase < SHIMMER_PERIOD_TICKS / 4 ? 0 : 1;
  fillRect(ctx, POND_CENTER_X - halfWidth + 2 + drift, y, 2, 1, palette.sunCore);
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
