/**
 * 화면에 띄울 숫자의 내용과 형식.
 *
 * **화면 숫자는 사용량, 씬 계산은 잔여율이다.**
 *
 * 앱 안에서는 잔여율(remainingPct) 하나만 돌아다닌다. 해의 궤도도 나무 수관도
 * 연못 수위도 전부 잔여율로 계산한다. 그런데 사람은 "얼마나 썼나"를 먼저
 * 떠올리고 CLI 원문도 "51% used" 로 준다. 그래서 화면에 찍을 때만 뒤집는다.
 *
 * 뒤집는 자리는 이 파일 하나뿐이다. 여기저기서 100 을 빼기 시작하면
 * 어느 값이 어느 쪽인지 금방 헷갈린다.
 */

export interface UsageReadout {
  /**
   * 잔여율 0~100. 스냅하지 않은 원래 값이다.
   *
   * 앱 안에서 쓰는 값 그대로 담는다. 사용량으로 뒤집는 것은 formatUsage() 가
   * 화면에 찍는 순간에만 한다.
   */
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

/**
 * 잔여율을 사용량으로 뒤집어 "16%" 형태로 만든다.
 *
 * 잔여 84 -> "16%". 자른 뒤에 빼고 마지막에 반올림한다. 반올림을 먼저 하면
 * 잔여 84.4 가 84 로 접힌 뒤 16 이 나와, 15.6 을 반올림한 것과 어긋날 수 있다.
 */
export function formatUsage(remainingPct: number): string {
  const clamped = remainingPct < 0 ? 0 : remainingPct > 100 ? 100 : remainingPct;
  return `${Math.round(100 - clamped)}%`;
}

/** ISO 문자열에서 현지 시각 "HH:MM" 만. 읽을 수 없으면 null. */
export function formatClock(iso: string): string | null {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;

  const hours = String(at.getHours()).padStart(2, "0");
  const minutes = String(at.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * 둘째 줄에 띄울 값. 시각을 읽을 수 없으면 null.
 *
 * 주기는 붙이지 않는다. 오른쪽 아래 폴링 버튼에 이미 적혀 있어서 중복이고,
 * 여기에도 두면 주기를 바꿀 때 두 군데가 어긋날 수 있다.
 */
export function formatSyncValue(updatedAt: string): string | null {
  return formatClock(updatedAt);
}
