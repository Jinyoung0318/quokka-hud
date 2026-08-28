/**
 * 스크린샷 하네스에서만 쓰는 타입 선언.
 *
 * src/vite-env.d.ts 에 넣지 않는다. ?raw 로 HTML 을 읽는 것은 이 하네스의
 * 사정이고, 앱이 쓸 수 있는 import 형태로 보이면 안 된다.
 */
declare module "*.html?raw" {
  const content: string;
  export default content;
}
