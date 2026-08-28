//! 실패를 파일로 남긴다.
//!
//! GUI 앱이라 stderr 가 어디에도 붙지 않고, 릴리스 빌드에는 devtools 도 없다.
//! exe 만 받은 사람은 물론이고 만든 사람도 왜 안 되는지 볼 방법이 없었다.
//!
//! 성공은 남기지 않는다. 5분마다 도는 것을 다 적으면 정작 실패가 묻힌다.
//! 최근 몇 건만 두고 오래된 것부터 버린다. 진단용이지 감사 기록이 아니다.
//!
//! 원인 분류가 프론트에서 완성되므로(파싱 실패는 Rust 가 알 수 없다) 쓰는
//! 쪽도 프론트다. Rust 는 파일만 맡는다.

use std::fs;
use std::path::PathBuf;

use tauri::{AppHandle, Manager, Runtime};

const FILE_NAME: &str = "diagnostics.log";

/// 남겨둘 줄 수. 넘으면 오래된 것부터 버린다.
const KEEP: usize = 20;

/// 한 줄에 담을 메시지 길이. CLI 가 긴 것을 뱉어도 파일이 붓지 않게.
const MAX_MESSAGE: usize = 400;

fn log_path<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|dir| dir.join(FILE_NAME))
}

/// 한 줄로 만든다. 줄바꿈이 섞이면 기록 하나가 여러 줄로 흩어진다.
fn flatten(text: &str, limit: usize) -> String {
    let flat = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if flat.chars().count() > limit {
        flat.chars().take(limit).collect::<String>() + "..."
    } else {
        flat
    }
}

/// 실패 한 건을 남긴다.
///
/// 실패해도 조용히 넘어간다. 진단 기록을 못 남겼다고 앱이 멈추면
/// 원래 고치려던 문제보다 나쁜 상황이 된다.
#[tauri::command]
pub fn record_failure<R: Runtime>(app: AppHandle<R>, at: String, kind: String, message: String) {
    let Some(path) = log_path(&app) else {
        return;
    };
    if let Some(dir) = path.parent() {
        let _ = fs::create_dir_all(dir);
    }

    let line = format!(
        "{}\t{}\t{}",
        flatten(&at, 40),
        flatten(&kind, 40),
        flatten(&message, MAX_MESSAGE)
    );

    // 통째로 읽고 다시 쓴다. 스무 줄짜리라 이어 쓰기와 잘라내기를 따로
    // 두는 것보다 단순하고, 줄 수가 늘 지켜진다.
    let mut lines: Vec<String> = fs::read_to_string(&path)
        .map(|text| text.lines().map(str::to_owned).collect())
        .unwrap_or_default();

    lines.push(line);
    let start = lines.len().saturating_sub(KEEP);
    let kept = lines[start..].join("\n");

    let _ = fs::write(&path, kept + "\n");
}

/// 기록이 놓인 자리. 안내 화면에 띄워서 사용자가 찾아갈 수 있게 한다.
#[tauri::command]
pub fn diagnostics_path<R: Runtime>(app: AppHandle<R>) -> String {
    log_path(&app)
        .map(|path| path.to_string_lossy().into_owned())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn 여러_줄은_한_줄로_눕는다() {
        assert_eq!(flatten("a\nb\t c", 100), "a b c");
    }

    #[test]
    fn 긴_메시지는_잘린다() {
        let long = "가".repeat(500);
        let cut = flatten(&long, MAX_MESSAGE);
        assert_eq!(cut.chars().count(), MAX_MESSAGE + 3, "잘린 표시까지 포함");
    }
}
