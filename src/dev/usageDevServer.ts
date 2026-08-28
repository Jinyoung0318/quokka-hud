/**
 * 개발 서버에 사용량 엔드포인트를 붙이는 Vite 플러그인.
 *
 *   GET /__dev/usage  ->  UsageSnapshot (JSON)
 *
 * 브라우저에서는 프로세스를 띄울 수 없다. 개발 서버(Node)가 대신 claude CLI 를
 * 부르고 결과만 넘겨줘서, Tauri 없이도 브라우저에서 실제 값으로 화면이
 * 움직이는 것을 볼 수 있게 한다.
 *
 * **Tauri 가 붙기 전까지의 임시 배선이다.** Tauri 로 가면 Rust 쪽 수집기가
 * 같은 일을 하고 emit 으로 넘기므로, 이 파일과 collector/devServerSource.ts,
 * 그리고 vite.config.ts 의 플러그인 등록을 함께 지운다.
 *
 * apply: "serve" 라서 개발 서버에서만 돈다. 프로덕션 빌드에는 들어가지 않는다.
 *
 * Vite 설정은 Node 에서 돌아가므로 여기서 claudeCli 를 직접 부를 수 있다.
 * 브라우저 번들에는 이 파일이 들어가지 않는다. main.ts 가 import 하지 않는다.
 */

import { createClaudeCliSource } from "../collector/claudeCli";
import { DEV_USAGE_ENDPOINT } from "../collector/devServerSource";
import type { UsageFetchResult } from "../collector/source";

// Vite · Node 타입을 끌어오지 않으려고 쓰는 만큼만 적어둔다.
// 프론트엔드 tsconfig 에는 @types/node 가 없다.
interface DevRequest {
  method?: string;
}

interface DevResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

interface DevServer {
  middlewares: {
    use(
      route: string,
      handler: (req: DevRequest, res: DevResponse, next: () => void) => void,
    ): void;
  };
}

export function usageDevServerPlugin() {
  const source = createClaudeCliSource();

  // CLI 한 번 부르는 데 7초쯤 걸린다. 탭이 여러 개거나 요청이 몰려도
  // 프로세스를 여러 개 띄우지 않도록 진행 중인 것을 같이 쓴다.
  let inFlight: Promise<UsageFetchResult> | null = null;

  const fetchOnce = (): Promise<UsageFetchResult> => {
    if (inFlight === null) {
      inFlight = source.fetch();
      void inFlight.finally(() => {
        inFlight = null;
      });
    }
    return inFlight as Promise<UsageFetchResult>;
  };

  return {
    name: "quokka-dev-usage",
    // 개발 서버에서만. 프로덕션 빌드에는 포함되지 않는다.
    apply: "serve" as const,

    configureServer(server: DevServer) {
      server.middlewares.use(DEV_USAGE_ENDPOINT, (req, res, next) => {
        if (req.method !== "GET") {
          send(res, 405, { error: "GET 만 받습니다" });
          return;
        }

        fetchOnce()
          .then((result) => {
            if (!result.ok) {
              // 원인을 그대로 내려보낸다. 브라우저에서도 창과 같은 안내를
              // 띄워 볼 수 있어야 배치를 확인할 수 있다.
              send(res, 502, {
                error: result.failure.message,
                kind: result.failure.kind,
              });
              return;
            }
            send(res, 200, result.snapshot);
          })
          .catch((error: unknown) => {
            send(res, 500, {
              error: error instanceof Error ? error.message : String(error),
            });
          })
          // 미들웨어가 예외로 죽지 않게 마지막으로 막는다.
          .catch(() => next());
      });
    },
  };
}

function send(res: DevResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  // 개발용이라 늘 새로 받는다.
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}
