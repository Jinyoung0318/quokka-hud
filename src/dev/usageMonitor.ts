/**
 * 개발용 사용량 모니터.
 *
 * 폴링이 실제로 도는지 눈으로 보이게 현재 값과 마지막 갱신 시각을 띄우고,
 * 목 데이터를 흐르게 할지 토글한다.
 *
 * 목 흐름을 켜면 폴링 주기도 짧아진다. 5분 주기로는 변화를 볼 수 없다.
 * 실제 수집기를 쓸 때는 토글을 켜도 값이 흐르지 않는다. 흐를 수 있는 것은
 * 목 수집기뿐이고, 주기만 짧아진다.
 *
 * DOM 도 스타일도 이 파일 안에서 만든다. index.html 과 styles.css 에는
 * 이 패널에 대한 내용이 없어서 src/dev/ 를 통째로 지우면 흔적이 남지 않는다.
 */

import type { UsageSnapshot } from "../snapshot";
import type { BrowserSourceMode } from "../collector/browserSource";

/** 목 흐름을 켰을 때의 폴링 주기. 5분으로는 변화를 볼 수 없다. */
export const MOCK_POLL_INTERVAL_MS = 3_000;

const STYLE_ID = "dev-usage-monitor-style";

const STYLE = `
.dev-monitor {
  width: 340px;
  margin-top: 8px;
  padding: 8px 12px;
  border-radius: 10px;
  background-color: rgba(20, 20, 20, 0.75);
  color: #f2f2f2;
  font-family: Inter, Avenir, Helvetica, Arial, sans-serif;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  letter-spacing: 0.04em;
}
.dev-monitor__row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dev-monitor__label {
  color: rgba(242, 242, 242, 0.5);
}
.dev-monitor__source {
  color: rgba(242, 242, 242, 0.75);
}
.dev-monitor__toggle {
  margin-left: auto;
  padding: 3px 10px;
  border: 0;
  border-radius: 6px;
  background-color: rgba(255, 255, 255, 0.08);
  color: rgba(242, 242, 242, 0.6);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
}
.dev-monitor__toggle[aria-pressed="true"] {
  background-color: #7cad5c;
  color: #14140f;
}
.dev-monitor__toggle:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.dev-monitor__modes {
  margin-left: auto;
  display: flex;
  gap: 4px;
}
.dev-monitor__mode {
  padding: 3px 10px;
  border: 0;
  border-radius: 6px;
  background-color: rgba(255, 255, 255, 0.08);
  color: rgba(242, 242, 242, 0.6);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
}
.dev-monitor__mode[aria-pressed="true"] {
  background-color: #7cc4e8;
  color: #14140f;
}
.dev-monitor__value {
  font-variant-numeric: tabular-nums;
  color: #9fd4a0;
}
.dev-monitor__time {
  color: rgba(242, 242, 242, 0.5);
  font-variant-numeric: tabular-nums;
}
.dev-monitor__stale {
  margin-left: auto;
  color: #e0a24e;
}
.dev-monitor__control {
  color: rgba(242, 242, 242, 0.75);
}
.dev-monitor__control[data-by="collector"] {
  color: #7cc4e8;
}
.dev-monitor__control[data-by="slider"] {
  color: #e0a24e;
}
`;

/** 지금 화면을 누가 잡고 있는가. */
export type ScreenController = "collector" | "slider";

/**
 * 화면 제어권 규칙.
 *
 * 목 흐름이 켜져 있으면 값이 흐르는 것을 보려는 것이므로 수집기가 이긴다.
 * 슬라이더를 건드려도 무시하고, 슬라이더는 아예 꺼둔다.
 *
 * 목 흐름이 꺼져 있으면 슬라이더를 한 번이라도 건드린 쪽이 이긴다.
 * 건드린 적이 없으면 수집기가 그대로 화면을 잡는다.
 */
export function controllerFor(
  mockDraining: boolean,
  sliderTouched: boolean,
): ScreenController {
  if (mockDraining) return "collector";
  return sliderTouched ? "slider" : "collector";
}

export interface UsageMonitorOptions {
  /** 처음 고를 소스. 기본은 실제 CLI 다. */
  initialMode: BrowserSourceMode;
  /** 처음에 목 흐름을 켤지. 기본은 꺼짐이다. */
  initialMock: boolean;
  onModeChange: (mode: BrowserSourceMode) => void;
  onMockChange: (draining: boolean) => void;
}

export interface UsageMonitorHandle {
  /** 새 스냅샷이 올 때마다 불러 표시를 갱신한다. */
  update(snapshot: UsageSnapshot, sourceName: string): void;
  /**
   * 화면 제어권이 넘어갈 때마다 불러 표시를 갱신한다.
   *
   * 스냅샷과 따로 두는 이유는, 슬라이더를 건드려 제어권이 바뀌는 순간에는
   * 새 스냅샷이 없기 때문이다.
   */
  setController(controller: ScreenController): void;
  /**
   * 목 흐름 토글을 만질 수 있게 할지.
   *
   * 실제 CLI 를 쓰는 동안에는 흐를 목 데이터가 없으므로 꺼둔다.
   */
  setMockToggleEnabled(enabled: boolean): void;
  remove(): void;
}

export function mountUsageMonitor(options: UsageMonitorOptions): UsageMonitorHandle {
  injectStyle();

  const root = document.createElement("div");
  root.className = "dev-monitor";

  // 첫째 줄 — 수집기 이름과 목 토글
  const topRow = document.createElement("div");
  topRow.className = "dev-monitor__row";

  const label = document.createElement("span");
  label.className = "dev-monitor__label";
  label.textContent = "수집기";

  const source = document.createElement("span");
  source.className = "dev-monitor__source";
  source.textContent = "—";

  // 소스 선택 — 실제 CLI / Mock
  const modes = document.createElement("div");
  modes.className = "dev-monitor__modes";

  const modeButtons = new Map<BrowserSourceMode, HTMLButtonElement>();
  const paintModes = (active: BrowserSourceMode) => {
    for (const [value, button] of modeButtons) {
      button.setAttribute("aria-pressed", String(value === active));
    }
  };

  for (const [value, text] of [
    ["cli", "실제 CLI"],
    ["mock", "Mock"],
  ] as Array<[BrowserSourceMode, string]>) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dev-monitor__mode";
    button.textContent = text;
    button.addEventListener("click", () => {
      paintModes(value);
      options.onModeChange(value);
    });
    modeButtons.set(value, button);
    modes.appendChild(button);
  }
  paintModes(options.initialMode);

  topRow.append(label, source, modes);

  // 둘째 줄 — 현재 값과 마지막 갱신 시각
  const bottomRow = document.createElement("div");
  bottomRow.className = "dev-monitor__row";

  const value = document.createElement("span");
  value.className = "dev-monitor__value";
  value.textContent = "—";

  const time = document.createElement("span");
  time.className = "dev-monitor__time";
  time.textContent = "갱신 없음";

  const stale = document.createElement("span");
  stale.className = "dev-monitor__stale";
  stale.textContent = "";

  bottomRow.append(value, time, stale);

  // 셋째 줄 — 지금 화면을 누가 잡고 있는지
  const controlRow = document.createElement("div");
  controlRow.className = "dev-monitor__row";

  const controlLabel = document.createElement("span");
  controlLabel.className = "dev-monitor__label";
  controlLabel.textContent = "화면 제어";

  const control = document.createElement("span");
  control.className = "dev-monitor__control";
  control.textContent = "—";

  // 목 흐름 토글 — 켜면 값이 흐르고, 그동안은 수집기가 화면을 잡는다.
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "dev-monitor__toggle";
  toggle.setAttribute("aria-pressed", String(options.initialMock));
  toggle.textContent = labelFor(options.initialMock);

  let draining = options.initialMock;
  toggle.addEventListener("click", () => {
    draining = !draining;
    toggle.setAttribute("aria-pressed", String(draining));
    toggle.textContent = labelFor(draining);
    options.onMockChange(draining);
  });

  controlRow.append(controlLabel, control, toggle);

  root.append(topRow, bottomRow, controlRow);
  document.body.appendChild(root);

  return {
    update(snapshot, sourceName) {
      source.textContent = sourceName;
      value.textContent = `${snapshot.remainingPct.toFixed(1)}%`;
      time.textContent = `갱신 ${clockOf(snapshot.fetchedAt)}`;
      // 조회에 실패해 직전 값을 들고 있는 중이라는 표시.
      stale.textContent = snapshot.stale ? "stale" : "";
    },

    setMockToggleEnabled(enabled) {
      toggle.disabled = !enabled;
    },

    setController(controller) {
      control.dataset.by = controller;
      control.textContent =
        controller === "collector"
          ? "수집기 (슬라이더 무시)"
          : "슬라이더 (수집기 값 무시)";
    },

    remove() {
      root.remove();
      document.getElementById(STYLE_ID)?.remove();
    },
  };
}

function labelFor(draining: boolean): string {
  return draining ? "Mock 흐름 켬" : "Mock 흐름 끔";
}

/** ISO 문자열에서 시:분:초만 뽑는다. 날짜까지 붙으면 줄이 길어진다. */
function clockOf(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "—";
  return at.toLocaleTimeString(undefined, { hour12: false });
}

function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = STYLE;
  document.head.appendChild(style);
}
