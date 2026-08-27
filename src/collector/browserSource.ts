/**
 * 브라우저에서 쓰는 수집기. 실제 값과 목 데이터를 골라 쓴다.
 *
 *   cli  - 개발 서버를 거쳐 진짜 claude CLI 값을 받는다.
 *          받지 못하면 목 데이터로 넘어간다. 화면이 멈추면 안 된다.
 *   mock - 목 데이터만 쓴다.
 *
 * 고르는 것은 개발용 패널이 한다. 여기서는 손잡이만 내놓는다.
 *
 * cli 쪽은 Tauri 가 붙기 전까지의 임시 배선이다. Tauri 로 가면 Rust 수집기가
 * 값을 넘기므로 devServerSource 와 함께 정리한다.
 */

import type { UsageSnapshot } from "../snapshot";
import type { UsageSource } from "./source";
import { createDevServerSource } from "./devServerSource";
import { createMockSource, type MockUsageSource } from "./mockSource";

export type BrowserSourceMode = "cli" | "mock";

export interface BrowserUsageSource extends UsageSource {
  setMode(mode: BrowserSourceMode): void;
  /** 목 데이터를 흐르게 할지. mock 모드에서만 의미가 있다. */
  setDraining(draining: boolean): void;
}

export function createBrowserSource(
  initialMode: BrowserSourceMode = "cli",
): BrowserUsageSource {
  const devServer = createDevServerSource();
  const mock: MockUsageSource = createMockSource();

  let mode: BrowserSourceMode = initialMode;
  /** 마지막 조회에서 실제로 값을 준 쪽. 패널에 무엇이 도는지 보여주려는 것. */
  let servedBy: "dev-server" | "mock" | "mock (폴백)" = "dev-server";

  return {
    get name(): string {
      return servedBy;
    },

    setMode(next: BrowserSourceMode): void {
      mode = next;
      servedBy = next === "mock" ? "mock" : "dev-server";
    },

    setDraining(draining: boolean): void {
      mock.setDraining(draining);
    },

    async fetch(now = new Date()): Promise<UsageSnapshot | null> {
      if (mode === "mock") {
        servedBy = "mock";
        return mock.fetch(now);
      }

      const real = await devServer.fetch(now);
      if (real !== null) {
        servedBy = "dev-server";
        return real;
      }

      // 개발 서버가 없거나 CLI 가 실패했다. 화면을 멈추느니 목으로 간다.
      servedBy = "mock (폴백)";
      return mock.fetch(now);
    },
  };
}
