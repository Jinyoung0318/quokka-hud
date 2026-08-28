/**
 * 캔버스 위에 겹치는 사용량 표시.
 *
 * 앱 안에서는 잔여율로 다니고 여기서 화면에 찍을 때만 사용량으로 뒤집는다.
 * 뒤집는 계산은 usageReadout.ts 의 formatUsage() 한 곳에 있다.
 *
 * 85x85 캔버스 안에 픽셀 폰트로 찍어봤지만 3x5 글자를 4배로 키우면 소문자가
 * 뭉개져 읽히지 않았다. 그래서 평범한 글꼴을 캔버스 위에 얹는다.
 * 크기는 창 배율을 따라간다(styles.css 의 --readout-*). 1배 창에서는 두 줄이
 * 다 들어가지 않아 라벨과 갱신 시각을 접고 값만 남긴다. 그 규칙도 CSS 에 있다.
 *
 * 배경이 시간대에 따라 밝아지고 어두워지므로 외곽선이 없으면 어느 쪽에서든
 * 묻힌다. 캔버스에서는 픽셀로 둘렀지만 여기서는 text-shadow 로 두른다.
 *
 * 자리는 왼쪽 아래다(styles.css). 해가 왼쪽에서 떠서 가운데로 올라가는
 * 궤도라 위쪽은 반드시 부딪히고, 지평선 아래 땅은 오른쪽에 연못만 있다.
 *
 * 드래그 영역을 가리지 않도록 pointer-events 를 꺼둔다(styles.css).
 * 마크업은 index.html 에 있고 이 파일은 값만 채운다.
 */

import {
  formatUsage,
  formatSyncValue,
  type UsageReadout,
} from "../usageReadout";

export interface ReadoutOverlayHandle {
  /** null 을 넘기면 통째로 감춘다. */
  update(readout: UsageReadout | null): void;
  remove(): void;
}

export function mountReadoutOverlay(root: HTMLElement): ReadoutOverlayHandle {
  const usage = root.querySelector<HTMLElement>('[data-readout="usage"]');
  const sync = root.querySelector<HTMLElement>('[data-readout="sync"]');
  const stale = root.querySelector<HTMLElement>('[data-readout="stale"]');
  const syncLine = root.querySelector<HTMLElement>(".readout__line--sync");

  if (!usage || !sync || !stale || !syncLine) {
    throw new Error("숫자 표시 마크업이 index.html 과 맞지 않습니다");
  }

  return {
    update(readout) {
      if (readout === null) {
        root.hidden = true;
        return;
      }

      root.hidden = false;
      // 안에서는 잔여율로 다니고 화면에 찍을 때만 사용량으로 뒤집는다.
      usage.textContent = formatUsage(readout.remainingPct);
      stale.hidden = !readout.stale;

      const value = readout.updatedAt === null ? null : formatSyncValue(readout.updatedAt);
      if (value === null) {
        // 조회에서 온 값이 아니면 시각 줄을 아예 감춘다.
        syncLine.hidden = true;
        return;
      }

      syncLine.hidden = false;
      sync.textContent = value;
    },

    remove() {
      root.hidden = true;
    },
  };
}
