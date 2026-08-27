/**
 * 씬의 배치 좌표.
 *
 * 나무 · 연못 · 쿼카가 서로 겹치지 않게 잡은 자리를 한곳에 모은다.
 * 상태 쪽(choreography)은 "어느 지점에 있는가"만 정하고,
 * 그 지점이 화면 어디인지는 이 파일이 정한다.
 */

import { HORIZON_Y, LOGICAL_SIZE } from "./canvas";
import { QUOKKA_SIZE } from "../sprites/quokka";
import type { Station } from "../state/choreography";

// ---------------------------------------------------------------- 쿼카

/**
 * 세로는 바닥이 지평선에 닿는 높이.
 * 앉은 자세라 스프라이트 맨 아랫줄이 바닥선이다.
 */
export const QUOKKA_FOOT_ROW = QUOKKA_SIZE - 1;
export const QUOKKA_Y = HORIZON_Y - QUOKKA_FOOT_ROW;

/** 평소 자리. 화면 가운데. */
export const QUOKKA_HOME_X = Math.floor((LOGICAL_SIZE - QUOKKA_SIZE) / 2);

/**
 * 지점별 쿼카 위치(스프라이트 왼쪽 모서리).
 *
 * 나무 앞에 서도 줄기와 잎을 가리지 않고, 연못가에 서도 수면 대부분이
 * 보이도록 잡았다. 스프라이트가 24px 이라 85px 화면에서는 여유가 크지 않다.
 */
export const STATION_X: Readonly<Record<Station, number>> = {
  tree: 14,
  home: QUOKKA_HOME_X,
  pond: 52,
};

// ---------------------------------------------------------------- 나무

/** 유칼립투스 줄기. 위로 곧게 뻗는다. */
export const TRUNK_X = 8;
export const TRUNK_WIDTH = 3;
/** 줄기 끝은 수관 안까지 들어간다. */
export const TRUNK_TOP_Y = 28;
/** 밑동은 지평선 첫 줄까지 내려와 땅에 박힌 것처럼 보이게 한다. */
export const TRUNK_BASE_Y = HORIZON_Y;

/** 밑동이 살짝 퍼지는 구간. */
export const TRUNK_FLARE_Y = HORIZON_Y - 3;

/** 수관으로 뻗는 가지. 줄기에서 갈라져 위로 올라간다. */
export const BRANCHES: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [[7, 37], [6, 36], [5, 35], [4, 34]],
  [[11, 36], [12, 35], [13, 34]],
];

/** 수관의 중심. 줄기 위쪽에 얹힌다. */
export const CANOPY_CENTER_X = 9;
export const CANOPY_CENTER_Y = 26;

/**
 * 수관을 이루는 덩어리들.
 *
 * 개별 잎이 아니라 겹쳐서 하나의 덩어리로 보이게 하는 것이 목적이다.
 * 유칼립투스답게 가로보다 세로로 길게 뻗도록 배치했다.
 *
 * from 은 이 덩어리가 나타나는 수관 크기다. 크기가 줄면 바깥쪽부터
 * 빠져서 앙상해지고, 남은 덩어리도 반지름이 함께 줄어든다.
 */
export const CANOPY_BLOBS: ReadonlyArray<{
  readonly dx: number;
  readonly dy: number;
  readonly r: number;
  readonly from: number;
}> = [
  { dx: 0, dy: -1, r: 5, from: 0 },
  { dx: -3, dy: -4, r: 4, from: 0 },
  { dx: 3, dy: -4, r: 4, from: 0 },
  { dx: 0, dy: 5, r: 4, from: 0.4 },
  { dx: -4, dy: 2, r: 4, from: 0.4 },
  { dx: 4, dy: 2, r: 4, from: 0.6 },
  { dx: 0, dy: -8, r: 4, from: 0.6 },
  { dx: -3, dy: 8, r: 3, from: 0.85 },
  { dx: 3, dy: 8, r: 3, from: 0.85 },
];

/** 잎 한 장(뜯어서 손에 든 것) 한 변. */
export const LEAF_SIZE = 3;

/**
 * 뜯은 잎을 얹을 자리. 스프라이트 왼쪽 위 모서리 기준 오프셋이다.
 *
 * 쿼카가 정면을 보고 있어 앞발이 배 앞 가운데에 모여 있다.
 * (현재 스프라이트에서는 16~17행의 x 9~13 이 앞발이고 중심이 x 11 이다.)
 * 그래서 잎도 가로 가운데에 두어야 쥐고 있는 것으로 보인다.
 * 옆으로 비키면 손에 든 게 아니라 옆에 떠 있는 것처럼 보인다.
 *
 * 세로는 앞발 바로 위. 잎 아랫줄이 앞발 윗줄에 한 칸 걸쳐서
 * 쥐고 있는 느낌을 준다.
 *
 * 스프라이트를 다시 그리면 세로값만 앞발 높이에 맞추면 된다.
 * 가로는 스프라이트 크기에서 저절로 따라온다.
 */
export const HELD_LEAF_X = Math.floor((QUOKKA_SIZE - LEAF_SIZE) / 2);
export const HELD_LEAF_Y = 14;

// ---------------------------------------------------------------- 연못

/** 웅덩이 타원. 지평선 아래 땅에 팬 자리다. */
export const POND_CENTER_X = 72;
export const POND_CENTER_Y = 71;
export const POND_RADIUS_X = 10;
export const POND_RADIUS_Y = 5;
