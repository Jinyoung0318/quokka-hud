/**
 * 개발용 잔여율 슬라이더.
 *
 * 슬라이더는 0~100 연속이다. API 가 값을 보내온 것처럼 onChange 로 넘기고,
 * 스냅과 애니메이션은 받는 쪽에서 처리한다. 옆에 스냅값과 상태 이름을
 * 같이 보여줘서 어느 단계로 붙는지 바로 확인할 수 있다.
 *
 * 지울 때 흔적이 남지 않도록 DOM 도 스타일도 전부 이 파일 안에서 만든다.
 * index.html 과 styles.css 에는 이 슬라이더에 대한 내용이 없다.
 * 제거하려면 main.ts 의 import 와 호출 한 줄을 지우고 src/dev/ 를 삭제하면 된다.
 */

const STYLE_ID = "dev-usage-slider-style";

const STYLE = `
.dev-usage {
  width: 340px;
  margin-top: 16px;
  padding: 10px 12px;
  border-radius: 10px;
  background-color: rgba(20, 20, 20, 0.75);
  color: #f2f2f2;
  font-family: Inter, Avenir, Helvetica, Arial, sans-serif;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dev-usage__row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  letter-spacing: 0.04em;
}
.dev-usage__label {
  color: rgba(242, 242, 242, 0.5);
}
.dev-usage__snap {
  margin-left: auto;
  color: rgba(242, 242, 242, 0.6);
  font-variant-numeric: tabular-nums;
}
.dev-usage__phase {
  min-width: 58px;
  text-align: right;
  color: #9fd4a0;
}
.dev-usage__value {
  min-width: 46px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.dev-usage__input {
  width: 100%;
  margin: 0;
  accent-color: #7cad5c;
  cursor: pointer;
}
`;

export interface UsageSliderOptions {
  initial: number;
  /** API 에서 새 값을 받은 것과 같은 취급으로 불린다. */
  onChange: (remainingPct: number) => void;
  /** 표시용. 슬라이더 값이 어느 단계로 스냅되는지 보여준다. */
  snap: (remainingPct: number) => number;
  phase: (remainingPct: number) => string;
}

/** 슬라이더를 붙이고 제거 함수를 돌려준다. */
export function mountUsageSlider(options: UsageSliderOptions): () => void {
  injectStyle();

  const root = document.createElement("div");
  root.className = "dev-usage";

  const row = document.createElement("div");
  row.className = "dev-usage__row";

  const label = document.createElement("span");
  label.className = "dev-usage__label";
  label.textContent = "remainingPct";

  const value = document.createElement("span");
  value.className = "dev-usage__value";

  const snap = document.createElement("span");
  snap.className = "dev-usage__snap";

  const phase = document.createElement("span");
  phase.className = "dev-usage__phase";

  const input = document.createElement("input");
  input.className = "dev-usage__input";
  input.type = "range";
  input.min = "0";
  input.max = "100";
  input.step = "0.5";
  input.value = String(options.initial);
  input.setAttribute("aria-label", "잔여율");

  const update = (raw: number) => {
    value.textContent = `${raw.toFixed(1)}%`;
    snap.textContent = `→ ${options.snap(raw)}`;
    phase.textContent = options.phase(raw);
    options.onChange(raw);
  };

  input.addEventListener("input", () => {
    update(Number(input.value));
  });

  row.append(label, value, snap, phase);
  root.append(row, input);
  document.body.appendChild(root);

  update(options.initial);

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
