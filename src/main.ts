import { bindWindowControls } from "./titlebar/windowControls";
import { createPixelCanvas } from "./render/canvas";
import { startRenderLoop } from "./render/loop";
import { drawScene } from "./render/scene";
import { SceneDirector } from "./state/director";
import { phaseIndexOf, phaseOf, snapRemaining } from "./state/skyState";
import { quokkaIdle } from "./sprites/quokka";
import type { UsageReadout } from "./usageReadout";
import { mountReadoutOverlay } from "./overlay/readoutOverlay";
import { createUsageSource, setMockDraining, setSourceMode } from "./collector/source";
import type { BrowserSourceMode } from "./collector/browserSource";
import { startUsagePolling, POLL_INTERVAL_MS, type UsagePollerHandle } from "./collector/poller";

// 개발용 도구. 제거할 때는 이 import 와 아래 "개발용" 표시가 붙은 자리를 지운다.
import { mountUsageSlider } from "./dev/usageSlider";
import { drawZoomedSprite, mountSpriteZoomToggle } from "./dev/spriteZoom";
import {
  mountUsageMonitor,
  controllerFor,
  MOCK_POLL_INTERVAL_MS,
} from "./dev/usageMonitor";

/** 첫 조회가 도착하기 전까지 보여줄 값. */
const INITIAL_REMAINING_PCT = 100;

window.addEventListener("DOMContentLoaded", () => {
  bindWindowControls();

  const stage = document.querySelector<HTMLElement>(".hud__stage");
  if (!stage) {
    throw new Error(".hud__stage 를 찾을 수 없습니다");
  }

  const ctx = createPixelCanvas(stage);

  const readoutRoot = document.querySelector<HTMLElement>("[data-readout-root]");
  if (!readoutRoot) {
    throw new Error("[data-readout-root] 를 찾을 수 없습니다");
  }
  const overlay = mountReadoutOverlay(readoutRoot);
  const director = new SceneDirector(phaseIndexOf(INITIAL_REMAINING_PCT));

  /**
   * 화면 왼쪽 위에 띄울 숫자.
   *
   * 캐릭터는 스냅된 단계를 보여주지만 숫자는 원래 값을 그대로 보여준다.
   * 화면을 잡고 있는 쪽의 값을 띄운다. 캐릭터와 숫자가 다른 값을 가리키면
   * 무엇을 믿어야 할지 알 수 없다.
   */
  let readout: UsageReadout = {
    remainingPct: INITIAL_REMAINING_PCT,
    // 아직 조회한 적이 없다. 시각을 붙이면 거짓말이 된다.
    updatedAt: null,
    stale: false,
  };

  /** 값이 바뀔 때마다 캔버스 위 오버레이에 반영한다. */
  const syncReadout = () => {
    overlay.update(readout);
  };

  /** 새 잔여율을 받았을 때의 처리. */
  const applyUsage = (remainingPct: number) => {
    director.setPhase(phaseIndexOf(remainingPct));
  };

  /**
   * 개발용 슬라이더를 한 번이라도 건드렸는가.
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

  // 개발용 — 소스 선택과 목 흐름. 목이 흐를 때만 폴링 주기가 짧아진다.
  let sourceMode: BrowserSourceMode = "cli";
  let mockDraining = false;
  let poller: UsagePollerHandle | null = null;

  /** 목 데이터가 실제로 흐르는 중인가. 실제 CLI 를 쓰는 동안은 아니다. */
  const mockFlowing = () => sourceMode === "mock" && mockDraining;

  const slider = mountUsageSlider({
    initial: INITIAL_REMAINING_PCT,
    onChange: (value) => {
      // 목 흐름 중에는 슬라이더가 꺼져 있어 여기까지 오지 않지만,
      // 규칙이 한 곳에만 있도록 여기서도 막는다.
      if (mockFlowing()) return;
      manualOverride = true;
      applyUsage(value);
      // 조회에서 온 값이 아니므로 갱신 시각을 붙이지 않는다.
      readout = { remainingPct: value, updatedAt: null, stale: false };
      syncReadout();
      syncControl();
    },
    snap: snapRemaining,
    phase: phaseOf,
  });

  // 개발용
  const monitor = mountUsageMonitor({
    initialMode: sourceMode,
    initialMock: mockDraining,

    onModeChange: (mode) => {
      sourceMode = mode;
      setSourceMode(source, mode);
      syncControl();
      // 고른 소스의 값을 바로 보여준다.
      poller?.pollNow();
    },

    onMockChange: (draining) => {
      mockDraining = draining;
      setMockDraining(source, draining);
      syncControl();
      // 주기가 바뀌었으니 예약된 시각을 기다리지 않고 바로 한 번 돈다.
      poller?.pollNow();
    },
  });

  /** 규칙은 controllerFor() 에 있다. 여기서는 화면에 반영만 한다. */
  const controllerNow = () => controllerFor(mockFlowing(), manualOverride);

  const syncControl = () => {
    // 지는 쪽은 아예 만질 수 없게 한다. 움직여도 아무 일이 없으면
    // 고장난 것으로 보인다.
    slider.setEnabled(!mockFlowing());
    monitor.setMockToggleEnabled(sourceMode === "mock");
    monitor.setController(controllerNow());
  };

  // 개발용
  mountSpriteZoomToggle({
    initial: zoomed,
    onChange: (value) => {
      zoomed = value;
    },
  });

  syncReadout();
  syncControl(); // 개발용

  poller = startUsagePolling({
    source,
    // 개발용 — 목이 흐를 때만 짧게. 실제 CLI 는 한 번에 7초쯤 걸려서
    // 짧은 주기로 부르면 계속 겹친다.
    intervalMs: () => (mockFlowing() ? MOCK_POLL_INTERVAL_MS : POLL_INTERVAL_MS),
    onSnapshot: (snapshot) => {
      monitor.update(snapshot, source.name); // 개발용
      if (controllerNow() !== "collector") return;
      applyUsage(snapshot.remainingPct);
      readout = {
        remainingPct: snapshot.remainingPct,
        updatedAt: snapshot.fetchedAt,
        stale: snapshot.stale,
      };
      syncReadout();
    },
  });
});
