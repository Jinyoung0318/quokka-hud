/**
 * 해와 달. 서로 완전히 별개인 궤도를 돈다.
 *
 * 해는 한 바퀴 전체에 걸친 하나의 연속 원 궤도다. 밤에는 지평선 아래로
 * 내려가 보이지 않을 뿐, 좌표가 튀는 지점이 없다.
 *
 * 달은 자기 궤도의 중심이 지평선 **아래**에 있어서, 밤 구간에서만
 * 지평선 위로 올라온다. 궤도가 감기는 지점에서 달은 지평선 아래에 숨어
 * 있으므로 감김이 화면에 드러나지 않는다.
 */

import { HORIZON_Y, LOGICAL_SIZE } from "./canvas";
import { MOON, MOON_CORE, MOON_CRATER, type ScenePalette } from "./palette";
import { fillCircle, fillPixel } from "./pixel";
import { PHASE_COUNT, wrapOrbit } from "../state/skyState";
import type { Frame } from "./loop";

const SUN_RADIUS = 6;
const SUN_CORE_RADIUS = 4;
const MOON_RADIUS = 5;
const MOON_CORE_RADIUS = 3;

const CENTER_X = Math.floor(LOGICAL_SIZE / 2);

/**
 * 해의 궤도.
 * 중심이 지평선보다 조금 위에 있어서 아침(궤도 0)에 해가 낮게 떠 있고,
 * 밤(궤도 3)에는 화면 밖까지 내려간다.
 */
const SUN_CENTER_Y = HORIZON_Y - 6;
const SUN_RADIUS_X = 30;
const SUN_RADIUS_Y = 50;

/**
 * 달의 궤도.
 * 중심이 지평선 아래에 있어서 밤 구간에서만 위로 올라온다.
 * 해보다 낮게 뜨고 폭도 좁아 다른 궤도라는 게 드러난다.
 */
const MOON_CENTER_Y = HORIZON_Y + 8;
const MOON_RADIUS_X = 28;
const MOON_RADIUS_Y = 40;

/** 달이 지평선 위로 올라오는 궤도 구간의 시작점(= dusk). */
const MOON_RISE_ORBIT = 2;
/** 달이 한 번 뜨고 지는 데 걸리는 궤도 거리. */
const MOON_SPAN = 2;

/**
 * 해의 아주 느린 상하 진동.
 * 8fps tick 기준 48틱(=6초)에 한 번 오르내린다. 진폭은 1픽셀.
 * 풀(20틱)과 주기를 달리해 화면이 한 박자로 움직이지 않게 한다.
 */
const BOB_PERIOD_TICKS = 48;
const BOB_AMPLITUDE = 1;

function bob(tick: number): number {
  const phase = (tick % BOB_PERIOD_TICKS) / BOB_PERIOD_TICKS;
  return Math.round(Math.sin(phase * Math.PI * 2) * BOB_AMPLITUDE);
}

/** 궤도 위치를 해의 좌표로. 한 바퀴가 원 하나에 대응한다. */
export function sunPositionAt(orbit: number): { x: number; y: number } {
  const angle = (wrapOrbit(orbit) / PHASE_COUNT) * Math.PI * 2;
  return {
    x: CENTER_X - SUN_RADIUS_X * Math.cos(angle),
    y: SUN_CENTER_Y - SUN_RADIUS_Y * Math.sin(angle),
  };
}

/** 궤도 위치를 달의 좌표로. 밤 구간 밖에서는 지평선 아래 값이 나온다. */
export function moonPositionAt(orbit: number): { x: number; y: number } {
  const progress = (wrapOrbit(orbit) - MOON_RISE_ORBIT) / MOON_SPAN;
  const angle = progress * Math.PI;
  return {
    x: CENTER_X - MOON_RADIUS_X * Math.cos(angle),
    y: MOON_CENTER_Y - MOON_RADIUS_Y * Math.sin(angle),
  };
}

export function drawSunAndMoon(
  ctx: CanvasRenderingContext2D,
  orbit: number,
  palette: ScenePalette,
  frame: Frame,
): void {
  const offset = bob(frame.tick);

  // 둘 다 그린다. 지평선 아래로 내려간 쪽은 나중에 그려지는 땅이 덮는다.
  const moon = moonPositionAt(orbit);
  fillCircle(ctx, moon.x, moon.y + offset, MOON_RADIUS, MOON);
  fillCircle(ctx, moon.x, moon.y + offset, MOON_CORE_RADIUS, MOON_CORE);
  drawCraters(ctx, moon.x, moon.y + offset);

  const sun = sunPositionAt(orbit);
  fillCircle(ctx, sun.x, sun.y + offset, SUN_RADIUS, palette.sun);
  fillCircle(ctx, sun.x, sun.y + offset, SUN_CORE_RADIUS, palette.sunCore);
}

/** 달이 그냥 흰 원으로 보이지 않게 하는 정도의 점 세 개. */
function drawCraters(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  fillPixel(ctx, x - 2, y - 1, MOON_CRATER);
  fillPixel(ctx, x + 1, y + 2, MOON_CRATER);
  fillPixel(ctx, x + 2, y - 2, MOON_CRATER);
}
