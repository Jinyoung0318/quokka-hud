/**
 * 지금 브라우저에서 도는지 Tauri 창에서 도는지 구분한다.
 *
 * 같은 코드가 두 곳에서 도는데 요구가 반대인 것이 몇 가지 있다.
 * 창은 투명해야 하지만 브라우저에서는 투명한 배경 위에 반투명 HUD 를 얹어봐야
 * 아무것도 확인할 수 없고, 개발 패널은 브라우저에서는 필요하지만 340x340 창에는
 * 들어갈 자리가 없다.
 *
 * 갈라지는 곳마다 조건문을 흩어놓지 않고, 문서 최상위에 표시를 한 번 달아둔 뒤
 * 나머지는 CSS 가 알아서 갈라지게 한다.
 */

import { isTauri } from "@tauri-apps/api/core";

/**
 * Tauri 창 안인가.
 *
 * isTauri() 는 window 에 Tauri 가 심어둔 표시를 보기만 하므로
 * 브라우저에서 불러도 안전하다. IPC 를 건드리지 않는다.
 */
export const IS_TAURI: boolean = isTauri();

/**
 * <html> 에 data-runtime 을 달아 CSS 가 두 환경을 가를 수 있게 한다.
 *
 * 첫 페인트 전에 불러야 한다. 창에서 체커보드가 한 프레임이라도 칠해지면
 * 투명 창에 회색이 번쩍인다. 기본값을 투명으로 두었으므로 표시가 늦어도
 * 창 쪽이 잘못 칠해지는 일은 없다.
 */
export function markRuntime(): void {
  document.documentElement.dataset.runtime = IS_TAURI ? "tauri" : "browser";
}
