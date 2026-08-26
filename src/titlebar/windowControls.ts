/**
 * 창 제어 버튼의 동작을 한 곳에 모아둔다.
 *
 * 지금은 브라우저에서만 돌리므로 로그만 남긴다.
 * macOS에서 Tauri 창을 붙일 때는 아래 minimizeWindow / closeWindow 의
 * 본문만 Tauri API 호출로 교체하면 되고, 바인딩 코드는 손대지 않는다.
 */

export type WindowAction = "minimize" | "close";

export function minimizeWindow(): void {
  console.log("[windowControls] minimize");
}

export function closeWindow(): void {
  console.log("[windowControls] close");
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
