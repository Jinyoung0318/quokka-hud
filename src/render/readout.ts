/**
 * 화면 왼쪽 위의 잔여율 숫자.
 *
 *   Remain rate 59%          큰 폰트. 숫자만 가장 밝게.
 *   Sync time 15:24 (5m)     작은 폰트. 통째로 흐리게.
 *
 * 캐릭터와 하늘은 스냅된 네 단계만 보여준다. 숫자는 그 사이의 정확한 값을
 * 알려주는 자리라, 스냅하지 않은 원래 잔여율을 그대로 쓴다.
 *
 * 자리는 왼쪽 위다. 타이틀바 버튼은 피하지만 **해와는 부딪힌다.**
 * 해가 정오에 화면 위쪽 가운데(대략 x 36~48, y 2~14)를 지나면서 이 자리를
 * 밟고 지나간다. 두 줄이 76칸이나 차지해서 땅으로 내려도 연못에 걸린다.
 *
 * 그래서 실제로 쓰는 것은 HTML 을 겹치는 쪽(overlay/readoutOverlay.ts)이다.
 * 이 파일은 두 방식을 비교하려고 남겨둔 것이고, 개발용 토글로 바꿔 볼 수 있다.
 */

import {
  drawPixelText,
  textWidth,
  LARGE_FONT,
  SMALL_FONT,
} from "./pixelFont";
import {
  rgbToCss,
  READOUT_LABEL,
  READOUT_OUTLINE,
  READOUT_STALE,
  READOUT_SUB_LABEL,
  READOUT_SUB_VALUE,
  READOUT_VALUE,
} from "./palette";
import {
  formatPercent,
  formatSyncValue,
  RATE_LABEL,
  SYNC_LABEL,
  SYNC_EVERY,
  type UsageReadout,
} from "../usageReadout";

export type { UsageReadout };

/**
 * 왼쪽 위 모서리.
 *
 * 외곽선이 한 칸 더 나가므로 실제로는 x-1, y-1 부터 칠해진다.
 * 위로 바짝 붙여야 둘째 줄이 나무 수관에 닿지 않는다.
 */
export const READOUT_X = 2;
export const READOUT_Y = 1;

/** 두 줄 사이 간격. 서로의 외곽선이 닿지 않을 만큼만 띄운다. */
const LINE_GAP = 2;

/** 라벨과 값 사이 간격. 글자 사이 간격(1)보다 넓어야 덩어리가 갈린다. */
const LABEL_GAP = 3;

/** 숫자와 stale 점 사이 간격. */
const DOT_GAP = 2;
const DOT_SIZE = 2;

/** 둘째 줄이 시작하는 y. 다른 요소와 겹치는지 확인할 때 쓴다. */
export const SECOND_LINE_Y = READOUT_Y + LARGE_FONT.height + LINE_GAP;

/** 숫자가 차지하는 세로 끝. 외곽선까지 친 값이다. */
export const READOUT_BOTTOM_Y = SECOND_LINE_Y + SMALL_FONT.height;

export function drawReadout(
  ctx: CanvasRenderingContext2D,
  readout: UsageReadout | null,
): void {
  if (readout === null) return;

  drawRateLine(ctx, readout);

  if (readout.updatedAt !== null) {
    drawSyncLine(ctx, readout.updatedAt);
  }
}

function drawRateLine(
  ctx: CanvasRenderingContext2D,
  readout: UsageReadout,
): void {
  const percent = formatPercent(readout.remainingPct);

  // 라벨은 흐리게, 숫자는 가장 밝게. 화면에서 제일 먼저 눈에 들어와야 한다.
  let x = drawPixelText(
    ctx,
    LARGE_FONT,
    RATE_LABEL,
    READOUT_X,
    READOUT_Y,
    READOUT_LABEL,
    READOUT_OUTLINE,
  );

  x += LABEL_GAP;
  x = drawPixelText(
    ctx,
    LARGE_FONT,
    percent,
    x,
    READOUT_Y,
    READOUT_VALUE,
    READOUT_OUTLINE,
  );

  if (readout.stale) {
    drawStaleDot(ctx, x + DOT_GAP, READOUT_Y + 1);
  }
}

function drawSyncLine(ctx: CanvasRenderingContext2D, updatedAt: string): void {
  const value = formatSyncValue(updatedAt);
  if (value === null) return;

  let x = drawPixelText(
    ctx,
    SMALL_FONT,
    SYNC_LABEL,
    READOUT_X,
    SECOND_LINE_Y,
    READOUT_SUB_LABEL,
    READOUT_OUTLINE,
  );

  x += LABEL_GAP;
  drawPixelText(
    ctx,
    SMALL_FONT,
    value,
    x,
    SECOND_LINE_Y,
    READOUT_SUB_VALUE,
    READOUT_OUTLINE,
  );
}

/**
 * 직전 값을 들고 있다는 표시.
 *
 * 숫자를 흐리게 하는 방법도 있지만, 밤에는 원래도 어두워서 흐린 건지
 * 밤인 건지 구분되지 않는다. 점은 배경과 무관하게 읽힌다.
 */
function drawStaleDot(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = rgbToCss(READOUT_OUTLINE);
  ctx.fillRect(x - 1, y - 1, DOT_SIZE + 2, DOT_SIZE + 2);

  ctx.fillStyle = rgbToCss(READOUT_STALE);
  ctx.fillRect(x, y, DOT_SIZE, DOT_SIZE);
}

/** 둘째 줄 전체 길이. 화면 폭을 넘지 않는지 확인할 때 쓴다. */
export function syncLineWidth(clock = "00:00"): number {
  return (
    textWidth(SMALL_FONT, SYNC_LABEL) +
    LABEL_GAP +
    textWidth(SMALL_FONT, `${clock} ${SYNC_EVERY}`)
  );
}

/** 첫 줄 전체 길이. */
export function rateLineWidth(percent = "100%"): number {
  return (
    textWidth(LARGE_FONT, RATE_LABEL) + LABEL_GAP + textWidth(LARGE_FONT, percent)
  );
}

