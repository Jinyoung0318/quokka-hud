/**
 * 타이틀바 왼쪽 끝의 배율 버튼.
 *
 * 배율을 여러 버튼으로 늘어놓기에는 타이틀바가 좁다. 하나만 두고 누를 때마다
 * 다음 배율로 넘긴다. 지금 배율이 라벨에 그대로 보이므로 무엇을 고른 상태인지도
 * 같이 읽힌다.
 *
 * 배율을 아는 자리가 여기뿐이라 CSS 에 알리는 일도 여기서 한다. 타이틀바와
 * 숫자 표시가 창 크기를 따라 줄어야 하는데, 그 크기는 배율을 알아야 정해진다.
 *
 * 배율을 실제로 바꾸는 일은 Rust 가 한다. 트레이 메뉴도 같은 함수를 지나서,
 * 어느 쪽으로 바꾸든 창 크기 · 설정 파일 · 트레이 체크 표시가 함께 움직인다.
 * 트레이에서 바꾼 경우에는 Rust 가 이벤트를 보내와 이 라벨도 따라온다.
 */

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { IS_TAURI } from "../runtime";
import { applyUiScale, DEFAULT_UI_SCALE, nextUiScale } from "../uiScale";

/** src-tauri/src/scale.rs 의 이름들과 같아야 한다. */
const READ_COMMAND = "window_scale";
const CYCLE_COMMAND = "cycle_window_scale";
const SCALE_CHANGED_EVENT = "scale-changed";

/**
 * 브라우저에는 창이 없다. 라벨과 미리보기 크기만 그럴듯하게 채운다.
 * 창에서 뜰 때와 같은 배율로 시작해야 브라우저에서 본 배치가 창에서도 같다.
 */
const BROWSER_SCALE = DEFAULT_UI_SCALE;

/*
 * data-window-action 을 쓰지 않는다. bindWindowControls() 가 그 속성을 훑어
 * 최소화 · 닫기에 핸들러를 붙이는데, 모르는 값을 만나면 경고를 찍는다.
 * 배율 버튼은 다루는 쪽이 달라서 속성도 나눠 둔다.
 */
const SELECTOR = "[data-titlebar-action='cycle-scale']";

export async function mountScaleButton(root: ParentNode = document): Promise<void> {
  const button = root.querySelector<HTMLButtonElement>(SELECTOR);
  if (!button) {
    console.warn("[scaleButton] 버튼을 찾지 못했습니다");
    return;
  }

  const render = (scale: number) => {
    // 라벨보다 먼저. 타이틀바 크기 자체가 배율을 따라간다.
    applyUiScale(scale);
    button.textContent = `${scale}x`;
    button.setAttribute("aria-label", `창 배율 ${scale}배. 누르면 다음 배율로`);
    button.title = `창 배율 ${scale}배`;
  };

  if (!IS_TAURI) {
    /*
     * 창이 없으니 창 크기는 못 바꾸지만, 미리보기 크기와 배율별 배치는 여기서도
     * 볼 수 있어야 한다. 1배에서 버튼과 숫자를 어떻게 접을지가 이번 배율의
     * 핵심인데, 그걸 보려고 매번 exe 를 빌드할 수는 없다.
     */
    let preview = BROWSER_SCALE;
    render(preview);
    button.addEventListener("click", () => {
      preview = nextUiScale(preview);
      render(preview);
    });
    return;
  }

  button.addEventListener("click", () => {
    void invoke<number>(CYCLE_COMMAND)
      .then(render)
      .catch((error) => console.error("[scaleButton] 배율 변경 실패", error));
  });

  // 트레이 메뉴에서 바꾼 경우에도 라벨이 따라오도록.
  void listen<number>(SCALE_CHANGED_EVENT, (event) => render(event.payload));

  try {
    render(await invoke<number>(READ_COMMAND));
  } catch (error) {
    console.error("[scaleButton] 지금 배율을 읽지 못했습니다", error);
    render(BROWSER_SCALE);
  }
}
