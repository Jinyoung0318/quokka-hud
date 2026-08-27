/**
 * 창 제어 버튼의 동작을 한 곳에 모아둔다.
 *
 * Tauri 창에서는 실제로 창을 최소화하거나 닫고, 브라우저에서는 할 수 있는 일이
 * 없으므로 로그만 남긴다. 갈라지는 곳은 아래 두 함수의 본문뿐이고
 * bindWindowControls() 와 마크업은 양쪽에서 똑같이 돈다.
 *
 * 두 동작 모두 권한이 필요하다. src-tauri/capabilities/default.json 의
 * core:window:allow-minimize / allow-close 가 빠지면 클릭해도 아무 일이 없다.
 */

import { getCurrentWindow } from "@tauri-apps/api/window";
import { IS_TAURI } from "../runtime";

export type WindowAction = "minimize" | "close";

export function minimizeWindow(): void {
  if (!IS_TAURI) {
    console.log("[windowControls] minimize (브라우저라 실제 동작 없음)");
    return;
  }

  // 실패해도 창을 멈출 일은 아니라서 삼키지 않고 로그만 남긴다.
  void getCurrentWindow()
    .minimize()
    .catch((error) => console.error("[windowControls] minimize 실패", error));
}

export function closeWindow(): void {
  if (!IS_TAURI) {
    console.log("[windowControls] close (브라우저라 실제 동작 없음)");
    return;
  }

  // destroy() 가 아니라 close() 를 쓴다. 나중에 트레이로 내리거나 종료를
  // 되물을 여지를 남긴다.
  void getCurrentWindow()
    .close()
    .catch((error) => console.error("[windowControls] close 실패", error));
}

const handlers: Record<WindowAction, () => void> = {
  minimize: minimizeWindow,
  close: closeWindow,
};

/** data-window-action 속성이 붙은 버튼에 핸들러를 연결한다. */
export function bindWindowControls(root: ParentNode = document): void {
  const buttons =
    root.querySelectorAll<HTMLElement>("[data-window-action]");

  buttons.forEach((button) => {
    const action = button.dataset.windowAction as WindowAction | undefined;
    if (!action || !(action in handlers)) {
      console.warn("[windowControls] 알 수 없는 action:", action);
      return;
    }
    button.addEventListener("click", handlers[action]);
  });
}
