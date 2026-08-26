/**
 * 픽셀 단위 그리기 유틸.
 *
 * ctx.arc() 같은 path 렌더링은 imageSmoothingEnabled 와 무관하게
 * 가장자리가 안티앨리어싱된다. 4배로 확대하면 그 흐릿함이 그대로 보이므로
 * 도형도 1x1 사각형을 찍어서 만든다.
 */

import { rgbToCss, type Rgb } from "./palette";

export function fillPixel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: Rgb,
): void {
  ctx.fillStyle = rgbToCss(color);
  ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
}

export function fillRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: Rgb,
): void {
  ctx.fillStyle = rgbToCss(color);
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

/**
 * 픽셀 원. 반지름 보정(+r)을 더해야 계단이 덜 각지게 나온다.
 * 순수한 dx²+dy² <= r² 는 작은 반지름에서 마름모처럼 보인다.
 */
export function fillCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: Rgb,
): void {
  const centerX = Math.round(cx);
  const centerY = Math.round(cy);
  const r = Math.round(radius);
  const limit = r * r + r;

  ctx.fillStyle = rgbToCss(color);
  for (let dy = -r; dy <= r; dy += 1) {
    for (let dx = -r; dx <= r; dx += 1) {
      if (dx * dx + dy * dy <= limit) {
        ctx.fillRect(centerX + dx, centerY + dy, 1, 1);
      }
    }
  }
}

/**
 * 결정론적 난수. 별과 풀의 배치가 새로고침마다 달라지면
 * 같은 잔여율인데 화면이 달라 보이므로 시드를 고정한다.
 */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}
