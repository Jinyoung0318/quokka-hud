/**
 * Tauri 창에서 쓰는 수집기.
 *
 * 웹뷰에서는 프로세스를 띄울 수 없으므로 Rust 쪽 커맨드를 부른다.
 * Rust 는 claude CLI 를 돌려 stdout 원문만 넘기고, 해석은 여기서 한다.
 * 파서를 Rust 에도 두면 둘이 조용히 어긋나므로 하나만 둔다.
 *
 * 목 데이터로 넘어가지 않는다. 실제 창에 가짜 값을 띄우면 그게 진짜인 줄
 * 알게 된다. 실패는 원인을 붙여 돌려주고, 폴링 루프가 그 원인을 화면과
 * 진단 기록으로 넘긴다.
 */

import { invoke } from "@tauri-apps/api/core";
import { parseUsage } from "./parseUsage";
import {
  failed,
  fetched,
  type UsageFailureKind,
  type UsageFetchResult,
  type UsageSource,
} from "./source";

/** src-tauri/src/collector/mod.rs 의 커맨드 이름과 같아야 한다. */
export const USAGE_COMMAND = "fetch_usage_output";

export function createTauriSource(): UsageSource {
  return {
    name: "tauri",

    async fetch(now = new Date()): Promise<UsageFetchResult> {
      let output: string;

      try {
        output = await invoke<string>(USAGE_COMMAND);
      } catch (error) {
        // Rust 가 Err 를 돌려주면 여기로 온다. 원인 분류가 이미 붙어 있다.
        const { kind, message } = collectorErrorOf(error);
        console.warn(`[collector] Rust 수집기 실패 (\${kind}) ·`, message);
        return failed(kind, message);
      }

      const snapshot = parseUsage(output, now);
      if (snapshot === null) {
        // CLI 는 돌았는데 사용량 줄이 없다. 로그인이 안 됐을 때 이 모양이다.
        // 종료 코드가 0 이고 stdout 도 비어 있지 않아서 Rust 는 성공으로 본다.
        const detail = preview(output);
        console.warn("[collector] 출력을 읽지 못함 ·", detail);
        return failed("unexpected-output", `사용량 줄을 찾지 못했습니다 · \${detail}`);
      }
      return fetched(snapshot);
    },
  };
}

/** Rust 가 넘긴 { kind, message } 를 꺼낸다. 모양이 다르면 unknown 으로 둔다. */
function collectorErrorOf(error: unknown): { kind: UsageFailureKind; message: string } {
  if (typeof error === "object" && error !== null) {
    const candidate = error as { kind?: unknown; message?: unknown };
    if (typeof candidate.kind === "string" && typeof candidate.message === "string") {
      return { kind: candidate.kind as UsageFailureKind, message: candidate.message };
    }
  }
  return { kind: "unknown", message: messageOf(error) };
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
