/**
 * 씬 조합. 그리는 순서가 곧 레이어 순서다.
 *
 * 씬은 잔여율을 모른다. 궤도 위치와 연출 하나만 받는다.
 * 수관 크기와 물 높이도 연출이 정해서 넘겨주므로 여기서는 그리기만 한다.
 */

import { paletteAtOrbit } from "./palette";
import { drawGround, drawSky } from "./sky";
import { drawStars } from "./stars";
import { drawSunAndMoon } from "./sun";
import { drawGrass } from "./grass";
import { drawTree } from "./tree";
import { drawPond } from "./pond";
import { drawSprite, type Sprite } from "./sprite";
import { QUOKKA_Y, STATION_X } from "./layout";
import { quokkaIdle } from "../sprites/quokka";
import type { Choreography } from "../state/choreography";
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
  drawSprite(ctx, quokka, quokkaXOf(choreography), QUOKKA_Y, frame.tick);
}

/** 연출이 정한 지점을 화면 x 좌표로 옮긴다. */
export function quokkaXOf(choreography: Choreography): number {
  const from = STATION_X[choreography.from];
  const to = STATION_X[choreography.to];
  return Math.round(from + (to - from) * choreography.travel);
}
