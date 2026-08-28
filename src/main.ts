import { markRuntime } from "./runtime";
import { bindWindowControls } from "./titlebar/windowControls";
import { mountScaleButton } from "./titlebar/scaleButton";
import { createPixelCanvas } from "./render/canvas";
import { startRenderLoop } from "./render/loop";
import { drawScene } from "./render/scene";
import { SceneDirector } from "./state/director";
import { phaseIndexOf, phaseOf, snapRemaining } from "./state/skyState";
import { quokkaIdle } from "./sprites/quokka";
import type { UsageReadout } from "./usageReadout";
import { mountReadoutOverlay } from "./overlay/readoutOverlay";
import { mountPollingButton } from "./overlay/pollingButton";
import { mountGuidance } from "./overlay/guidance";
import { diagnosticsPath, recordFailure } from "./collector/diagnostics";
import { DEFAULT_POLL_MINUTES, pollIntervalMs } from "./pollInterval";
import { createUsageSource, setMockDraining, setSourceMode } from "./collector/source";
import type { BrowserSourceMode } from "./collector/browserSource";
import { startUsagePolling, type UsagePollerHandle } from "./collector/poller";

// 개발용 도구. 제거할 때는 이 import 와 아래 "개발용" 표시가 붙은 자리를 지운다.
import { mountUsageSlider } from "./dev/usageSlider";
import { drawZoomedSprite, mountSpriteZoomToggle } from "./dev/spriteZoom";
import {
  mountUsageMonitor,
  controllerFor,
  MOCK_POLL_INTERVAL_MS,
} from "./dev/usageMonitor";

/**
 * 첫 조회가 도착하기 전까지 씬이 서 있을 자리.
 *
 * 숫자는 이 값을 쓰지 않는다. 조회 전에는 화면에 아무 숫자도 띄우지 않는다.
 * 예전에는 이 값이 그대로 "Usage 0%" 로 찍혀서, CLI 가 없는 사람에게는
 * 실패가 "한도가 넉넉함" 으로 보였다. 모르는 것과 여유로운 것은 달라야 한다.
 */
const INITIAL_REMAINING_PCT = 100;

/*
 * 브라우저인지 Tauri 창인지 <html> 에 표시한다.
 * DOMContentLoaded 를 기다리지 않는다. 그 안에서 하면 배경이 이미 한 번
 * 칠해진 뒤라 창에서 번쩍인다.
 */
markRuntime();

window.addEventListener("DOMContentLoaded", () => {
  bindWindowControls();
  void mountScaleButton();

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
   * 화면 왼쪽 아래에 띄울 숫자.
   *
   * 캐릭터는 스냅된 단계를 보여주지만 숫자는 원래 값을 그대로 보여준다.
   * 화면을 잡고 있는 쪽의 값을 띄운다. 캐릭터와 숫자가 다른 값을 가리키면
   * 무엇을 믿어야 할지 알 수 없다.
   *
   * null 은 "아직 모른다" 다. 조회 전에 아무 숫자나 띄우면 그것이 값으로
   * 읽힌다. 이 자리에 100 을 두었더니 CLI 가 없는 화면이 "Usage 0%" 로
   * 보였다 — 실패가 아니라 여유로 읽히는 값이었다.
   */
  let readout: UsageReadout | null = null;

  /** 값이 바뀔 때마다 캔버스 위 오버레이에 반영한다. null 이면 감춘다. */
  const syncReadout = () => {
    overlay.update(readout);
  };

  const guidance = mountGuidance({
    onRetry: () => {
      guidance.setBusy(true);
      poller?.pollNow();
    },
  });

  // 진단 기록 자리는 한 번만 물어본다. 앱이 도는 동안 바뀌지 않는다.
  void diagnosticsPath().then((path) => guidance.setLogPath(path));

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

  /**
   * 지금 폴링 주기(분).
   *
   * 실제 값은 Rust 가 들고 있고 버튼이 물어봐서 알려준다. 그 답이 오기 전
   * 첫 조회에는 기본값을 쓴다. 폴러가 예약할 때마다 다시 물어보므로
   * 늦게 도착해도 다음 회차부터 반영된다.
   */
  let pollMinutes = DEFAULT_POLL_MINUTES;

  void mountPollingButton({
    onChange: (minutes, changed) => {
      pollMinutes = minutes;
      // 바꾼 주기가 곧바로 걸리도록 한 번 돈다. 시작할 때 저장된 값을
      // 읽어온 경우는 이미 시작 조회가 돌고 있으므로 부르지 않는다.
      if (changed) poller?.pollNow();
    },
  });

  const slider = mountUsageSlider({
    initial: INITIAL_REMAINING_PCT,
    onChange: (value) => {
      // 목 흐름 중에는 슬라이더가 꺼져 있어 여기까지 오지 않지만,
      // 규칙이 한 곳에만 있도록 여기서도 막는다.
      if (mockFlowing()) return;
      manualOverride = true;
      applyUsage(value);
      // 슬라이더가 값을 만들었으므로 안내는 물러난다.
      guidance.hide();
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
    intervalMs: () => (mockFlowing() ? MOCK_POLL_INTERVAL_MS : pollIntervalMs(pollMinutes)),
    onSnapshot: (snapshot) => {
      monitor.update(snapshot, source.name); // 개발용
      // 값이 왔으니 안내는 물러난다. stale 로 온 것이어도 보여줄 값은 있다.
      guidance.hide();
      guidance.setBusy(false);
      if (controllerNow() !== "collector") return;
      applyUsage(snapshot.remainingPct);
      readout = {
        remainingPct: snapshot.remainingPct,
        updatedAt: snapshot.fetchedAt,
        stale: snapshot.stale,
      };
      syncReadout();
    },

    onFailure: (failure, everSucceeded) => {
      // 원인은 무조건 파일로 남긴다. GUI 앱이라 이것 말고는 볼 방법이 없다.
      recordFailure(failure);
      guidance.setBusy(false);

      // 한 번이라도 값을 받아봤으면 마지막 값을 stale 로 두는 편이 낫다.
      // 볼 수 있던 것을 안내로 덮을 이유가 없다.
      if (everSucceeded) return;

      // 개발용 슬라이더가 화면을 잡고 있으면 그쪽이 값을 만들고 있다.
      if (controllerNow() !== "collector") return;

      guidance.show(failure.kind);
    },
  });
});
