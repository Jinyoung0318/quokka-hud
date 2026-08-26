/**
 * 씬 조합. 그리는 순서가 곧 레이어 순서다.
 *
 * 씬은 잔여율을 모른다. 궤도 위치 하나만 받는다.
 */

import { HORIZON_Y, LOGICAL_SIZE } from "./canvas";
import { paletteAtOrbit } from "./palette";
import { drawGround, drawSky } from "./sky";
import { drawStars } from "./stars";
import { drawSunAndMoon } from "./sun";
import { drawGrass } from "./grass";
import { drawSprite, type Sprite } from "./sprite";
import { QUOKKA_SIZE, quokkaIdle } from "../sprites/quokka";
import type { Frame } from "./loop";

/** 캐릭터 위치. 가로는 화면 가운데. */
export const QUOKKA_X = Math.floor((LOGICAL_SIZE - QUOKKA_SIZE) / 2);

/**
 * 세로는 바닥이 지평선에 닿는 높이.
 * 앉은 자세라 스프라이트 맨 아랫줄이 바닥선이다.
 */
export const QUOKKA_FOOT_ROW = QUOKKA_SIZE - 1;
export const QUOKKA_Y = HORIZON_Y - QUOKKA_FOOT_ROW;

export function drawScene(
  ctx: CanvasRenderingContext2D,
  orbit: number,
  frame: Frame,
  quokka: Sprite = quokkaIdle,
): void {
  const palette = paletteAtOrbit(orbit);

  drawSky(ctx, palette);
  drawStars(ctx, orbit, frame);
  // 지평선 아래로 내려간 천체는 이어서 그려지는 땅이 덮는다.
  drawSunAndMoon(ctx, orbit, palette, frame);
  drawGround(ctx, palette);
  drawGrass(ctx, palette, frame);

  // tick 을 그대로 넘기면 8fps 로 프레임이 순환한다.
  drawSprite(ctx, quokka, QUOKKA_X, QUOKKA_Y, frame.tick);
}
