/**
 * 사용량을 어디서 가져오는가.
 *
 * 폴링 루프는 이 인터페이스만 보고, 값이 CLI 에서 왔는지 목 데이터인지 모른다.
 * 나중에 Rust 로 옮기든 Node 사이드카로 가든 이 자리만 갈아끼우면 된다.
 */

import type { UsageSnapshot } from "../snapshot";
import { createClaudeCliSource } from "./claudeCli";
import {
  createBrowserSource,
  type BrowserSourceMode,
  type BrowserUsageSource,
} from "./browserSource";

export interface UsageSource {
  /** 로그와 개발용 표시에 쓰는 이름. */
  readonly name: string;
  /**
   * 한 번 조회한다.
   *
   * 실패하면 null 을 돌려주고 예외를 던지지 않는다. 던지더라도 폴링 루프가
   * 막아내지만, 실패를 값으로 다루는 편이 호출부가 단순하다.
   */
  fetch(now?: Date): Promise<UsageSnapshot | null>;
}

/**
 * 지금 환경에서 쓸 수 있는 수집기를 고른다.
 *
 * Node 에서는 claude CLI 를 직접 부른다. 브라우저에서는 프로세스를 띄울 수
 * 없어서, 개발 서버를 거쳐 실제 값을 받거나 목 데이터로 돈다.
 */
export function createUsageSource(): UsageSource {
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
