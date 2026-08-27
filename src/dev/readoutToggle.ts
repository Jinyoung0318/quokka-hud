/**
 * 개발용 잔여율 표시 방식 토글.
 *
 * 캔버스에 픽셀 폰트로 찍는 쪽과 캔버스 위에 HTML 을 겹치는 쪽을 오가며
 * 어느 쪽이 나은지 비교하기 위한 것이다. 하나로 정하고 나면 이 파일과
 * 지는 쪽 구현을 함께 지운다.
 *
 * DOM 도 스타일도 이 파일 안에서 만든다. src/dev/ 를 통째로 지우면
 * 흔적이 남지 않는다.
 */

/** 잔여율을 어디에 그릴지. */
export type ReadoutMode = "html" | "canvas" | "off";

const STYLE_ID = "dev-readout-toggle-style";

const STYLE = `
.dev-readout {
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
  letter-spacing: 0.04em;
}
.dev-readout__label {
  color: rgba(242, 242, 242, 0.5);
}
.dev-readout__modes {
  margin-left: auto;
  display: flex;
  gap: 4px;
}
.dev-readout__mode {
  padding: 3px 10px;
  border: 0;
  border-radius: 6px;
  background-color: rgba(255, 255, 255, 0.08);
  color: rgba(242, 242, 242, 0.6);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
}
.dev-readout__mode[aria-pressed="true"] {
  background-color: #c8a15c;
  color: #14140f;
}
`;

const MODES: ReadonlyArray<{ value: ReadoutMode; text: string }> = [
  { value: "html", text: "HTML" },
  { value: "canvas", text: "캔버스" },
  { value: "off", text: "끔" },
];

export interface ReadoutToggleOptions {
  initial: ReadoutMode;
  onChange: (mode: ReadoutMode) => void;
}

export function mountReadoutToggle(options: ReadoutToggleOptions): () => void {
  injectStyle();

  const root = document.createElement("div");
  root.className = "dev-readout";

  const label = document.createElement("span");
  label.className = "dev-readout__label";
  label.textContent = "숫자 표시";

  const modes = document.createElement("div");
  modes.className = "dev-readout__modes";

  const buttons = new Map<ReadoutMode, HTMLButtonElement>();
  const paint = (active: ReadoutMode) => {
    for (const [value, button] of buttons) {
      button.setAttribute("aria-pressed", String(value === active));
    }
  };

  for (const { value, text } of MODES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dev-readout__mode";
    button.textContent = text;
    button.addEventListener("click", () => {
      paint(value);
      options.onChange(value);
    });
    buttons.set(value, button);
    modes.appendChild(button);
  }
  paint(options.initial);

  root.append(label, modes);
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
