# NOTES

Claude Code가 작업 중 발견한 스펙 변경·판단·제약을 여기에 남긴다.
사용자가 이 내용을 대화 쪽 Claude에게 전달해 Notion(설계 문서 · 결정 기록 · 작업 로그)에 반영한다.

**형식**

```
- [YYYY-MM-DD] 무엇이 어떻게 바뀌었는지 · 왜
```

**남길 것**

- CLAUDE.md의 스펙과 실제 구현이 달라진 경우 (필드 추가, 임계값 변경 등)
- "절대 하지 말 것"에 걸려 다른 방법을 택한 경우
- 조사 결과 불가능하다고 판명된 것
- 새로 내린 설계 판단과 그 이유

**남기지 않을 것**

- 단순 버그 수정, 리팩터링, 포맷팅
- 커밋 메시지로 충분한 내용

Notion에 반영이 끝난 항목은 아래 목록에서 지운다. 이 파일은 큐이지 아카이브가 아니다.

---

## 반영 대기

<!-- 여기에 append -->
- [2026-08-26] 쿼카 색이 배경보다 채도가 높아 붕 뜸. 팔레트 통일 시 반 톤 낮출 것
- [2026-08-26] 캐릭터 발이 지평선보다 아래라 풀에 잠겨 보임. y 좌표 1~2px 올릴 것
- [2026-08-26] 다음 스프라이트 작업: 자는 자세(밤), 하품(해질녘), idle 2번째 프레임
- [2026-08-27] 수집기 파싱 로직을 TypeScript로 작성 (src/collector/parseUsage.ts). 이 PC에서 Rust 빌드가 막혀 검증이 불가능해서. Rust 이식 또는 Node 사이드카 중 어느 쪽으로 갈지는 macOS에서 프로세스 실행을 붙일 때 결정
- [2026-08-27] `claude -p "/usage"`가 비대화형으로 사용량 출력을 stdout에 그대로 뱉는 것을 확인. PTY나 터미널 에뮬레이션이 필요 없고 평범한 프로세스 실행 + stdout 캡처로 충분. 당초 예상했던 방식보다 훨씬 단순함
- [2026-08-27] Tauri 전까지 브라우저에서 실제 값을 보려고 Vite 개발 서버에 /__dev/usage 엔드포인트를 둠. Tauri로 가면 Rust가 대신하므로 제거 대상
- [2026-08-27] `claude -p "/usage"` 호출은 사용량에 카운트되지 않음 확인 (requests 322 → 322). 5분 폴링 안전
- [2026-08-27] Windows에서 claude는 claude.cmd라 shell: true 필요. macOS/Linux는 불필요
- [2026-08-27] 캔버스 안 픽셀 폰트는 4배 확대 시 뭉개져 판독 불가. HTML 오버레이 + text-shadow 외곽선으로 확정. 위치는 좌하단(해 궤도와 충돌 회피)
- [2026-08-27] Tauri 창 설정 확정: 340x340 · decorations false · transparent · alwaysOnTop · resizable false · 작업표시줄 표시. CLAUDE.md UI 사양의 "우상단에 최소화·크기변경·닫기"와 충돌 — 크기 고정이라 크기변경 버튼은 두지 않음. 스펙 쪽 문구를 정리할 것
- [2026-08-27] core:window:default 는 읽기 전용 게터만 준다(is-*, inner-size 등). 드래그·최소화·닫기는 capabilities 에 allow-start-dragging / allow-minimize / allow-close 를 따로 켜야 동작. 안 켜면 조용히 아무 일도 안 일어남
- [2026-08-27] 캔버스가 창 전체를 덮어 드래그가 거의 전 면적에서 먹지 않았음. Tauri 는 마우스를 누른 바로 그 요소에 속성이 있는지만 본다(bare 속성 기준). .hud__canvas 에 pointer-events:none 을 줘서 .hud__stage 가 대상이 되게 해결. 같은 이유로 자식이 늘어나면 data-tauri-drag-region="deep" 을 고려할 것
- [2026-08-27] 브라우저/Tauri 분기를 <html data-runtime> 한 곳으로 모음(src/runtime.ts). 체커보드 배경은 브라우저에서만, 개발 패널도 브라우저에서만. 창을 늘려 패널을 같이 띄우면 실제 창 모양을 확인할 수 없어서 숨기는 쪽을 택함
- [2026-08-27] Tauri 수집기를 Rust 로 붙임(src-tauri/src/collector/mod.rs). claude CLI 실행만 하고 stdout 원문을 그대로 프론트에 넘긴다. 파싱은 TypeScript 파서 하나만 둠 — Rust 에도 두면 ANSI 제거·사용률 뒤집기·연도 없는 날짜 추론까지 두 벌이 되어 조용히 어긋난다. CLAUDE.md 대로 Rust 가 폴링까지 맡고 emit 으로 넘기게 될 때 파서도 같이 옮길 것
- [2026-08-27] 수집기 선택 순서를 Tauri → Node → 브라우저로 둠. tauri dev 에서는 웹뷰가 Vite 개발 서버를 보고 있어 둘 다 쓸 수 있는데, 그때도 빌드된 exe 와 같은 길로 돌아야 개발 중 확인한 것이 배포본에서 그대로 돈다
- [2026-08-27] Tauri 경로는 목 데이터로 폴백하지 않는다. 실제 창에 가짜 값을 띄우면 그게 진짜인 줄 알게 된다. 실패는 직전 값 + stale 표시로 처리(폴링 규칙 그대로)
- [2026-08-27] Rust 쪽 타임아웃은 std 만으로 구현(try_wait 폴링 + kill). wait-timeout 크레이트를 넣지 않음. 커맨드는 async + spawn_blocking — 동기 커맨드로 두면 Tauri 가 메인 스레드에서 돌려 CLI 6초 동안 창이 얼어붙는다
- [2026-08-27] Windows 에서 타임아웃으로 cmd 를 죽여도 그 아래 claude 는 살아남을 수 있다(자식의 자식). 잡 오브젝트를 쓰지 않는 한 남는다. 15초 안에 정상 종료되는 게 정상이라 지금은 두고 봄
- [2026-08-27] 빌드된 exe 로 실제 값 확인 완료 — Remain rate 88% · Sync time 표시됨. Vite 개발 서버 없이 Rust 경로만으로 동작
- [2026-08-27] 창 크기를 트레이 메뉴에서 3~6배(255/340/425/510px)로 고르게 함. 자유 리사이즈를 주지 않는다 — 픽셀 아트라 비정수 배율이면 확대할 때 뭉개진다. CLAUDE.md UI 사양의 "우상단 크기변경 버튼"은 이걸로 대체된 셈이라 문구를 정리할 것
- [2026-08-27] 배율/위치는 %APPDATA%/com.cwhong.quokka-hud/settings.json 한 파일에 저장. 저장할 것이 둘뿐이라 store 플러그인을 붙이지 않음. 위치는 Moved 마다 메모리에만 반영하고 파일은 1초에 한 번까지만 쓴다(드래그 중 초당 수십 번 온다). 닫을 때 flush
- [2026-08-27] Windows 메모장·PowerShell 은 UTF-8 저장 시 BOM 을 붙이는데 serde_json 이 그걸 만나면 실패한다. 손으로 고칠 수 있는 파일이라 읽을 때 BOM 을 벗겨냄. 안 그러면 멀쩡해 보이는 JSON 인데 조용히 기본값으로 돌아간다
- [2026-08-27] `cargo build --release` 만으로 빌드하면 frontendDist 대신 devUrl(localhost)이 심긴 exe 가 나온다. 반드시 `npm run tauri build` 를 거칠 것. 번들만 건너뛰려면 `-- --no-bundle`
- [2026-08-27] 캔버스 배율을 CSS 에서 걷어냄. Tauri 에서는 .hud 가 100vw/100vh 라 창 크기를 따라가고, 창 한 변이 늘 85 의 정수배라 배율이 저절로 정수가 된다. --hud-size(340px)는 브라우저 미리보기용으로만 남음
- [2026-08-27] 트레이 setting 항목은 설정 창이 없어 비활성으로 둠. 켜두고 눌러도 아무 일이 없으면 고장으로 보인다. 3배에서는 잔여율 오버레이와 타이틀바 버튼이 고정 px 이라 상대적으로 커 보임 — 거슬리면 배율에 맞춰 줄일 것
- [2026-08-27] 배율 변경을 src-tauri/src/scale.rs 한 곳으로 모음. 트레이 메뉴와 타이틀바 버튼이 같은 change() 를 지나므로 창 크기 · settings.json · 트레이 체크 표시가 항상 함께 움직인다. 트레이에서 바꾼 경우 `scale-changed` 이벤트로 버튼 라벨까지 따라온다 (CLAUDE.md 의 "Rust → 프론트는 emit" 원칙)
- [2026-08-27] 타이틀바 배율 버튼은 data-window-action 이 아니라 data-titlebar-action 을 쓴다. 앞엣것은 bindWindowControls() 가 훑는 속성이라, 같이 쓰면 매 시작마다 "알 수 없는 action" 경고가 찍힌다
- [2026-08-27] 배율 버튼에 data-tauri-drag-region 을 걸지 않는다. 걸면 누르는 순간 창 드래그로 잡혀 클릭이 먹지 않는다. Tauri 2.11.5 는 BUTTON 을 클릭 요소로 보고 알아서 막아주지만, 속성을 명시적으로 안 거는 쪽이 안전하다
- [2026-08-28] app_config_dir()이 실패하면 진단 로그가 조용히 사라짐. 실제로 그 상황이면 설정도 못 읽는 상태라 우선순위 낮음
- [2026-08-28] Cargo가 icon.ico 변경을 리빌드 트리거로 추적하지 않음. 아이콘을 바꾸면 cargo clean -p quokka-hud 후 빌드해야 exe에 반영됨. exe에서 아이콘을 추출해 대조하는 것이 확실한 검증 방법
