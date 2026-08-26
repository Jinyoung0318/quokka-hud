# Quokka (quokka-hud)

Claude 사용량을 데스크탑 캐릭터로 보여주는 HUD. 한도가 남아 있으면 해가 떠 있고 쿼카가 책상에 앉아 있다. 다 쓰면 해가 지고 쿼카는 침대에 눕는다. **숫자를 읽지 않아도 상태가 보이는 것**이 목표.

맥의 RunCat이 CPU 사용률을 고양이 속도로 보여주듯, AI 사용량을 캐릭터의 행동으로 보여준다.

- 개인용 프로젝트. 공개 배포는 미정
- 대상 OS: Windows(주 개발 환경), macOS
- 프로바이더: Claude 하나만

---

## 기술 스택

| 영역 | 선택 |
|---|---|
| 프레임워크 | Tauri v2 (Rust 백엔드 + Web 프론트엔드) |
| 프론트엔드 | Vanilla TS + Vite (프레임워크 없이 시작) |
| 애니메이션 | Canvas 2D 또는 CSS `steps()` |
| 데이터 취득 | Claude Code CLI 프로세스 호출 → 출력 파싱 |

---

## 개발 환경 세팅 (빈 Windows 기준)

관리자 권한 PowerShell에서 순서대로.

```powershell
# 1. Rust 툴체인
winget install Rustlang.Rustup

# 2. Node.js LTS
winget install OpenJS.NodeJS.LTS

# 3. MSVC 빌드 도구 (필수 — 없으면 첫 빌드에서 링커 에러)
winget install Microsoft.VisualStudio.2022.BuildTools
```

**Build Tools는 설치 후 Visual Studio Installer를 열어 "C++를 사용한 데스크톱 개발" 워크로드를 체크해야 한다.** winget 설치만으로는 링커가 들어오지 않는다.

WebView2는 Windows 11에 기본 포함. Windows 10이면 Evergreen 런타임을 따로 설치한다.

설치 후 새 터미널에서 확인:

```powershell
rustc --version
cargo --version
node --version
```

### 프로젝트 초기화

저장소를 clone한 디렉터리에서:

```powershell
npm create tauri-app@latest -- --tauri-version 2
```

- 프로젝트명은 현재 디렉터리(`.`)를 지정
- 프론트엔드 언어: TypeScript
- 프레임워크: Vanilla
- 패키지 매니저: npm

---

## 자주 쓰는 명령

```powershell
npm run tauri dev      # 개발 모드 (핫 리로드)
npm run tauri build    # 배포 빌드
cargo fmt              # src-tauri 에서 Rust 포맷
cargo clippy           # Rust 린트
```

---

## 아키텍처 원칙

```
Claude Code CLI ──5분 폴링──> 수집기(Rust) ──> UsageSnapshot
                                                   │
                                              상태 머신
                                                   │
                                         렌더러(Web) ──> 투명 창 · 스프라이트
```

1. **수집기와 렌더러를 분리한다.** 렌더러는 `UsageSnapshot` 하나만 보며, 데이터가 어디서 왔는지 모른다.
2. **CLI 호출 코드는 `src-tauri/src/collector/` 한 곳에 격리한다.** 취득 경로가 바뀌어도 그 모듈만 교체하면 되도록.
3. **Rust → 프론트는 Tauri `emit` 이벤트로 전달한다.** 별도 HTTP 서버나 SSE를 만들지 않는다.
4. **엔진과 캐릭터를 분리한다.** 코드는 상태 이름(`morning`, `noon`, `dusk`, `night`)만 알고, 스프라이트셋은 폴더 교체로 갈아끼울 수 있어야 한다.

---

## 데이터 계약

```typescript
interface UsageSnapshot {
  remainingPct: number;        // 5시간 창 잔여율 (0~100)
  weeklyRemainingPct: number;  // 주간 잔여율
  resetAt: string | null;      // 리셋 시각
  model: string | null;        // 현재 모델
  fetchedAt: string;           // 갱신 시각
  stale: boolean;              // 조회 실패로 캐시된 값인지
}
```

**필드명은 프로바이더 중립적으로 유지한다.** `claudeRemaining` 같은 이름을 쓰지 않는다.

### 폴링 규칙

- 주기 5분 고정
- 조회 실패 시 **마지막 값을 그대로 유지**하고 `stale = true`
- 429 응답이 오면 다음 시도를 10분 → 20분으로 백오프
- 캐릭터는 멈추지 않는다. 멈추면 고장처럼 보인다

---

## 상태 정의 (v0.1 — 4분할)

| 잔여율 | 상태 | 화면 | 쿼카 |
|---|---|---|---|
| 100~75% | `morning` | 해가 낮게 · 맑음 | 책상에 앉아 작업 |
| 75~50% | `noon` | 해가 가장 높음 | 책상에 앉아 작업 |
| 50~25% | `dusk` | 해가 지평선으로 · 붉은빛 | 하품 · 지친 기색 |
| 25~0% | `night` | 달과 별 | 침대에 누워 잠 |

### 전환 규칙

- **값이 올라가면** → 리셋으로 간주. 해가 순방향으로 한 바퀴 돌아 아침으로 복귀. 절대 역방향으로 되감지 않는다
- **값이 소폭 내려가면** → 정상 소비. 해가 그만큼 전진
- 경계값에는 히스테리시스를 둔다 (약 3%p). 안 그러면 74~75%를 오가며 캐릭터가 벌러덩거린다
- **시스템 시계는 쓰지 않는다.** 해의 위치는 오직 사용량 값으로만 결정된다

---

## UI 사양

- 테두리 없는 작은 **정사각형 창**
- 우상단에 최소화 · 크기변경 · 닫기 (커스텀 타이틀바)
- 버튼 영역을 제외한 나머지를 드래그하면 창 이동 (`data-tauri-drag-region`)
- 배경은 반투명 어두운 회색 (`rgba(20,20,20,0.75)` 정도). 완전 투명은 흰 배경에서 캐릭터가 안 보이고 드래그할 곳을 못 찾는다
- 항상 위 표시
- 트레이 아이콘 메뉴: `setting` / `exit`

---

## 절대 하지 말 것

1. **자격증명을 직접 다루지 않는다.** 로그인 폼을 만들거나 비밀번호를 받지 않는다. `~/.claude/.credentials.json` 같은 토큰 파일을 직접 읽지 않는다. 인증은 사용자의 Claude Code가 이미 해둔 것을 쓴다
2. **비공식 API 엔드포인트를 직접 호출하지 않는다.** 공식 클라이언트(CLI)에 물어보는 방식만 쓴다
3. **바탕화면 아이콘 뒤에 그리려 하지 않는다.** Windows에서 WorkerW 핸들을 찾는 편법은 업데이트마다 깨진다. 항상 위 표시로 충분하다
4. **폴링 주기를 5분보다 짧게 하지 않는다.** 429를 부른다
5. **`.env`, 토큰, 사용량 덤프를 커밋하지 않는다.** `git add .` 대신 `git add -p`

---

## v0.1 범위 밖 (지금 하지 않는다)

- 다중 AI 프로바이더 지원
- 공개 배포 · 설치 패키지
- 상세 설정 UI (트레이 메뉴에 setting/exit 정도만)
- 실시간 토큰 스트림 반응 (타이핑 모션 등)
- 10분할 상태 세분화

---

## 폴더 구조 (목표)

```
quokka-hud/
├── src/                    # 웹 프론트엔드
│   ├── assets/sprites/     # 상태별 스프라이트 시트
│   ├── render/             # 스프라이트 렌더 루프
│   ├── state/              # 상태 머신, 전환 규칙
│   └── titlebar/           # 커스텀 타이틀바, 드래그 영역
├── src-tauri/              # Rust 백엔드
│   ├── src/
│   │   ├── collector/      # CLI 호출, 출력 파싱 (격리 대상)
│   │   ├── snapshot.rs     # UsageSnapshot 정의
│   │   └── main.rs
│   └── tauri.conf.json
└── CLAUDE.md
```

---

## 작업 순서

**화면 먼저, 데이터 나중.** 데이터부터 파면 몇 주 동안 화면에 아무것도 안 뜬다. 가짜 데이터로 캐릭터를 먼저 살려놓는다.

1. **1단계** Tauri 초기화 → 반투명 정사각형 창 → 커스텀 타이틀바 + 드래그 → 스프라이트 렌더 루프 → 4개 상태 수동 전환(개발용 단축키) → 트레이 아이콘
2. **2단계** CLI 호출 및 출력 파싱 → `UsageSnapshot` 확정 → 5분 폴링 · 캐싱 · 백오프
3. **3단계** 상태 머신 연결 · 전환 애니메이션
4. **4단계** (선택) 실시간 반응 · 10분할 확장

---

## 문서

설계 문서와 작업 로그는 Notion에서 관리한다. 스펙이 바뀌면 코드와 함께 Notion도 갱신할 것.
