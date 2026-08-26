/**
 * 스프라이트 엔진.
 *
 * 엔진은 스프라이트가 어떻게 만들어졌는지 모른다. Sprite 인터페이스만 본다.
 * 지금은 문자 배열로 정의하지만, 나중에 PNG 스프라이트 시트를 쓰게 되면
 * 같은 인터페이스를 구현하는 createImageSprite() 를 추가하면 되고
 * drawSprite() 와 이 함수를 부르는 쪽은 손대지 않는다.
 */

import { rgbToCss, type Rgb } from "./palette";

export interface Sprite {
  readonly width: number;
  readonly height: number;
  readonly frameCount: number;
  /**
   * 실제 그리기. 직접 부르지 말고 drawSprite() 를 통해 부른다.
   * frameIndex 는 이미 범위 안으로 정리된 값이 넘어온다.
   */
  drawFrame(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    frameIndex: number,
    scale: number,
  ): void;
}

/**
 * 스프라이트를 그린다.
 *
 * frameIndex 는 범위를 벗어나도 된다. 8fps tick 을 그대로 넘기면
 * 프레임 수에 맞춰 알아서 순환한다.
 *
 * scale 은 개발용 확대에 쓴다. 기본값이 1 이라 기존 호출부는 그대로 동작한다.
 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: Sprite,
  x: number,
  y: number,
  frameIndex: number,
  scale = 1,
): void {
  const count = sprite.frameCount;
  if (count <= 0) return;

  const index = ((Math.floor(frameIndex) % count) + count) % count;
  sprite.drawFrame(ctx, Math.round(x), Math.round(y), index, scale);
}

/** 투명으로 취급할 문자. */
const TRANSPARENT = new Set([".", " "]);

export interface PixelSpriteDefinition {
  /** 프레임마다 한 줄에 한 행씩. 모든 프레임의 크기가 같아야 한다. */
  readonly frames: readonly (readonly string[])[];
  /** 문자 하나가 색 하나. 여기 없는 문자와 "." " " 는 투명. */
  readonly palette: Readonly<Record<string, Rgb>>;
}

export interface ImageSpriteDefinition {
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly yOffsets: readonly number[];
}

/** 비동기 이미지가 준비되기 전에는 그리지 않는 스프라이트. */
export function createImageSprite(definition: ImageSpriteDefinition): Sprite {
  const image = new Image();
  let loaded = false;

  image.addEventListener("load", () => {
    loaded = true;
  });
  image.src = definition.src;

  return {
    width: definition.width,
    height: definition.height,
    frameCount: definition.yOffsets.length,
    drawFrame(ctx, x, y, frameIndex, scale) {
      if (!loaded) return;

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        image,
        x,
        y + definition.yOffsets[frameIndex] * scale,
        definition.width * scale,
        definition.height * scale,
      );
    },
  };
}

/** 같은 색 픽셀을 묶어둔 것. 프레임마다 fillStyle 을 색 수만큼만 바꾼다. */
interface ColorRun {
  readonly style: string;
  readonly pixels: readonly (readonly [number, number])[];
}

/**
 * 문자 배열로 스프라이트를 만든다.
 *
 * 문자 해석은 만들 때 한 번만 한다. 그리는 시점에는 좌표만 훑는다.
 */
export function createPixelSprite(definition: PixelSpriteDefinition): Sprite {
  const { frames, palette } = definition;

  if (frames.length === 0) {
    throw new Error("스프라이트에 프레임이 없습니다");
  }

  const height = frames[0].length;
  const width = frames[0][0]?.length ?? 0;

  const compiled = frames.map((rows, frameIndex) =>
    compileFrame(rows, palette, frameIndex, width, height),
  );

  return {
    width,
    height,
    frameCount: compiled.length,
    drawFrame(ctx, x, y, frameIndex, scale) {
      for (const run of compiled[frameIndex]) {
        ctx.fillStyle = run.style;
        for (const [px, py] of run.pixels) {
          ctx.fillRect(x + px * scale, y + py * scale, scale, scale);
        }
      }
    },
  };
}

function compileFrame(
  rows: readonly string[],
  palette: Readonly<Record<string, Rgb>>,
  frameIndex: number,
  width: number,
  height: number,
): ColorRun[] {
  if (rows.length !== height) {
    throw new Error(
      `프레임 ${frameIndex} 의 높이가 ${rows.length} 입니다. ${height} 여야 합니다`,
    );
  }

  const byColor = new Map<string, Array<readonly [number, number]>>();

  rows.forEach((row, y) => {
    if (row.length !== width) {
      throw new Error(
        `프레임 ${frameIndex} 의 ${y}행 길이가 ${row.length} 입니다. ${width} 여야 합니다`,
      );
    }

    for (let x = 0; x < row.length; x += 1) {
      const symbol = row[x];
      if (TRANSPARENT.has(symbol)) continue;

      const color = palette[symbol];
      if (!color) {
        throw new Error(
          `프레임 ${frameIndex} 의 ${y}행 ${x}열에 팔레트에 없는 문자 "${symbol}" 가 있습니다`,
        );
      }

      const style = rgbToCss(color);
      const pixels = byColor.get(style);
      if (pixels) {
        pixels.push([x, y]);
      } else {
        byColor.set(style, [[x, y]]);
      }
    }
  });

  return [...byColor].map(([style, pixels]) => ({ style, pixels }));
}
