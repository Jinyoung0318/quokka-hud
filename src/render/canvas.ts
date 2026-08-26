/**
 * 논리 해상도 85x85 캔버스를 만들고 4배로 확대해 띄운다.
 * 이 파일 밖의 모든 좌표는 85x85 기준이다.
 */

/** 논리 해상도. 이후 모든 좌표의 기준. */
export const LOGICAL_SIZE = 85;

/** 화면 배율. 85 * 4 = 340 으로 창 크기와 맞는다. */
export const SCALE = 4;

/** 지평선. 아래쪽 1/4 지점 = 위에서 3/4 지점. */
export const HORIZON_Y = Math.round(LOGICAL_SIZE * 0.75);

export function createPixelCanvas(host: HTMLElement): CanvasRenderingContext2D {
  const canvas = document.createElement("canvas");
  canvas.width = LOGICAL_SIZE;
  canvas.height = LOGICAL_SIZE;
  canvas.className = "hud__canvas";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "사용량 상태 화면");

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2d 컨텍스트를 만들 수 없습니다");
  }

  // 확대해도 픽셀 경계가 뭉개지지 않도록.
  ctx.imageSmoothingEnabled = false;

  host.appendChild(canvas);
  return ctx;
}
