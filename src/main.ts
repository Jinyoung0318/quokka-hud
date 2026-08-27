import { bindWindowControls } from "./titlebar/windowControls";
import { createPixelCanvas } from "./render/canvas";
import { startRenderLoop } from "./render/loop";
import { drawScene } from "./render/scene";
import { SceneDirector } from "./state/director";
import { phaseIndexOf, phaseOf, snapRemaining } from "./state/skyState";
import { quokkaIdle } from "./sprites/quokka";

// 개발용 도구. 제거할 때는 이 import 와 아래 mount 호출, zoomed 분기를 지운다.
import { mountUsageSlider } from "./dev/usageSlider";
import { drawZoomedSprite, mountSpriteZoomToggle } from "./dev/spriteZoom";

/** 수집기가 붙기 전까지의 초기값. */
const INITIAL_REMAINING_PCT = 100;

window.addEventListener("DOMContentLoaded", () => {
  bindWindowControls();

  const stage = document.querySelector<HTMLElement>(".hud__stage");
  if (!stage) {
    throw new Error(".hud__stage 를 찾을 수 없습니다");
  }

  const ctx = createPixelCanvas(stage);
  const director = new SceneDirector(phaseIndexOf(INITIAL_REMAINING_PCT));

  /** 새 잔여율을 받았을 때의 처리. 수집기가 붙으면 여기에 연결한다. */
  const applyUsage = (remainingPct: number) => {
    director.setPhase(phaseIndexOf(remainingPct));
  };

  let zoomed = false;

  startRenderLoop((frame) => {
    director.advance(frame.delta);

    if (zoomed) {
      drawZoomedSprite(ctx, quokkaIdle, frame);
      return;
    }

    drawScene(ctx, director.orbit, director.choreography, frame, quokkaIdle);
  });

  mountUsageSlider({
    initial: INITIAL_REMAINING_PCT,
    onChange: applyUsage,
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
