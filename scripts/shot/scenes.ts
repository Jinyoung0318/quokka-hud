/**
 * 찍을 장면들. 잔여율은 구간 대표값이다.
 *
 * 경계값(62.5 · 37.5 · 12.5)을 쓰지 않는다. 경계에 걸친 값은 어느 쪽
 * 단계인지 그림만 봐서는 알 수 없어서, 문서용 그림으로는 가운데가 낫다.
 */

export interface Scene {
  /** 파일 이름이자 상태 이름. docs/screenshots/README.md 와 같아야 한다. */
  readonly name: "morning" | "noon" | "dusk" | "night";
  /** 잔여율. 화면에 찍히는 숫자는 이걸 뒤집은 사용량이다. */
  readonly remainingPct: number;
  readonly label: string;
}

export const SCENES: readonly Scene[] = [
  { name: "morning", remainingPct: 85, label: "아침" },
  { name: "noon", remainingPct: 55, label: "낮" },
  { name: "dusk", remainingPct: 30, label: "해질녘" },
  { name: "night", remainingPct: 8, label: "밤" },
];

/** 창 배율. README 에서 읽히도록 3배(255px). */
export const SHOT_SCALE = 3;

/**
 * 갱신 시각으로 쓸 고정 시각.
 *
 * 찍을 때마다 시각이 달라지면 네 장의 마지막 줄이 제각각이 된다.
 * 화면에는 현지 시각으로 찍히므로 시간대가 다른 곳에서 다시 뽑으면
 * 숫자가 달라진다 — 그림의 뜻은 같다.
 */
export const SHOT_UPDATED_AT = "2026-08-28T04:24:00.000Z";
