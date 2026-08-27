//! claude CLI 를 띄워 사용량 원문을 받아온다.
//!
//! `claude -p "/usage"` 는 비대화형으로 stdout 에 결과를 그대로 뱉는다.
//! PTY 나 터미널 에뮬레이션이 필요 없어서 평범한 프로세스 실행으로 충분하다.
//! 슬래시 명령이라 모델을 부르지 않아 이 호출 자체는 사용량에 잡히지 않는다.
//!
//! 파싱은 하지 않는다. 원문만 프론트로 넘기고 해석은 TypeScript 파서가 맡는다.
//! 파서를 양쪽에 두면 둘이 조용히 어긋난다.
//!
//! CLI 호출은 이 모듈 바깥으로 새지 않는다. 취득 경로가 바뀌어도 여기만 갈아끼운다.

use std::io::Read;
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

/// 실행할 명령.
const CLI_COMMAND: &str = "claude";
const CLI_ARGS: [&str; 2] = ["-p", "/usage"];

/// 이 시간을 넘기면 프로세스를 죽이고 실패로 친다. CLI 부팅에만 5초쯤 걸린다.
const FETCH_TIMEOUT: Duration = Duration::from_secs(15);

/// stdout 이 이보다 커지면 뭔가 잘못된 것이다.
const MAX_OUTPUT_BYTES: usize = 1024 * 1024;

/// 종료를 확인하는 간격. 짧게 두어야 끝나자마자 돌려준다.
const POLL_INTERVAL: Duration = Duration::from_millis(50);

/// 로그와 오류 메시지에 붙이는 앞부분 길이.
const PREVIEW_LEN: usize = 160;

/// 사용량 원문을 받아온다. 프론트가 이 문자열을 파싱한다.
///
/// 블로킹 작업이라 별도 스레드로 넘긴다. 동기 커맨드로 두면 Tauri 가 이걸
/// 메인 스레드에서 돌려서 7초 동안 창이 얼어붙는다.
#[tauri::command]
pub async fn fetch_usage_output() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(run_usage_command)
        .await
        .map_err(|error| format!("수집기 작업이 끝나지 못했습니다: {error}"))?
}

fn build_command() -> Command {
    #[cfg(windows)]
    {
        // Windows 에서 claude 는 exe 가 아니라 npm 이 만든 claude.cmd 다.
        // 셸을 거치지 않으면 실행 파일을 찾지 못한다.
        // 명령과 인자가 모두 이 파일의 상수이고 공백도 특수문자도 없어서
        // 셸을 거쳐도 해석이 달라지지 않는다. 바깥에서 받은 값을 여기 붙이게
        // 되면 이 판단을 다시 해야 한다.
        let mut command = Command::new("cmd");
        command.arg("/C").arg(CLI_COMMAND).args(CLI_ARGS);

        // 콘솔 창이 깜빡이지 않게 한다. 5분마다 검은 창이 뜨면 못 쓴다.
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);

        command
    }

    #[cfg(not(windows))]
    {
        // macOS · Linux 에서는 셰방이 붙은 실행 파일이라 셸이 필요 없다.
        let mut command = Command::new(CLI_COMMAND);
        command.args(CLI_ARGS);
        command
    }
}

fn run_usage_command() -> Result<String, String> {
    let mut child = build_command()
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        // 프로젝트 디렉터리에서 부르지 않는다. 그 프로젝트의 세션 기록에
        // 흔적이 남을 수 있어서 중립적인 임시 경로에서 돌린다.
        .current_dir(std::env::temp_dir())
        .spawn()
        .map_err(|error| format!("claude 를 실행하지 못했습니다: {error}"))?;

    // 파이프를 읽어내는 동안 기다린다. 읽지 않고 종료만 기다리면 출력이
    // 파이프 버퍼를 채우는 순간 양쪽이 서로를 기다리며 멈춘다.
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let stdout_reader = thread::spawn(move || stdout.map(read_capped).unwrap_or_default());
    let stderr_reader = thread::spawn(move || stderr.map(read_capped).unwrap_or_default());

    let deadline = Instant::now() + FETCH_TIMEOUT;
    let mut timed_out = false;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break Some(status),
            Ok(None) => {
                if Instant::now() >= deadline {
                    let _ = child.kill();
                    let _ = child.wait();
                    timed_out = true;
                    break None;
                }
                thread::sleep(POLL_INTERVAL);
            }
            Err(error) => {
                let _ = child.kill();
                return Err(format!("프로세스 상태를 확인하지 못했습니다: {error}"));
            }
        }
    };

    // 프로세스가 끝났으니 파이프도 곧 닫힌다.
    let output = stdout_reader.join().unwrap_or_default();
    let errors = stderr_reader.join().unwrap_or_default();

    if timed_out {
        return Err(format!(
            "{}초 안에 끝나지 않아 종료시켰습니다",
            FETCH_TIMEOUT.as_secs()
        ));
    }

    // 종료 코드가 0 이 아니어도 stdout 에 내용이 있으면 일단 넘긴다.
    // 경고를 stderr 로 뱉으면서 결과는 제대로 주는 경우가 있다.
    if !output.trim().is_empty() {
        return Ok(output);
    }

    match status {
        Some(status) if status.success() => Ok(output),
        Some(status) => Err(format!(
            "claude 가 코드 {} 로 끝났고 출력이 없습니다{}",
            status
                .code()
                .map(|code| code.to_string())
                .unwrap_or_else(|| "?".to_string()),
            detail_of(&errors),
        )),
        None => Err("프로세스가 끝났는지 알 수 없습니다".to_string()),
    }
}

/// 정해둔 크기까지만 읽는다. 그보다 크면 거기서 끊는다.
fn read_capped<R: Read>(mut reader: R) -> String {
    let mut collected: Vec<u8> = Vec::new();
    let mut chunk = [0u8; 8192];

    loop {
        match reader.read(&mut chunk) {
            Ok(0) => break,
            Ok(read) => {
                let room = MAX_OUTPUT_BYTES.saturating_sub(collected.len());
                if read >= room {
                    collected.extend_from_slice(&chunk[..room]);
                    break;
                }
                collected.extend_from_slice(&chunk[..read]);
            }
            Err(_) => break,
        }
    }

    // CLI 가 UTF-8 로 뱉지만, 깨진 바이트가 섞여도 실패로 만들지는 않는다.
    String::from_utf8_lossy(&collected).into_owned()
}

fn detail_of(stderr: &str) -> String {
    let flat = stderr.split_whitespace().collect::<Vec<_>>().join(" ");
    if flat.is_empty() {
        return String::new();
    }

    if flat.chars().count() > PREVIEW_LEN {
        let cut: String = flat.chars().take(PREVIEW_LEN).collect();
        format!(" · {cut}...")
    } else {
        format!(" · {flat}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 실제로 claude 를 띄워 원문을 받아온다.
    ///
    /// claude 가 깔려 있어야 하고 6초쯤 걸려서 기본 실행에서는 건너뛴다.
    /// 돌리려면 `cargo test -- --ignored --nocapture`.
    #[test]
    #[ignore = "claude CLI 가 설치된 환경에서만 의미가 있다"]
    fn 사용량_원문을_받아온다() {
        let started = Instant::now();
        let output = run_usage_command().expect("claude 실행 실패");
        let elapsed = started.elapsed();

        println!("{}초 걸림, {}바이트", elapsed.as_secs_f32(), output.len());
        println!("{}", output.lines().take(4).collect::<Vec<_>>().join("\n"));

        assert!(
            output.contains("Current session"),
            "출력에 Current session 줄이 없다: {output}"
        );
        assert!(elapsed < FETCH_TIMEOUT, "타임아웃 안에 끝나야 한다");
    }
}
