/**
 * 실패를 파일로 남긴다. 실제 쓰기는 Rust 가 한다.
 *
 * GUI 앱이라 stderr 가 어디에도 안 붙고 릴리스에는 devtools 도 없다.
 * console.warn 은 아무도 볼 수 없는 자리에 찍히는 것과 같다.
 *
 * 원인 분류가 여기서 완성되므로(파싱 실패는 Rust 가 알 수 없다) 쓰는 쪽도
 * 여기다. Rust 는 줄 수를 지키며 파일에 넣는 일만 맡는다.
 */

import { invoke } from "@tauri-apps/api/core";
import { IS_TAURI } from "../runtime";
import type { UsageFailure } from "./source";

/** src-tauri/src/diagnostics.rs 의 커맨드 이름과 같아야 한다. */
const RECORD_COMMAND = "record_failure";
const PATH_COMMAND = "diagnostics_path";

export function recordFailure(failure: UsageFailure): void {
  if (!IS_TAURI) return;

  // 기다리지 않는다. 기록을 남기려다 조회가 늦어지면 주객이 바뀐다.
  void invoke(RECORD_COMMAND, {
    at: new Date().toISOString(),
    kind: failure.kind,
    message: failure.message,
  }).catch((error) => console.warn("[diagnostics] 기록 실패 ·", error));
}

/** 기록이 놓인 자리. 알 수 없으면 빈 문자열. */
export async function diagnosticsPath(): Promise<string> {
  if (!IS_TAURI) return "";
  try {
    return await invoke<string>(PATH_COMMAND);
  } catch (error) {
    console.warn("[diagnostics] 경로를 읽지 못했습니다 ·", error);
    return "";
  }
}
