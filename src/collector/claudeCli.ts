/**
 * claude CLI 를 실제로 띄워 사용량을 받아온다.
 *
 * `claude -p "/usage"` 는 비대화형으로 stdout 에 결과를 그대로 뱉는다.
 * PTY 나 터미널 에뮬레이션이 필요 없어서 평범한 프로세스 실행으로 충분하다.
 * 슬래시 명령이라 모델을 부르지 않아 이 호출 자체는 사용량에 잡히지 않는다.
 *
 * CLI 부팅에 5초 안팎이 걸린다. 타임아웃을 그보다 넉넉히 잡아야 한다.
 *
 * node:child_process 를 정적으로 import 하지 않는다. 이 파일은 브라우저
 * 번들에도 딸려 들어가는데, 정적 import 면 번들러가 없는 모듈을 찾다가
 * 빌드가 깨진다. 실제로 부르는 것은 Node 에서뿐이다.
 */

import type { UsageSnapshot } from "../snapshot";
import { parseUsage } from "./parseUsage";
import type { UsageSource } from "./source";

/** 실행할 명령. */
export const CLI_COMMAND = "claude";
export const CLI_ARGS: readonly string[] = ["-p", "/usage"];

/** 이 시간을 넘기면 프로세스를 죽이고 실패로 친다. 부팅에만 5초쯤 걸린다. */
export const FETCH_TIMEOUT_MS = 15_000;

/** stdout 이 이보다 커지면 뭔가 잘못된 것이다. */
const MAX_OUTPUT_BYTES = 1024 * 1024;

// 번들러가 정적으로 읽지 못하도록 지정자를 변수에 담는다.
const CHILD_PROCESS_MODULE = "node:child_process";
const OS_MODULE = "node:os";

type ExecFileCallback = (error: unknown, stdout: string, stderr: string) => void;

interface ChildProcessModule {
  execFile(
    file: string,
    args: readonly string[] | undefined,
    options: Record<string, unknown>,
    callback: ExecFileCallback,
  ): unknown;
}

interface OsModule {
  tmpdir(): string;
}

export function createClaudeCliSource(): UsageSource {
  return {
    name: "claude-cli",

    async fetch(now = new Date()): Promise<UsageSnapshot | null> {
      let output: string;

      try {
        output = await runUsageCommand();
      } catch (error) {
        console.warn("[collector] claude 실행 실패 ·", messageOf(error));
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

async function runUsageCommand(): Promise<string> {
  const [childProcess, os] = await Promise.all([
    loadModule<ChildProcessModule>(CHILD_PROCESS_MODULE),
    loadModule<OsModule>(OS_MODULE),
  ]);

  // Windows 에서는 셸을 거쳐야 하는데, 셸을 쓰면서 인자를 따로 넘기면
  // Node 가 이스케이프 없이 이어붙인다고 경고한다(DEP0190). 그래서 셸을
  // 쓸 때는 한 줄로 합쳐 넘기고 인자 목록은 비운다.
  // 명령과 인자가 모두 이 파일의 상수이고 공백도 특수문자도 없어서
  // 합쳐도 해석이 달라지지 않는다.
  const useShell = isWindows();

  return new Promise<string>((resolve, reject) => {
    childProcess.execFile(
      useShell ? [CLI_COMMAND, ...CLI_ARGS].join(" ") : CLI_COMMAND,
      useShell ? undefined : CLI_ARGS,
      {
        // 프로젝트 디렉터리에서 부르지 않는다. 그 프로젝트의 세션 기록에
        // 흔적이 남을 수 있어서 중립적인 임시 경로에서 돌린다.
        cwd: os.tmpdir(),
        // 넘기면 Node 가 프로세스를 죽이고 error.killed 를 세운다.
        timeout: FETCH_TIMEOUT_MS,
        maxBuffer: MAX_OUTPUT_BYTES,
        windowsHide: true,
        encoding: "utf8",
        // Windows 에서 claude 는 exe 가 아니라 npm 이 만든 claude.cmd 다.
        // 셸을 거치지 않으면 ENOENT 가 나고, 확장자를 붙여도 최신 Node 는
        // .cmd 직접 실행을 막는다. macOS · Linux 에서는 셰방이 붙은 실행
        // 파일이라 셸이 필요 없다.
        //
        // 바깥에서 받은 값을 명령줄에 붙이게 되면 이 판단을 다시 해야 한다.
        shell: useShell,
      },
      (error, stdout, stderr) => {
        const output = typeof stdout === "string" ? stdout : "";

        // 종료 코드가 0 이 아니어도 stdout 에 내용이 있으면 일단 파싱해 본다.
        // 경고를 stderr 로 뱉으면서 결과는 제대로 주는 경우가 있다.
        if (output.trim() !== "") {
          resolve(output);
          return;
        }

        if (error) {
          reject(new Error(describeExecError(error, stderr)));
          return;
        }

        resolve(output);
      },
    );
  });
}

/** 번들러가 따라가지 못하도록 변수 지정자로 부른다. */
async function loadModule<T>(specifier: string): Promise<T> {
  return (await import(/* @vite-ignore */ specifier)) as T;
}

function isWindows(): boolean {
  const runtime = globalThis as { process?: { platform?: unknown } };
  const platform = runtime.process?.platform;
  return typeof platform === "string" && platform.startsWith("win");
}

function describeExecError(error: unknown, stderr: string): string {
  const failure = error as {
    killed?: boolean;
    code?: unknown;
    message?: string;
  };

  if (failure?.killed) {
    return `${FETCH_TIMEOUT_MS}ms 안에 끝나지 않아 종료시킴`;
  }

  const code = failure?.code === undefined ? "" : ` (code ${String(failure.code)})`;
  const tail = typeof stderr === "string" ? stderr.trim() : "";
  const detail = tail === "" ? "" : ` · ${preview(tail)}`;

  return `${failure?.message ?? "알 수 없는 오류"}${code}${detail}`;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** 로그가 길어지지 않게 앞부분만 보여준다. */
function preview(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 160 ? `${flat.slice(0, 160)}...` : flat;
}
