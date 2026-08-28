/**
 * 개발 서버를 거쳐 실제 사용량을 받아오는 수집기.
 *
 * 브라우저에서는 프로세스를 띄울 수 없어서, Vite 개발 서버에 붙여둔
 * /__dev/usage 를 부른다. 서버 쪽에서 claude CLI 를 대신 돌린다.
 *
 * **Tauri 가 붙기 전까지의 임시 배선이다.** Tauri 로 가면 Rust 수집기가
 * emit 으로 값을 넘기므로 이 파일과 dev/usageDevServer.ts 를 함께 지운다.
 */

import type { UsageSnapshot } from "../snapshot";
import { failed, fetched, type UsageFetchResult, type UsageSource } from "./source";

/**
 * 개발 서버에 붙여둔 경로. 플러그인(dev/usageDevServer.ts)이 이 값을 가져다 쓴다.
 *
 * 상수를 이쪽이 들고 있어야 의존 방향이 dev -> collector 로 유지된다.
 * 반대로 두면 브라우저 번들이 개발 서버 코드를 딸려 들어가게 된다.
 */
export const DEV_USAGE_ENDPOINT = "/__dev/usage";

export function createDevServerSource(): UsageSource {
  return {
    name: "dev-server",

    async fetch(): Promise<UsageFetchResult> {
      let response: Response;

      try {
        response = await globalThis.fetch(DEV_USAGE_ENDPOINT, { cache: "no-store" });
      } catch (error) {
        // 개발 서버가 없거나 플러그인이 안 붙은 경우.
        console.warn("[collector] 개발 서버 호출 실패 ·", messageOf(error));
        return failed("unknown", `개발 서버 호출 실패 · \${messageOf(error)}`);
      }

      if (!response.ok) {
        console.warn(
          `[collector] 개발 서버가 ${response.status} 를 돌려줌 ·`,
          await errorTextOf(response),
        );
        return failed("unknown", `개발 서버가 \${response.status} 를 돌려줌`);
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch (error) {
        console.warn("[collector] 응답을 읽지 못함 ·", messageOf(error));
        return failed("unexpected-output", `응답을 읽지 못함 · \${messageOf(error)}`);
      }

      if (!isSnapshot(body)) {
        console.warn("[collector] 응답 모양이 UsageSnapshot 이 아님 ·", body);
        return failed("unexpected-output", "응답 모양이 UsageSnapshot 이 아닙니다");
      }

      return fetched(body);
    },
  };
}

/** 서버가 넘긴 것이 정말 UsageSnapshot 인지 최소한만 확인한다. */
function isSnapshot(value: unknown): value is UsageSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.remainingPct === "number" &&
    typeof candidate.weeklyRemainingPct === "number" &&
    typeof candidate.fetchedAt === "string" &&
    typeof candidate.stale === "boolean"
  );
}

async function errorTextOf(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : "";
  } catch {
    return "";
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
