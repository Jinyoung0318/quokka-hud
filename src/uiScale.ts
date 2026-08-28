/**
 * 지금 창 배율을 CSS 에 알린다.
 *
 * 타이틀바 버튼과 숫자 표시는 배율을 따라가야 한다. 고정 px 로 두면 큰 창에
 * 맞춰 잡은 크기가 작은 창에서는 화면을 다 먹는다. 24px 버튼 세 개는 255px
 * 창에서 4분의 1이지만 85px 창에서는 폭의 절반이 넘는다.
 *
 * 크기 계산은 CSS 가 한다(styles.css 의 --ui-* 변수). 여기서는 배율이 얼마인지만
 * 알린다. JS 에서 px 을 계산해 인라인 스타일로 박으면 크기 규칙이 두 군데로
 * 갈라져, 나중에 한쪽만 고치게 된다.
 *
 * 손잡이를 두 개 건다.
 *
 *   --ui-scale     비례 계산에 쓰는 숫자
 *   data-ui-scale  1배 전용 규칙을 거는 자리
 *
 * 1배는 비례 축소만으로 해결되지 않는다. 계속 줄이면 글자가 3.5px, 버튼이 6px
 * 이 되어 읽지도 누르지도 못한다. 줄이는 대신 접어야 해서 별개의 손잡이가 있다.
 */

export const MIN_UI_SCALE = 1;
export const MAX_UI_SCALE = 3;

/** src-tauri/src/settings.rs 의 DEFAULT_SCALE 과 같아야 한다. */
export const DEFAULT_UI_SCALE = 2;

export function applyUiScale(scale: number): void {
  const root = document.documentElement;
  root.style.setProperty("--ui-scale", String(scale));
  root.dataset.uiScale = String(scale);
}

/**
 * 다음 배율. 마지막에서 처음으로 돈다.
 *
 * 창이 있는 쪽에서는 Rust 의 scale::next() 가 돌린다. 이 함수는 창이 없는
 * 브라우저에서 배율별 배치를 눈으로 확인하려고 둔 것이다. 브라우저에는 저장된
 * 설정이 없어 항상 기본값에서 시작하므로 범위 밖 값이 들어올 일은 없다.
 */
export function nextUiScale(scale: number): number {
  return scale >= MAX_UI_SCALE ? MIN_UI_SCALE : scale + 1;
}
