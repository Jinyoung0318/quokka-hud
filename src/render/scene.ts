/**
 * 씬 조합. 그리는 순서가 곧 레이어 순서다.
 *
 * 씬은 잔여율을 모른다. 궤도 위치와 연출 하나만 받는다.
 * 잔여율 숫자는 캔버스가 아니라 그 위에 겹치는 HTML 이 맡는다
 * (overlay/readoutOverlay.ts).
 * 잎 개수와 물 높이도 연출이 정해서 넘겨주므로 여기서는 그리기만 한다.
 */

import { paletteAtOrbit } from "./palette";
import { drawGround, drawSky } from "./sky";
import { drawStars } from "./stars";
import { drawSunAndMoon } from "./sun";
import { drawGrass } from "./grass";
import { drawLeaf, drawTree } from "./tree";
import { drawPond } from "./pond";
import { drawSprite, type Sprite } from "./sprite";
import { HELD_LEAF_X, HELD_LEAF_Y, QUOKKA_Y, STATION_X } from "./layout";
import { quokkaIdle } from "../sprites/quokka";
import { HOME_AT, POND_AT, TREE_AT, type Choreography } from "../state/choreography";
import type { Frame } from "./loop";

export { QUOKKA_HOME_X, QUOKKA_Y, QUOKKA_FOOT_ROW } from "./layout";

export function drawScene(
  ctx: CanvasRenderingContext2D,
  orbit: number,
  choreography: Choreography,
  frame: Frame,
  quokka: Sprite = quokkaIdle,
): void {
  const palette = paletteAtOrbit(orbit);

  drawSky(ctx, palette);
  drawStars(ctx, orbit, frame);
  // 지평선 아래로 내려간 천체는 이어서 그려지는 땅이 덮는다.
  drawSunAndMoon(ctx, orbit, palette, frame);
  drawGround(ctx, palette);

  // 연못은 땅에 팬 자리라 땅 다음에 온다.
  drawPond(ctx, palette, choreography.water, frame);
  drawTree(ctx, palette, choreography.canopy, frame);
  drawGrass(ctx, palette, frame);

  // 쿼카는 맨 앞. 나무 앞에 서도 가려지지 않는다.
  // tick 을 그대로 넘기면 8fps 로 프레임이 순환한다.
  const quokkaX = quokkaXOf(choreography);
  drawSprite(ctx, quokka, quokkaX, QUOKKA_Y, frame.tick);

  // 뜯은 잎은 배 앞 가운데, 앞발 바로 위에 그린다.
  // 쿼카 좌표에 얹으므로 걸어가면 그대로 따라온다.
  if (choreography.heldLeaf) {
    drawLeaf(ctx, palette, quokkaX + HELD_LEAF_X, QUOKKA_Y + HELD_LEAF_Y);
  }
}

/**
 * 연출이 정한 지점 좌표를 화면 x 로 옮긴다.
 *
 * 지점 사이 간격이 고르지 않으므로(나무~가운데 16px, 가운데~연못 22px)
 * 구간마다 따로 보간한다.
 */
export function quokkaXOf(choreography: Choreography): number {
  const at = Math.max(TREE_AT, Math.min(POND_AT, choreography.position));

  if (at <= HOME_AT) {
    const t = (at - TREE_AT) / (HOME_AT - TREE_AT);
    return Math.round(STATION_X.tree + (STATION_X.home - STATION_X.tree) * t);
  }

  const t = (at - HOME_AT) / (POND_AT - HOME_AT);
  return Math.round(STATION_X.home + (STATION_X.pond - STATION_X.home) * t);
}
