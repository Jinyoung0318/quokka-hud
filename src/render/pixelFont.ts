/**
 * 픽셀 폰트. 큰 것과 작은 것 두 벌.
 *
 * 85x85 캔버스에 글자를 넣어야 해서 웹폰트를 쓸 수 없다. ctx.fillText 는
 * 안티앨리어싱이 걸려 4배로 키우면 뭉개지고, 이만한 크기에서는 글자 모양이
 * 무너져 읽히지도 않는다. 그래서 필요한 글자만 픽셀로 직접 찍는다.
 *
 * 글자마다 폭이 다르다. i 나 : 까지 3칸을 잡으면 한 줄이 85px 를 넘는다.
 * 글자의 폭은 그 글자를 이루는 문자열의 길이다.
 *
 * 글자를 늘려야 하면 해당 폰트의 glyphs 에 같은 높이로 추가하면 된다.
 */

import { rgbToCss, type Rgb } from "./palette";

export interface PixelFont {
  /** 모든 글자가 같은 높이다. */
  readonly height: number;
  /** 글자 사이 간격. */
  readonly spacing: number;
  readonly glyphs: Readonly<Record<string, readonly string[]>>;
}

/**
 * 큰 폰트. 5칸 높이. 첫 줄에 쓴다.
 *
 * 대문자와 t 는 다섯 줄을 다 쓰고, 소문자는 윗줄을 비워 네 줄만 쓴다.
 */
const LARGE_GLYPHS: Readonly<Record<string, readonly string[]>> = {
  R: ["##.", "#.#", "##.", "#.#", "#.#"],
  a: ["...", "##.", ".##", "#.#", ".##"],
  e: ["...", ".##", "###", "#..", ".##"],
  i: ["#", ".", "#", "#", "#"],
  m: [".....", "#####", "#.#.#", "#.#.#", "#.#.#"],
  n: ["...", "##.", "#.#", "#.#", "#.#"],
  r: ["..", "##", "#.", "#.", "#."],
  t: [".#.", "###", ".#.", ".#.", ".##"],
  "0": ["###", "#.#", "#.#", "#.#", "###"],
  "1": [".#.", "##.", ".#.", ".#.", "###"],
  "2": ["###", "..#", "###", "#..", "###"],
  "3": ["###", "..#", ".##", "..#", "###"],
  "4": ["#.#", "#.#", "###", "..#", "..#"],
  "5": ["###", "#..", "###", "..#", "###"],
  "6": ["###", "#..", "###", "#.#", "###"],
  "7": ["###", "..#", ".#.", ".#.", ".#."],
  "8": ["###", "#.#", "###", "#.#", "###"],
  "9": ["###", "#.#", "###", "..#", "###"],
  "%": ["#.#", "..#", ".#.", "#..", "#.#"],
  " ": ["..", "..", "..", "..", ".."],
};

/**
 * 작은 폰트. 4칸 높이. 둘째 줄에 쓴다.
 *
 * 소문자도 네 줄을 다 쓴다. 세 줄로 줄이면 e 와 c 가 구분되지 않는다.
 */
const SMALL_GLYPHS: Readonly<Record<string, readonly string[]>> = {
  S: ["###", "#..", "..#", "###"],
  c: [".##", "#..", "#..", ".##"],
  e: [".##", "###", "#..", ".##"],
  i: ["#", ".", "#", "#"],
  m: ["#####", "#.#.#", "#.#.#", "#.#.#"],
  n: ["##.", "#.#", "#.#", "#.#"],
  t: [".#.", "###", ".#.", ".##"],
  y: ["#.#", "#.#", ".##", "##."],
  "0": ["###", "#.#", "#.#", "###"],
  "1": [".#.", "##.", ".#.", "###"],
  "2": ["###", "..#", "#..", "###"],
  "3": ["###", ".##", "..#", "###"],
  "4": ["#.#", "#.#", "###", "..#"],
  "5": ["###", "#..", "..#", "###"],
  "6": ["#..", "###", "#.#", "###"],
  "7": ["###", "..#", ".#.", ".#."],
  "8": ["###", "#.#", "###", "###"],
  "9": ["###", "#.#", "###", "..#"],
  ":": ["#", ".", "#", "."],
  "(": [".#", "#.", "#.", ".#"],
  ")": ["#.", ".#", ".#", "#."],
  " ": ["..", "..", "..", ".."],
};

export const LARGE_FONT: PixelFont = {
  height: 5,
  spacing: 1,
  glyphs: LARGE_GLYPHS,
};

export const SMALL_FONT: PixelFont = {
  height: 4,
  spacing: 1,
  glyphs: SMALL_GLYPHS,
};

/** 이 폰트로 그릴 수 없는 글자들. 없으면 빈 배열. */
export function missingGlyphs(font: PixelFont, text: string): string[] {
  const missing = new Set<string>();
  for (const character of text) {
    if (!(character in font.glyphs)) missing.add(character);
  }
  return [...missing];
}

/** 글자 사이 간격까지 넣은 가로 길이. */
export function textWidth(font: PixelFont, text: string): number {
  let width = 0;
  let count = 0;

  for (const character of text) {
    const glyph = font.glyphs[character] ?? font.glyphs[" "];
    width += glyph[0].length;
    count += 1;
  }

  return count === 0 ? 0 : width + (count - 1) * font.spacing;
}

/**
 * 글자를 찍고 **마지막 칸 바로 다음 x** 를 돌려준다.
 *
 * 뒤쪽 간격은 붙이지 않는다. 붙여서 돌려주면 textWidth() 로 잰 길이와
 * 실제로 그려진 길이가 한 칸씩 어긋난다. 이어 붙일 때 필요한 간격은
 * 부르는 쪽이 직접 더한다. 라벨은 흐리게, 숫자는 밝게 쓰는 것이 그 방식이다.
 *
 * outline 을 넘기면 글자 둘레를 한 칸 두른다. 하늘색도 땅색도 시간대에 따라
 * 바뀌기 때문에, 외곽선이 없으면 어느 배경에서는 반드시 묻힌다.
 *
 * 둘레는 글자 픽셀의 이웃 중 글자가 아닌 자리로 계산한다. 글자를 여덟 방향으로
 * 밀어 아홉 번 그리는 방식보다 칠하는 픽셀이 적고, 글자끼리 붙는 자리에
 * 외곽선이 끼어들지 않는다.
 */
export function drawPixelText(
  ctx: CanvasRenderingContext2D,
  font: PixelFont,
  text: string,
  x: number,
  y: number,
  fill: Rgb,
  outline: Rgb | null = null,
): number {
  const pixels: Array<readonly [number, number]> = [];
  const inked = new Set<string>();

  let cursorX = x;
  for (const character of text) {
    const glyph = font.glyphs[character] ?? font.glyphs[" "];

    for (let row = 0; row < font.height; row += 1) {
      const line = glyph[row];
      for (let column = 0; column < line.length; column += 1) {
        if (line[column] !== "#") continue;
        const px = cursorX + column;
        const py = y + row;
        pixels.push([px, py]);
        inked.add(keyOf(px, py));
      }
    }

    cursorX += glyph[0].length + font.spacing;
  }

  if (outline !== null) {
    const drawn = new Set<string>();
    ctx.fillStyle = rgbToCss(outline);

    for (const [px, py] of pixels) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = px + dx;
          const ny = py + dy;
          const key = keyOf(nx, ny);
          if (inked.has(key) || drawn.has(key)) continue;
          drawn.add(key);
          ctx.fillRect(nx, ny, 1, 1);
        }
      }
    }
  }

  ctx.fillStyle = rgbToCss(fill);
  for (const [px, py] of pixels) {
    ctx.fillRect(px, py, 1, 1);
  }

  // 마지막 글자 뒤에 붙은 간격은 빼고 돌려준다.
  return text.length === 0 ? x : cursorX - font.spacing;
}

function keyOf(x: number, y: number): string {
  return `${x},${y}`;
}
