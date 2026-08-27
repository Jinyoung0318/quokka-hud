/**
 * 화면 왼쪽의 유칼립투스.
 *
 * 잎을 낱장으로 세지 않는다. 겹친 덩어리들이 하나의 수관을 이루고,
 * 잔여율에 따라 그 수관이 통째로 커지고 작아진다. 정확한 잔여량은
 * 연못 수위가 네 칸으로 보여주므로 나무는 분위기만 맡는다.
 *
 * 수관이 줄어드는 방식은 두 가지가 겹친다.
 *   - 바깥쪽 덩어리부터 빠진다 (CANOPY_BLOBS 의 from)
 *   - 남은 덩어리도 반지름과 간격이 함께 줄어든다
 * 그래서 아침에는 우거지고 밤에는 앙상해진다.
 *
 * 잎이 흔들리는 주기(28틱)는 풀(20틱), 해(48틱)와 어긋나게 잡았다.
 * 같은 박자로 움직이면 화면 전체가 한 덩어리로 출렁인다.
 */

import {
  BRANCHES,
  CANOPY_BLOBS,
  CANOPY_CENTER_X,
  CANOPY_CENTER_Y,
  TRUNK_BASE_Y,
  TRUNK_FLARE_Y,
  TRUNK_TOP_Y,
  TRUNK_WIDTH,
  TRUNK_X,
} from "./layout";
import type { ScenePalette } from "./palette";
import { fillCircle, fillPixel, fillRect } from "./pixel";
import type { Frame } from "./loop";

/** 8fps 기준 28틱 = 3.5초에 한 번 좌우로 오간다. */
const SWAY_PERIOD_TICKS = 28;

/** 빛을 받는 면을 왼쪽 위로 잡는다. */
const LIT_OFFSET_X = -1;
const LIT_OFFSET_Y = -1;

export function drawTree(
  ctx: CanvasRenderingContext2D,
  palette: ScenePalette,
  canopy: number,
  frame: Frame,
): void {
  drawTrunk(ctx, palette);
  drawCanopy(ctx, palette, canopy, frame);
}

function drawTrunk(ctx: CanvasRenderingContext2D, palette: ScenePalette): void {
  fillRect(
    ctx,
    TRUNK_X,
    TRUNK_TOP_Y,
    TRUNK_WIDTH,
    TRUNK_BASE_Y - TRUNK_TOP_Y,
    palette.trunk,
  );

  // 밑동만 한 칸씩 넓혀 땅에 박힌 것처럼 보이게 한다.
  fillRect(
    ctx,
    TRUNK_X - 1,
    TRUNK_FLARE_Y,
    TRUNK_WIDTH + 2,
    TRUNK_BASE_Y - TRUNK_FLARE_Y,
    palette.trunk,
  );

  for (const branch of BRANCHES) {
    for (const [x, y] of branch) {
      fillPixel(ctx, x, y, palette.trunk);
    }
  }
}

function drawCanopy(
  ctx: CanvasRenderingContext2D,
  palette: ScenePalette,
  canopy: number,
  frame: Frame,
): void {
  const level = clamp01(canopy);

  // 수관 전체가 한 몸으로 아주 조금 흔들린다.
  const t = (frame.tick % SWAY_PERIOD_TICKS) / SWAY_PERIOD_TICKS;
  const sway = Math.round(Math.sin(t * Math.PI * 2));

  const visible = CANOPY_BLOBS.filter((blob) => level >= blob.from);

  // 그늘을 먼저 깔고 그 위에 빛 받는 면을 조금 밀어서 얹는다.
  // 덩어리마다 따로 칠하면 경계가 드러나므로 층으로 나눠 두 번 돈다.
  for (const blob of visible) {
    const { x, y, r } = placeBlob(blob, level, sway);
    fillCircle(ctx, x, y, r, palette.leafDeep);
  }

  for (const blob of visible) {
    const { x, y, r } = placeBlob(blob, level, sway);
    fillCircle(ctx, x + LIT_OFFSET_X, y + LIT_OFFSET_Y, r - 1, palette.leaf);
  }
}

function placeBlob(
  blob: { dx: number; dy: number; r: number },
  level: number,
  sway: number,
) {
  // 간격은 반지름보다 덜 줄여야 덩어리가 뭉치지 않고 형태를 유지한다.
  const spread = 0.6 + 0.4 * level;
  const size = 0.45 + 0.55 * level;

  return {
    x: CANOPY_CENTER_X + Math.round(blob.dx * spread) + sway,
    y: CANOPY_CENTER_Y + Math.round(blob.dy * spread),
    r: Math.max(2, Math.round(blob.r * size)),
  };
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
