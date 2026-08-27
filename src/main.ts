import { bindWindowControls } from "./titlebar/windowControls";
import { createPixelCanvas } from "./render/canvas";
import { startRenderLoop } from "./render/loop";
import { drawScene } from "./render/scene";
import { SceneDirector } from "./state/director";
import { phaseIndexOf, phaseOf, snapRemaining } from "./state/skyState";
import { quokkaIdle } from "./sprites/quokka";
import { createUsageSource } from "./collector/source";
import { startUsagePolling } from "./collector/poller";

// 개발용 도구. 제거할 때는 이 import 와 아래 mount 호출, zoomed 분기를 지운다.
import { mountUsageSlider } from "./dev/usageSlider";
import { drawZoomedSprite, mountSpriteZoomToggle } from "./dev/spriteZoom";

/** 첫 조회가 도착하기 전까지 보여줄 값. */
const INITIAL_REMAINING_PCT = 100;

window.addEventListener("DOMContentLoaded", () => {
  bindWindowControls();

  const stage = document.querySelector<HTMLElement>(".hud__stage");
  if (!stage) {
    throw new Error(".hud__stage 를 찾을 수 없습니다");
  }

  const ctx = createPixelCanvas(stage);
  const director = new SceneDirector(phaseIndexOf(INITIAL_REMAINING_PCT));

  /** 새 잔여율을 받았을 때의 처리. */
  const applyUsage = (remainingPct: number) => {
    director.setPhase(phaseIndexOf(remainingPct));
  };

  /**
   * 개발용 슬라이더를 한 번이라도 건드리면 그쪽이 화면을 잡는다.
   *
   * 폴링과 슬라이더가 같은 화면을 두고 다투면 손으로 맞춰놓은 값이
   * 다음 조회에 되돌아가 버린다. 그래서 한쪽만 화면을 잡는다.
   */
  let manualOverride = false;

  let zoomed = false;

  startRenderLoop((frame) => {
    director.advance(frame.delta);

    if (zoomed) {
      drawZoomedSprite(ctx, quokkaIdle, frame);
      return;
    }

    drawScene(ctx, director.orbit, director.choreography, frame, quokkaIdle);
  });

  const source = createUsageSource();

  startUsagePolling({
    source,
    onSnapshot: (snapshot) => {
      if (manualOverride) return;
      applyUsage(snapshot.remainingPct);
    },
  });

  mountUsageSlider({
    initial: INITIAL_REMAINING_PCT,
    onChange: (value) => {
      manualOverride = true;
      applyUsage(value);
    },
    snap: snapRemaining,
    phase: phaseOf,
  });

  mountSpriteZoomToggle({
    initial: zoomed,
    onChange: (value) => {
      zoomed = value;
    },
  });
});
