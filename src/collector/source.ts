/**
 * 사용량을 어디서 가져오는가.
 *
 * 폴링 루프는 이 인터페이스만 보고, 값이 CLI 에서 왔는지 목 데이터인지 모른다.
 * 나중에 Rust 로 옮기든 Node 사이드카로 가든 이 자리만 갈아끼우면 된다.
 */

import type { UsageSnapshot } from "../snapshot";
import { IS_TAURI } from "../runtime";
import { createClaudeCliSource } from "./claudeCli";
import { createTauriSource } from "./tauriSource";
import {
  createBrowserSource,
  type BrowserSourceMode,
  type BrowserUsageSource,
} from "./browserSource";

/**
 * 실패 원인.
 *
 * null 하나로 뭉개면 "설치가 안 됨" 과 "로그인이 안 됨" 이 같은 실패가 된다.
 * 그러면 화면이 사용자에게 무엇을 하라고 말해줄 수 없다.
 *
 *   cli-not-found     PATH 에서 claude 를 찾지 못했다. 설치가 필요하다
 *   unexpected-output CLI 는 돌았는데 사용량 줄이 없다. 로그인이 안 된 경우가 이렇다
 *   timeout           시간 안에 끝나지 않았다
 *   unknown           그 밖
 *
 * Rust 는 앞의 셋 중 unexpected-output 을 뺀 것을 구분한다. 파싱은 프론트가
 * 하므로 unexpected-output 도 프론트에서 붙는다.
 * src-tauri/src/collector/mod.rs 의 FailureKind 와 이름이 같아야 한다.
 */
export type UsageFailureKind =
  | "cli-not-found"
  | "unexpected-output"
  | "timeout"
  | "unknown";

export interface UsageFailure {
  kind: UsageFailureKind;
  /** 사람이 읽는 원인. 화면 문구가 아니라 진단 기록에 남기는 값이다. */
  message: string;
}

/**
 * 조회 한 번의 결과.
 *
 * 성공과 실패를 같은 타입으로 다루되, 실패에는 이유가 반드시 붙는다.
 * 예전에는 UsageSnapshot | null 이었고 이유가 console 로만 흘러 사라졌다.
 */
export type UsageFetchResult =
  | { readonly ok: true; readonly snapshot: UsageSnapshot }
  | { readonly ok: false; readonly failure: UsageFailure };

export function fetched(snapshot: UsageSnapshot): UsageFetchResult {
  return { ok: true, snapshot };
}

export function failed(kind: UsageFailureKind, message: string): UsageFetchResult {
  return { ok: false, failure: { kind, message } };
}

export interface UsageSource {
  /** 로그와 개발용 표시에 쓰는 이름. */
  readonly name: string;
  /**
   * 한 번 조회한다.
   *
   * 실패를 값으로 돌려주고 예외를 던지지 않는다. 던지더라도 폴링 루프가
   * 막아내지만, 실패를 값으로 다루는 편이 호출부가 단순하다.
   */
  fetch(now?: Date): Promise<UsageFetchResult>;
}

/**
 * 지금 환경에서 쓸 수 있는 수집기를 고른다.
 *
 *   Tauri 창  - Rust 커맨드를 부른다. 빌드된 exe 가 쓰는 길이다
 *   Node      - claude CLI 를 직접 부른다. Vite 개발 서버 플러그인이 이쪽이다
 *   브라우저  - 개발 서버의 /__dev/usage 를 부르고, 안 되면 목 데이터로 돈다
 *
 * Tauri 를 가장 먼저 본다. `tauri dev` 에서는 웹뷰가 Vite 개발 서버를 보고
 * 있어서 둘 다 쓸 수 있는데, 그때도 빌드된 exe 와 같은 길로 돌아야
 * 개발 중에 확인한 것이 그대로 배포본에서 돈다.
 */
export function createUsageSource(): UsageSource {
  if (IS_TAURI) return createTauriSource();
  return canRunProcesses() ? createClaudeCliSource() : createBrowserSource();
}

/**
 * 목 데이터를 흐르게/멈추게 한다. 그럴 수 없는 수집기면 아무 일도 하지 않는다.
 *
 * 개발용 패널이 수집기 종류를 알 필요 없게 하려고 여기에 둔다.
 */
export function setMockDraining(source: UsageSource, draining: boolean): void {
  const browser = source as Partial<BrowserUsageSource>;
  browser.setDraining?.(draining);
}

/** 실제 값과 목 데이터 중 무엇을 쓸지 고른다. 브라우저에서만 의미가 있다. */
export function setSourceMode(source: UsageSource, mode: BrowserSourceMode): void {
  const browser = source as Partial<BrowserUsageSource>;
  browser.setMode?.(mode);
}

/** Node 런타임인가. 브라우저에는 process.versions.node 가 없다. */
export function canRunProcesses(): boolean {
  const runtime = globalThis as {
    process?: { versions?: { node?: unknown } };
  };
  return typeof runtime.process?.versions?.node === "string";
}
