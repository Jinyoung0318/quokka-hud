/**
 * 화면에 띄울 잔여율 표시의 내용.
 *
 * 그리는 방식이 둘이다. 캔버스에 픽셀 폰트로 찍는 쪽(render/readout.ts)과
 * 캔버스 위에 HTML 을 겹치는 쪽(overlay/readoutOverlay.ts). 어느 쪽이 나은지
 * 정하기 전까지 둘 다 두고, 공통으로 쓰는 내용만 여기에 모은다.
 *
 * 한쪽을 지워도 다른 쪽이 남도록 이 파일은 어느 쪽에도 딸리지 않는다.
 */

export interface UsageReadout {
  /** 화면에 띄울 잔여율 0~100. 스냅하지 않은 값이다. */
  remainingPct: number;
  /**
   * 마지막 갱신 시각(ISO). null 이면 둘째 줄을 그리지 않는다.
   *
   * 개발용 슬라이더가 화면을 잡고 있을 때처럼 조회에서 온 값이 아니면
   * 시각을 붙이지 않는다. 조회한 적 없는 값에 시각을 달면 거짓말이 된다.
   */
  updatedAt: string | null;
  /** 조회에 실패해 직전 값을 들고 있는지. */
  stale: boolean;
}

export const RATE_LABEL = "Remain rate";
export const SYNC_LABEL = "Sync time";

/**
 * 폴링 주기를 사람이 읽는 말로.
 * POLL_INTERVAL_MS 가 바뀌면 여기도 고친다. 저절로 따라가지 않는다.
 */
export const SYNC_EVERY = "(5m)";

/** "59%" 형태로. 0~100 으로 자르고 반올림한다. */
export function formatPercent(remainingPct: number): string {
  const clamped = remainingPct < 0 ? 0 : remainingPct > 100 ? 100 : remainingPct;
  return `${Math.round(clamped)}%`;
}

/** ISO 문자열에서 현지 시각 "HH:MM" 만. 읽을 수 없으면 null. */
export function formatClock(iso: string): string | null {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;

  const hours = String(at.getHours()).padStart(2, "0");
  const minutes = String(at.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/** 둘째 줄에 띄울 값. 시각을 읽을 수 없으면 null. */
export function formatSyncValue(updatedAt: string): string | null {
  const clock = formatClock(updatedAt);
  return clock === null ? null : `${clock} ${SYNC_EVERY}`;
}
