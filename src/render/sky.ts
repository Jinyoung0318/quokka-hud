/** 하늘과 땅. 씬에서 가장 먼저 그려지는 배경. */

import { HORIZON_Y, LOGICAL_SIZE } from "./canvas";
import { lerpRgb, type ScenePalette } from "./palette";
import { fillRect } from "./pixel";

/**
 * 하늘 그라디언트를 몇 단으로 끊을지.
 * 픽셀마다 색을 바꾸면 픽셀 아트가 아니라 그냥 그라디언트가 된다.
 */
const SKY_BANDS = 6;

/** 땅도 두 단으로 나눠 아래쪽을 어둡게 해 깊이를 준다. */
const GROUND_BANDS = 2;

export function drawSky(
  ctx: CanvasRenderingContext2D,
  palette: ScenePalette,
): void {
  for (let band = 0; band < SKY_BANDS; band += 1) {
    const top = Math.round((HORIZON_Y * band) / SKY_BANDS);
    const bottom = Math.round((HORIZON_Y * (band + 1)) / SKY_BANDS);
    const t = (band + 0.5) / SKY_BANDS;

    fillRect(
      ctx,
      0,
      top,
      LOGICAL_SIZE,
      bottom - top,
      lerpRgb(palette.skyZenith, palette.skyHorizon, t),
    );
  }
}

export function drawGround(
  ctx: CanvasRenderingContext2D,
  palette: ScenePalette,
): void {
  const groundHeight = LOGICAL_SIZE - HORIZON_Y;

  for (let band = 0; band < GROUND_BANDS; band += 1) {
    const top = HORIZON_Y + Math.round((groundHeight * band) / GROUND_BANDS);
    const bottom =
      HORIZON_Y + Math.round((groundHeight * (band + 1)) / GROUND_BANDS);
    const t = band / Math.max(1, GROUND_BANDS - 1);

    fillRect(
      ctx,
      0,
      top,
      LOGICAL_SIZE,
      bottom - top,
      lerpRgb(palette.ground, palette.groundDeep, t),
    );
  }
}
