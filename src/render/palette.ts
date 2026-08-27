/**
 * 씬에 쓰이는 모든 색을 여기 모은다.
 *
 * 렌더 모듈은 색 리터럴을 직접 쓰지 않는다. 필요한 색은 반드시
 * 이 파일의 상수나 paletteAtOrbit() 이 돌려주는 값을 통해서만 가져간다.
 * 나중에 스프라이트셋을 갈아끼울 때 이 파일만 손보면 되도록.
 */

import { PHASE_COUNT, wrapOrbit } from "../state/skyState";

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** 한 단계의 씬 전체 색. */
export interface ScenePalette {
  skyZenith: Rgb;
  skyHorizon: Rgb;
  ground: Rgb;
  groundDeep: Rgb;
  grass: Rgb;
  sun: Rgb;
  sunCore: Rgb;
  /** 유칼립투스 줄기와 가지. */
  trunk: Rgb;
  /** 수관에서 빛을 받는 쪽. */
  leaf: Rgb;
  /** 수관의 그늘진 쪽. 단색이면 덩어리가 납작해 보인다. */
  leafDeep: Rgb;
  /** 연못 수면. */
  water: Rgb;
  /** 연못 깊은 쪽. 수면과 나눠 칠해야 물이 고여 보인다. */
  waterDeep: Rgb;
}

function rgb(r: number, g: number, b: number): Rgb {
  return { r, g, b };
}

/**
 * 단계별 대표색. 궤도 순서(morning, noon, dusk, night)와 인덱스가 맞아야 한다.
 * 마지막 night 다음은 다시 morning 으로 이어지며 보간된다.
 */
export const PHASE_PALETTES: ReadonlyArray<ScenePalette> = [
  {
    // morning
    skyZenith: rgb(0x6f, 0x9f, 0xd8),
    skyHorizon: rgb(0xff, 0xdc, 0xb0),
    ground: rgb(0x4e, 0x7a, 0x45),
    groundDeep: rgb(0x2f, 0x52, 0x30),
    grass: rgb(0x6f, 0x9c, 0x55),
    sun: rgb(0xff, 0xca, 0x7c),
    sunCore: rgb(0xff, 0xf2, 0xcc),
    trunk: rgb(0x8a, 0x6a, 0x4e),
    leaf: rgb(0x86, 0xb1, 0x7a),
    leafDeep: rgb(0x54, 0x82, 0x55),
    water: rgb(0x6f, 0xb3, 0xd9),
    waterDeep: rgb(0x3d, 0x7f, 0xa8),
  },
  {
    // noon
    skyZenith: rgb(0x3d, 0x87, 0xcc),
    skyHorizon: rgb(0xa9, 0xd8, 0xf2),
    ground: rgb(0x56, 0x88, 0x4a),
    groundDeep: rgb(0x36, 0x5c, 0x33),
    grass: rgb(0x7c, 0xad, 0x5c),
    sun: rgb(0xff, 0xe5, 0x8e),
    sunCore: rgb(0xff, 0xfc, 0xe8),
    trunk: rgb(0x99, 0x77, 0x58),
    leaf: rgb(0x93, 0xc4, 0x85),
    leafDeep: rgb(0x60, 0x94, 0x60),
    water: rgb(0x7c, 0xc4, 0xe8),
    waterDeep: rgb(0x47, 0x90, 0xb8),
  },
  {
    // dusk
    skyZenith: rgb(0x5c, 0x3d, 0x78),
    skyHorizon: rgb(0xf4, 0x79, 0x3f),
    ground: rgb(0x46, 0x52, 0x3c),
    groundDeep: rgb(0x2b, 0x33, 0x28),
    grass: rgb(0x5f, 0x71, 0x48),
    sun: rgb(0xff, 0x7a, 0x42),
    sunCore: rgb(0xff, 0xc0, 0x72),
    trunk: rgb(0x6b, 0x4c, 0x3c),
    leaf: rgb(0x6f, 0x85, 0x60),
    leafDeep: rgb(0x46, 0x56, 0x40),
    // 노을이 비쳐 물빛이 보라로 돈다.
    water: rgb(0x8a, 0x7b, 0xb0),
    waterDeep: rgb(0x4e, 0x3f, 0x70),
  },
  {
    // night
    skyZenith: rgb(0x0c, 0x10, 0x2b),
    skyHorizon: rgb(0x22, 0x27, 0x50),
    ground: rgb(0x1a, 0x25, 0x23),
    groundDeep: rgb(0x10, 0x17, 0x18),
    grass: rgb(0x28, 0x38, 0x2f),
    // 밤에는 해가 지평선 아래라 그려지지 않지만,
    // 해질녘에서 넘어오는 동안 보간되므로 값은 있어야 한다.
    sun: rgb(0xb0, 0x4a, 0x2e),
    sunCore: rgb(0xd9, 0x76, 0x4a),
    trunk: rgb(0x2f, 0x2a, 0x26),
    leaf: rgb(0x35, 0x47, 0x3a),
    leafDeep: rgb(0x20, 0x2d, 0x27),
    water: rgb(0x2a, 0x35, 0x60),
    waterDeep: rgb(0x18, 0x20, 0x40),
  },
];

/** 달과 별은 시간대와 무관하게 같은 색을 쓴다. */
export const MOON = rgb(0xdf, 0xe6, 0xf2);
export const MOON_CORE = rgb(0xff, 0xff, 0xff);
export const MOON_CRATER = rgb(0xb9, 0xc4, 0xd8);

export const STAR = rgb(0xff, 0xff, 0xff);
export const STAR_DIM = rgb(0xb8, 0xc4, 0xe0);

/**
 * 잔여율 숫자.
 *
 * 단계별 팔레트에 넣지 않는다. 하늘이 아침이든 밤이든 똑같이 읽혀야 하는데,
 * 배경을 따라 색이 바뀌면 어느 시간대에서는 반드시 묻힌다.
 * 밝은 글자에 어두운 외곽선을 둘러 배경과 무관하게 떼어낸다.
 */
/**
 * 밝기를 네 단계로 나눈다. 잔여율 숫자가 가장 밝고, 라벨과 둘째 줄이
 * 차례로 죽는다. 라벨까지 같은 밝기면 숫자를 찾는 데 시간이 걸린다.
 */
export const READOUT_VALUE = rgb(0xfb, 0xf8, 0xf0);
export const READOUT_LABEL = rgb(0xb5, 0xac, 0x9a);
export const READOUT_SUB_VALUE = rgb(0x9e, 0x97, 0x88);
export const READOUT_SUB_LABEL = rgb(0x82, 0x7b, 0x6e);
export const READOUT_OUTLINE = rgb(0x1a, 0x16, 0x12);
/** 직전 값을 들고 있다는 표시. 개발 패널의 stale 색과 맞춘다. */
export const READOUT_STALE = rgb(0xe0, 0xa2, 0x4e);

export function rgbToCss({ r, g, b }: Rgb): string {
  return `rgb(${r} ${g} ${b})`;
}

export function lerpRgb(a: Rgb, b: Rgb, t: number): Rgb {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return {
    r: Math.round(a.r + (b.r - a.r) * k),
    g: Math.round(a.g + (b.g - a.g) * k),
    b: Math.round(a.b + (b.b - a.b) * k),
  };
}

function lerpPalette(a: ScenePalette, b: ScenePalette, t: number): ScenePalette {
  return {
    skyZenith: lerpRgb(a.skyZenith, b.skyZenith, t),
    skyHorizon: lerpRgb(a.skyHorizon, b.skyHorizon, t),
    ground: lerpRgb(a.ground, b.ground, t),
    groundDeep: lerpRgb(a.groundDeep, b.groundDeep, t),
    grass: lerpRgb(a.grass, b.grass, t),
    sun: lerpRgb(a.sun, b.sun, t),
    sunCore: lerpRgb(a.sunCore, b.sunCore, t),
    trunk: lerpRgb(a.trunk, b.trunk, t),
    leaf: lerpRgb(a.leaf, b.leaf, t),
    leafDeep: lerpRgb(a.leafDeep, b.leafDeep, t),
    water: lerpRgb(a.water, b.water, t),
    waterDeep: lerpRgb(a.waterDeep, b.waterDeep, t),
  };
}

/** 궤도 위치에 해당하는 팔레트. 이웃한 두 단계 사이를 보간한다. */
export function paletteAtOrbit(orbit: number): ScenePalette {
  const wrapped = wrapOrbit(orbit);
  const index = Math.floor(wrapped) % PHASE_COUNT;
  const next = (index + 1) % PHASE_COUNT;

  return lerpPalette(
    PHASE_PALETTES[index],
    PHASE_PALETTES[next],
    wrapped - Math.floor(wrapped),
  );
}

/**
 * 캐릭터 팔레트.
 *
 * 문자 하나가 색 하나이며 스프라이트 정의의 문자와 짝을 이룬다.
 * 캐릭터를 갈아끼울 때는 스프라이트와 이 팔레트를 함께 교체한다.
 *
 * 형태는 색 배치가 만든다. 진한 갈색 외곽선이 실루엣을 잡고,
 * 주둥이·배·발의 밝은 베이지 블록이 그 안에서 덩어리를 나눈다.
 * 명암은 어두운 쪽부터 o < d < b < l 네 단계다.
 */
export const QUOKKA_PALETTE: Readonly<Record<string, Rgb>> = {
  /** 외곽선. 실루엣을 잡아주는 가장 중요한 색이라 확실히 어둡게. */
  o: rgb(0x3a, 0x28, 0x20),
  /** 머리 윗면과 몸 가장자리의 어두운 갈색. */
  d: rgb(0x6f, 0x4c, 0x36),
  /** 몸통 전체의 중간 갈색. */
  b: rgb(0x9c, 0x6f, 0x4a),
  /** 주둥이·배·앞발의 밝은 베이지. */
  l: rgb(0xe0, 0xb8, 0x8c),
  /** 귀 안쪽. 살짝 붉은 기가 도는 갈색. */
  k: rgb(0xb5, 0x70, 0x5f),
  /** 눈. */
  e: rgb(0x2b, 0x1d, 0x14),
  /** 눈 하이라이트. 이게 있어야 눈이 살아난다. */
  w: rgb(0xff, 0xff, 0xff),
  /** 코. */
  n: rgb(0x4a, 0x33, 0x2a),
  /** 입. */
  s: rgb(0x4a, 0x33, 0x2a),
};
