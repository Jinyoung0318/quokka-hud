/**
 * 조회가 한 번도 성공하지 못했을 때 띄우는 안내.
 *
 * 이 화면이 생긴 이유는 실패가 정상으로 보였기 때문이다. CLI 가 없으면
 * 폴러는 실패를 세지만 화면에 띄울 값이 없어서 초기값이 그대로 남았고,
 * 결과는 "Usage 0% + 해가 뜬 아침" 이었다. 한도가 넉넉하다는 신호와
 * 구분되지 않는다. 실패는 실패처럼 보여야 한다.
 *
 * 한 번이라도 성공했으면 띄우지 않는다. 그때는 마지막 값을 stale 로 두는
 * 편이 낫다. 값이 있는데 안내로 덮으면 볼 수 있던 것까지 못 보게 된다.
 *
 * 캐릭터는 지우지 않고 가림막 뒤에 남긴다. 창이 통째로 비면 고장난 것처럼
 * 보이고, 그대로 두면 씬이 값처럼 읽힌다. 가림막이 "이건 지금 값이 아니다"
 * 를 표시하면서 앱의 얼굴은 남긴다.
 *
 * 마크업은 index.html 에 있고 이 파일은 문구만 채운다.
 */

import type { UsageFailureKind } from "../collector/source";

/** 원인별 문구. 화면에 무엇을 하라고 말해주는 것이 목적이다. */
interface Copy {
  /** 1배 창에서만 쓰는 짧은 말. 85px 안에는 문장이 들어가지 않는다. */
  short: string;
  headline: string;
  detail: string;
}

const COPY: Record<UsageFailureKind, Copy> = {
  "cli-not-found": {
    short: "CLI 없음",
    headline: "Claude Code CLI가 필요합니다",
    detail: "npm install -g @anthropic-ai/claude-code",
  },
  "unexpected-output": {
    short: "로그인 필요",
    headline: "Claude 로그인이 필요합니다",
    detail: "터미널에서 claude 를 실행해 로그인해 주세요",
  },
  timeout: {
    short: "응답 없음",
    headline: "응답이 없습니다",
    detail: "claude 가 제때 끝나지 않았습니다",
  },
  unknown: {
    short: "오류",
    headline: "사용량을 읽지 못했습니다",
    detail: "잠시 후 다시 시도해 주세요",
  },
};

export interface GuidanceHandle {
  show(kind: UsageFailureKind): void;
  hide(): void;
  /** 진단 기록이 어디 있는지. 빈 문자열이면 줄을 감춘다. */
  setLogPath(path: string): void;
  /** 재시도 중에는 버튼을 잠근다. 눌러도 아무 일이 없으면 고장으로 보인다. */
  setBusy(busy: boolean): void;
}

export interface GuidanceOptions {
  onRetry: () => void;
}

export function mountGuidance(
  options: GuidanceOptions,
  root: ParentNode = document,
): GuidanceHandle {
  const panel = root.querySelector<HTMLElement>("[data-guidance-root]");
  const short = root.querySelector<HTMLElement>('[data-guidance="short"]');
  const headline = root.querySelector<HTMLElement>('[data-guidance="headline"]');
  const detail = root.querySelector<HTMLElement>('[data-guidance="detail"]');
  const retry = root.querySelector<HTMLButtonElement>('[data-guidance="retry"]');
  const log = root.querySelector<HTMLElement>('[data-guidance="log"]');

  if (!panel || !short || !headline || !detail || !retry || !log) {
    throw new Error("안내 화면 마크업이 index.html 과 맞지 않습니다");
  }

  const retryLabel = retry.textContent ?? "다시 시도";

  retry.addEventListener("click", () => {
    options.onRetry();
  });

  return {
    show(kind) {
      const copy = COPY[kind] ?? COPY.unknown;
      short.textContent = copy.short;
      headline.textContent = copy.headline;
      detail.textContent = copy.detail;
      panel.hidden = false;
    },

    hide() {
      panel.hidden = true;
    },

    setLogPath(path) {
      if (path === "") {
        log.hidden = true;
        return;
      }
      log.hidden = false;
      // 전체 경로는 좁은 창에 들어가지 않는다. 파일 이름만 보이고
      // 마우스를 올리면 전체가 뜬다.
      log.textContent = "진단 기록: diagnostics.log";
      log.title = path;
    },

    setBusy(busy) {
      retry.disabled = busy;
      retry.textContent = busy ? "확인 중…" : retryLabel;
    },
  };
}
