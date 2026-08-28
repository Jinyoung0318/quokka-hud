/**
 * 폴링 주기 — 고를 수 있는 값과 표시 형식.
 *
 * Rust(src-tauri/src/polling.rs · settings.rs)와 같은 값을 들고 있어야 한다.
 * 실제로 주기를 지키며 도는 것은 collector/poller.ts 이고, 무엇을 고를 수
 * 있는지와 화면에 어떻게 찍는지는 여기 한 곳에 있다.
 *
 * 1분이 선택지에 있는 것은 실측 때문이다. 1분 간격 30회에서 실패 0건 ·
 * 레이트 리밋 흔적 0건이었다. 다만 한 번 호출에 7초가 걸린다.
 */

/** 고를 수 있는 주기(분). src-tauri/src/settings.rs 의 POLL_CHOICES 와 같아야 한다. */
export const POLL_CHOICES_MIN: readonly number[] = [1, 2, 5];

/** src-tauri/src/settings.rs 의 DEFAULT_POLL_MINUTES 와 같아야 한다. */
export const DEFAULT_POLL_MINUTES = 2;

export function pollIntervalMs(minutes: number): number {
  return minutes * 60 * 1000;
}

/** 고를 수 없는 값이면 기본값으로. Rust 의 sanitize_poll_minutes 와 같은 규칙이다. */
export function sanitizePollMinutes(minutes: number): number {
  return POLL_CHOICES_MIN.includes(minutes) ? minutes : DEFAULT_POLL_MINUTES;
}

/**
 * 다음 주기. 마지막에서 처음으로 돈다.
 *
 * 창이 있는 쪽에서는 Rust 의 polling::next() 가 돌린다. 이 함수는 창이 없는
 * 브라우저에서 배치를 확인하려고 둔 것이다.
 */
export function nextPollMinutes(minutes: number): number {
  // 모르는 값이면 0 번에서 시작한 것으로 친다. Rust 의 unwrap_or(0) 과 같은
  // 규칙이라 두 쪽이 같은 답을 낸다. 여기서 -1 을 그대로 쓰면 Rust 는 2분,
  // 이쪽은 1분이 되어 갈린다.
  const found = POLL_CHOICES_MIN.indexOf(minutes);
  const index = found < 0 ? 0 : found;
  return POLL_CHOICES_MIN[(index + 1) % POLL_CHOICES_MIN.length];
}

/**
 * 버튼에 찍을 값. "2m"
 *
 * 앞의 "Polling" 은 마크업에 고정으로 있고 여기서 만들지 않는다. 1배 창에서는
 * 그 라벨만 접고 값을 남기는데(styles.css), 한 문자열로 만들어 두면 접을 수 없다.
 * 왼쪽 아래 숫자 표시가 "Usage" 를 접고 "16%" 만 남기는 것과 같은 구조다.
 */
export function formatPollValue(minutes: number): string {
  return `${minutes}m`;
}
