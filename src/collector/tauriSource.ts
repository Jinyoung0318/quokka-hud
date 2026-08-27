/**
 * Tauri 창에서 쓰는 수집기.
 *
 * 웹뷰에서는 프로세스를 띄울 수 없으므로 Rust 쪽 커맨드를 부른다.
 * Rust 는 claude CLI 를 돌려 stdout 원문만 넘기고, 해석은 여기서 한다.
 * 파서를 Rust 에도 두면 둘이 조용히 어긋나므로 하나만 둔다.
 *
 * 목 데이터로 넘어가지 않는다. 실제 창에 가짜 값을 띄우면 그게 진짜인 줄
 * 알게 된다. 실패는 null 로 돌려주고, 폴링 루프가 직전 값을 stale 로 표시한다.
 */

import { invoke } from "@tauri-apps/api/core";
import type { UsageSnapshot } from "../snapshot";
import { parseUsage } from "./parseUsage";
import type { UsageSource } from "./source";

/** src-tauri/src/collector/mod.rs 의 커맨드 이름과 같아야 한다. */
export const USAGE_COMMAND = "fetch_usage_output";

export function createTauriSource(): UsageSource {
  return {
    name: "tauri",

    async fetch(now = new Date()): Promise<UsageSnapshot | null> {
      let output: string;

      try {
        output = await invoke<string>(USAGE_COMMAND);
      } catch (error) {
        // Rust 가 Err 를 돌려주면 여기로 온다. 메시지는 이미 사람이 읽을 수
        // 있게 만들어져 있다.
        console.warn("[collector] Rust 수집기 실패 ·", messageOf(error));
        return null;
      }

      const snapshot = parseUsage(output, now);
      if (snapshot === null) {
        console.warn("[collector] 출력을 읽지 못함 ·", preview(output));
      }
      return snapshot;
    },
  };
}

function messageOf(error: unknown): string {
  if (typeof error === "string") return error;
  return error instanceof Error ? error.message : String(error);
}

/** 로그가 길어지지 않게 앞부분만 보여준다. */
function preview(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 160 ? `${flat.slice(0, 160)}...` : flat;
}
