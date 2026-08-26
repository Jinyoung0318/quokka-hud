/**
 * 렌더 루프.
 *
 * 화면 갱신(60fps)과 스프라이트 프레임 인덱스(8fps)를 분리한다.
 * 고주사율 모니터에서 rAF 가 120번 넘게 불려도 화면은 60fps 로 유지되고,
 * tick 은 화면 갱신률과 무관하게 초당 8번만 올라간다.
 */

/** 화면 갱신 목표. */
export const RENDER_FPS = 60;

/** 스프라이트 프레임 인덱스가 올라가는 속도. */
export const TICK_FPS = 8;

const RENDER_INTERVAL_MS = 1000 / RENDER_FPS;
const TICK_INTERVAL_MS = 1000 / TICK_FPS;

/** 렌더 함수에 넘어가는 프레임 정보. */
export interface Frame {
  /** 루프 시작부터 흐른 시간(ms). 부드러운 움직임에 쓴다. */
  time: number;
  /** 직전 렌더와의 간격(ms). */
  delta: number;
  /**
   * 8fps 로 증가하는 정수.
   * 스프라이트 프레임 인덱스이자 요소별 미세 애니메이션의 기준값이다.
   * 요소마다 이 값을 서로 다른 주기로 나눠 쓴다.
   */
  tick: number;
}

/**
 * 루프를 시작하고 정지 함수를 돌려준다.
 * 캐릭터는 멈추면 고장난 것처럼 보이므로 루프 자체는 계속 돈다.
 */
export function startRenderLoop(onFrame: (frame: Frame) => void): () => void {
  let rafId = 0;
  let running = true;

  let startTime = 0;
  let lastTime = 0;
  let lastRenderTime = 0;

  let tickAccumulator = 0;
  let tick = 0;

  const step = (now: number) => {
    if (!running) return;
    rafId = requestAnimationFrame(step);

    if (startTime === 0) {
      startTime = now;
      lastTime = now;
      lastRenderTime = now;
    }

    const delta = now - lastTime;
    lastTime = now;

    // tick 은 화면을 그리든 안 그리든 시간에 비례해 올라간다.
    tickAccumulator += delta;
    while (tickAccumulator >= TICK_INTERVAL_MS) {
      tickAccumulator -= TICK_INTERVAL_MS;
      tick += 1;
    }

    // 화면 갱신은 60fps 로 제한한다.
    const sinceRender = now - lastRenderTime;
    if (sinceRender < RENDER_INTERVAL_MS) {
      return;
    }
    lastRenderTime = now;

    onFrame({
      time: now - startTime,
      delta: sinceRender,
      tick,
    });
  };

  rafId = requestAnimationFrame(step);

  return () => {
    running = false;
    cancelAnimationFrame(rafId);
  };
}
