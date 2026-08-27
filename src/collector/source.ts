/**
 * 사용량을 어디서 가져오는가.
 *
 * 폴링 루프는 이 인터페이스만 보고, 값이 CLI 에서 왔는지 목 데이터인지 모른다.
 * 나중에 Rust 로 옮기든 Node 사이드카로 가든 이 자리만 갈아끼우면 된다.
 */

import type { UsageSnapshot } from "../snapshot";
import { createClaudeCliSource } from "./claudeCli";
import { createMockSource } from "./mockSource";

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
 * 브라우저에서는 프로세스를 띄울 수 없어 목 데이터로 돈다. 화면과 폴링
 * 배선을 브라우저에서 그대로 확인할 수 있게 하려는 것이고, 실제 값은
 * Node(또는 나중의 Tauri) 에서만 들어온다.
 */
export function createUsageSource(): UsageSource {
  return canRunProcesses() ? createClaudeCliSource() : createMockSource();
}

/** Node 런타임인가. 브라우저에는 process.versions.node 가 없다. */
export function canRunProcesses(): boolean {
  const runtime = globalThis as {
    process?: { versions?: { node?: unknown } };
  };
  return typeof runtime.process?.versions?.node === "string";
}
