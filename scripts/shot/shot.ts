/**
 * 장면 하나를 그리고 멈춘다. capture.mjs 가 이 페이지를 찍는다.
 *
 * 앱의 일부가 아니다. 프로덕션 번들에 들어가지 않고, 앱 코드도 이 파일을
 * 모른다. 의존은 한 방향이다 — 이쪽이 앱을 가져다 쓴다.
 *
 * 세 가지를 실제 것으로 쓴다.
 *   마크업  index.html 을 ?raw 로 읽어 <main class="hud"> 만 떼어 쓴다
 *   CSS     src/styles.css 를 그대로 건다(shot.html)
 *   렌더    drawScene · SceneDirector · 실제 스프라이트
 *
 * 그래서 화면이 바뀌면 여기도 저절로 따라온다. 마크업을 베껴 두면
 * 언젠가 창과 그림이 다른 것을 보여주게 된다.
 */

import indexHtml from "../../index.html?raw";

import { createPixelCanvas } from "../../src/render/canvas";
import { drawScene } from "../../src/render/scene";
import { SceneDirector } from "../../src/state/director";
import { phaseIndexOf } from "../../src/state/skyState";
import { quokkaIdle } from "../../src/sprites/quokka";
import { mountReadoutOverlay } from "../../src/overlay/readoutOverlay";
import { formatPollValue, DEFAULT_POLL_MINUTES } from "../../src/pollInterval";
import { applyUiScale } from "../../src/uiScale";
import quokkaIdleImage from "../../src/assets/quokka_idle.png";

import { SCENES, SHOT_SCALE, SHOT_UPDATED_AT, type Scene } from "./scenes";

function sceneFromQuery(): Scene {
  const name = new URLSearchParams(location.search).get("scene");
  const found = SCENES.find((scene) => scene.name === name);
  if (!found) {
    throw new Error(`모르는 장면입니다: ${name}. 고를 수 있는 것: ${SCENES.map((s) => s.name).join(", ")}`);
  }
  return found;
}

/** index.html 에서 창 내용만 떼어낸다. */
function hudMarkup(): string {
  const parsed = new DOMParser().parseFromString(indexHtml, "text/html");
  const hud = parsed.querySelector(".hud");
  if (!hud) throw new Error("index.html 에서 .hud 를 찾지 못했습니다");
  return hud.outerHTML;
}

/**
 * 스프라이트가 다 실릴 때까지 기다린다.
 *
 * createImageSprite 는 이미지를 비동기로 싣고 그 전에는 조용히 넘어간다.
 * 기다리지 않고 그리면 쿼카가 없는 그림이 나온다 — 빈 화면이 아니라
 * 나머지가 멀쩡해서 알아채기 어렵다.
 */
async function waitForSprites(): Promise<void> {
  const image = new Image();
  image.src = quokkaIdleImage;
  await image.decode();
  // 같은 URL 이라 스프라이트 쪽 load 도 곧 뜬다. 한 번 양보해 그것까지 받는다.
  await new Promise((resolve) => setTimeout(resolve, 50));
}

async function main(): Promise<void> {
  const scene = sceneFromQuery();

  /*
   * data-runtime 을 걸지 않는다.
   *
   * "tauri" 로 두면 .hud 가 100vw/100vh 가 되는데, 헤드리스 브라우저는
   * --window-size 로 준 값보다 큰 최소 창 크기를 쓴다(여기서는 488px).
   * 그러면 .hud 가 뷰포트만큼 커지고 캔버스도 같이 늘어나, 255x255 로
   * 찍힌 그림은 씬의 왼쪽 절반만 확대해 담게 된다. 연못과 오른쪽 버튼이
   * 통째로 잘려나간다.
   *
   * 표시를 걸지 않으면 .hud 가 --hud-size(85 x 배율 = 255px)로 서고
   * 창 크기와 무관해진다. shot.html 이 가운데 정렬을 꺼서 좌상단에 붙으므로
   * 255x255 스크린샷이 창 내용과 정확히 일치한다.
   */
  applyUiScale(SHOT_SCALE);

  document.body.innerHTML = hudMarkup();

  const stage = document.querySelector<HTMLElement>(".hud__stage");
  const readoutRoot = document.querySelector<HTMLElement>("[data-readout-root]");
  if (!stage || !readoutRoot) throw new Error("가져온 마크업에 필요한 자리가 없습니다");

  // 버튼 라벨은 Rust 가 채우는 값이라 여기서 직접 넣는다.
  const scaleButton = document.querySelector<HTMLElement>("[data-titlebar-action='cycle-scale']");
  if (scaleButton) scaleButton.textContent = `${SHOT_SCALE}x`;
  const pollValue = document.querySelector<HTMLElement>('[data-polling="value"]');
  if (pollValue) pollValue.textContent = formatPollValue(DEFAULT_POLL_MINUTES);

  mountReadoutOverlay(readoutRoot).update({
    remainingPct: scene.remainingPct,
    updatedAt: SHOT_UPDATED_AT,
    stale: false,
  });

  await waitForSprites();

  /*
   * 만들기만 하고 advance 하지 않는다. 그러면 궤도가 목표 단계에 서 있고
   * 연출은 resting — 쿼카가 가운데(home)에 있는 정지 상태다.
   * 전환 중간이나 미세 애니메이션의 어중간한 위상이 찍히지 않는다.
   */
  const director = new SceneDirector(phaseIndexOf(scene.remainingPct));
  const ctx = createPixelCanvas(stage);

  // tick 0 은 idle 첫 프레임, time 0 은 미세 애니메이션의 기준점.
  // 네 장이 모두 같은 위상으로 찍힌다.
  drawScene(ctx, director.orbit, director.choreography, { time: 0, delta: 0, tick: 0 }, quokkaIdle);

  document.documentElement.dataset.shotReady = scene.name;
}

void main().catch((error) => {
  document.documentElement.dataset.shotError = String(error);
  throw error;
});
