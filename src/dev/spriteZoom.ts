/**
 * 개발용 스프라이트 확대.
 *
 * 16x16 을 다듬으려면 픽셀 하나하나가 보여야 한다. 켜면 씬 대신
 * 캐릭터만 4배로 그린다. 캔버스가 CSS 로 이미 4배이므로 화면에서는
 * 픽셀 하나가 16px 이 된다.
 *
 * 씬은 이 파일의 존재를 모른다. 확대 렌더도 여기서 직접 한다.
 * 제거하려면 main.ts 의 import 와 호출을 지우고 src/dev/ 를 삭제하면 된다.
 */

import { LOGICAL_SIZE } from "../render/canvas";
import { drawSprite, type Sprite } from "../render/sprite";
import type { Frame } from "../render/loop";

/**
 * 논리 캔버스 위에서의 추가 배율 상한.
 * 실제 배율은 스프라이트가 캔버스에 들어가는 선에서 정해진다.
 * 24x24 를 4배로 키우면 96px 이라 85px 캔버스를 넘치기 때문이다.
 */
export const MAX_ZOOM_SCALE = 4;

/** 이 스프라이트를 캔버스 안에 담을 수 있는 가장 큰 정수 배율. */
export function zoomScaleFor(sprite: Sprite): number {
  const longest = Math.max(sprite.width, sprite.height);
  // 테두리를 그릴 1픽셀씩을 남긴다.
  const fit = Math.floor((LOGICAL_SIZE - 2) / longest);
  return Math.max(1, Math.min(MAX_ZOOM_SCALE, fit));
}

/** 확대 화면 배경. 캐릭터 색과 겹치지 않는 중립 색을 쓴다. */
const BACKDROP = "rgb(64 64 72)";
const GRID = "rgb(80 80 90)";

const STYLE_ID = "dev-sprite-zoom-style";

const STYLE = `
.dev-zoom {
  width: 340px;
  margin-top: 8px;
  padding: 8px 12px;
  border-radius: 10px;
  background-color: rgba(20, 20, 20, 0.75);
  color: #f2f2f2;
  font-family: Inter, Avenir, Helvetica, Arial, sans-serif;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  letter-spacing: 0.04em;
}
.dev-zoom__input {
  margin: 0;
  accent-color: #7cad5c;
  cursor: pointer;
}
.dev-zoom__hint {
  margin-left: auto;
  color: rgba(242, 242, 242, 0.5);
}
`;

/** 캐릭터만 확대해서 그린다. 씬은 그리지 않는다. */
export function drawZoomedSprite(
  ctx: CanvasRenderingContext2D,
  sprite: Sprite,
  frame: Frame,
): void {
  ctx.fillStyle = BACKDROP;
  ctx.fillRect(0, 0, LOGICAL_SIZE, LOGICAL_SIZE);

  const scale = zoomScaleFor(sprite);
  const width = sprite.width * scale;
  const height = sprite.height * scale;
  const x = Math.floor((LOGICAL_SIZE - width) / 2);
  const y = Math.floor((LOGICAL_SIZE - height) / 2);

  // 스프라이트가 차지하는 칸을 표시해 여백을 가늠할 수 있게 한다.
  ctx.fillStyle = GRID;
  ctx.fillRect(x - 1, y - 1, width + 2, height + 2);
  ctx.fillStyle = BACKDROP;
  ctx.fillRect(x, y, width, height);

  drawSprite(ctx, sprite, x, y, frame.tick, scale);
}

export interface SpriteZoomToggleOptions {
  initial: boolean;
  onChange: (zoomed: boolean) => void;
}

/** 토글을 붙이고 제거 함수를 돌려준다. */
export function mountSpriteZoomToggle(
  options: SpriteZoomToggleOptions,
): () => void {
  injectStyle();

  const root = document.createElement("label");
  root.className = "dev-zoom";

  const input = document.createElement("input");
  input.className = "dev-zoom__input";
  input.type = "checkbox";
  input.checked = options.initial;

  const label = document.createElement("span");
  label.textContent = "스프라이트 확대";

  const hint = document.createElement("span");
  hint.className = "dev-zoom__hint";
  hint.textContent = `최대 ${MAX_ZOOM_SCALE}배`;

  input.addEventListener("change", () => {
    options.onChange(input.checked);
  });

  root.append(input, label, hint);
  document.body.appendChild(root);

  return () => {
    root.remove();
    document.getElementById(STYLE_ID)?.remove();
  };
}

function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = STYLE;
  document.head.appendChild(style);
}
