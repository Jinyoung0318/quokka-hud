/**
 * 수집기와 렌더러 사이의 계약.
 *
 * 렌더러는 이 구조 하나만 보고, 값이 어디서 왔는지 모른다.
 * 필드명은 프로바이더 중립적으로 유지한다. claudeRemaining 같은 이름을 쓰지 않는다.
 *
 * 나중에 수집기를 Rust 로 옮기면 src-tauri/src/snapshot.rs 가 같은 모양을 갖는다.
 */
export interface UsageSnapshot {
  /** 5시간 창 잔여율 (0~100). 화면은 이 값만 본다. */
  remainingPct: number;
  /** 주간 잔여율 (0~100). */
  weeklyRemainingPct: number;
  /** 5시간 창 리셋 시각. ISO 8601 문자열. 알아내지 못하면 null. */
  resetAt: string | null;
  /**
   * 주간 리셋 시각. ISO 8601 문자열. 알아내지 못하면 null.
   *
   * v0.1 화면은 쓰지 않지만 출력에 들어 있어 파싱은 되므로 버리지 않는다.
   */
  weeklyResetAt: string | null;
  /** 현재 모델. 알아내지 못하면 null. */
  model: string | null;
  /** 이 값을 만든 시각. ISO 8601 문자열. */
  fetchedAt: string;
  /** 조회에 실패해 직전 값을 그대로 들고 있는 것인지. */
  stale: boolean;
}
