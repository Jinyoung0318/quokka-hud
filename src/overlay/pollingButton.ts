/**
 * 오른쪽 아래의 폴링 주기 버튼.
 *
 * 왼쪽 아래에 사용량 숫자가 있어서 대칭으로 오른쪽 아래에 둔다. 그 자리는
 * 연못 아래 빈 땅이라 씬에서 가리는 것이 없다.
 *
 * 주기를 실제로 바꾸고 저장하는 일은 Rust 가 한다. 트레이 메뉴도 같은 함수를
 * 지나서, 어느 쪽으로 바꾸든 설정 파일 · 트레이 체크 표시 · 이 라벨이 함께
 * 움직인다. 트레이에서 바꾼 경우에는 Rust 가 이벤트를 보내와 라벨이 따라온다.
 *
 * 타이틀바가 아니라 캔버스 위에 떠 있으므로 data-tauri-drag-region 을 걸지
 * 않는다. 걸면 누르는 순간 창 드래그로 잡혀 클릭이 먹지 않는다.
 */

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { IS_TAURI } from "../runtime";
import {
  DEFAULT_POLL_MINUTES,
  formatPollValue,
  nextPollMinutes,
  sanitizePollMinutes,
} from "../pollInterval";

/** src-tauri/src/polling.rs 의 이름들과 같아야 한다. */
const READ_COMMAND = "poll_interval";
const CYCLE_COMMAND = "cycle_poll_interval";
const POLL_CHANGED_EVENT = "poll-interval-changed";

const SELECTOR = "[data-polling-action='cycle-interval']";

export interface PollingButtonOptions {
  /**
   * 주기가 정해졌을 때마다 불린다. 처음 읽었을 때 · 눌렀을 때 ·
   * 트레이에서 바뀌었을 때 모두 온다.
   */
  onChange: (minutes: number) => void;
}

export async function mountPollingButton(
  options: PollingButtonOptions,
  root: ParentNode = document,
): Promise<void> {
  const button = root.querySelector<HTMLButtonElement>(SELECTOR);
  if (!button) {
    console.warn("[pollingButton] 버튼을 찾지 못했습니다");
    return;
  }

  const value = button.querySelector<HTMLElement>('[data-polling="value"]');
  if (!value) {
    throw new Error("폴링 버튼 마크업이 index.html 과 맞지 않습니다");
  }

  const render = (minutes: number) => {
    const safe = sanitizePollMinutes(minutes);
    // 라벨("Polling")은 마크업에 고정이다. 1배에서 그것만 접는다.
    value.textContent = formatPollValue(safe);
    button.setAttribute("aria-label", `사용량 갱신 주기 ${safe}분. 누르면 다음 주기로`);
    button.title = `사용량을 ${safe}분마다 조회합니다`;
    options.onChange(safe);
  };

  if (!IS_TAURI) {
    // 창이 없으니 저장은 안 되지만, 배치와 순환은 브라우저에서도 확인할 수 있어야 한다.
    let preview = DEFAULT_POLL_MINUTES;
    render(preview);
    button.addEventListener("click", () => {
      preview = nextPollMinutes(preview);
      render(preview);
    });
    return;
  }

  button.addEventListener("click", () => {
    void invoke<number>(CYCLE_COMMAND)
      .then(render)
      .catch((error) => console.error("[pollingButton] 주기 변경 실패", error));
  });

  // 트레이 메뉴에서 바꾼 경우에도 라벨이 따라오도록.
  void listen<number>(POLL_CHANGED_EVENT, (event) => render(event.payload));

  try {
    render(await invoke<number>(READ_COMMAND));
  } catch (error) {
    console.error("[pollingButton] 지금 주기를 읽지 못했습니다", error);
    render(DEFAULT_POLL_MINUTES);
  }
}
