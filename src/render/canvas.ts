/**
 * 논리 해상도 85x85 캔버스를 만들어 띄운다.
 * 이 파일 밖의 모든 좌표는 85x85 기준이다.
 *
 * 확대 배율은 여기서 정하지 않는다. 캔버스가 CSS 로 부모를 100% 채우고,
 * 창 한 변이 늘 LOGICAL_SIZE 의 정수배라 배율이 저절로 정수로 따라온다.
 * 창 크기는 트레이 메뉴에서 고르며 src-tauri/src/settings.rs 가 들고 있다.
 */

/** 논리 해상도. 이후 모든 좌표의 기준. src-tauri 의 LOGICAL_SIZE 와 같아야 한다. */
export const LOGICAL_SIZE = 85;

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
