//! 창 배율과 위치를 기억한다.
//!
//! 파일 하나에 담는다. 저장할 것이 두 개뿐이라 플러그인을 붙일 이유가 없다.
//! 파일이 없거나 깨져 있으면 조용히 기본값으로 간다. 설정을 못 읽었다고
//! 앱이 안 뜨면 곤란하다.

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, LogicalSize, Manager, PhysicalPosition, Runtime, WebviewWindow};

/// 캔버스 논리 해상도. src/render/canvas.ts 의 LOGICAL_SIZE 와 같아야 한다.
///
/// 픽셀 아트라 창 크기가 이 값의 정수배여야 확대해도 뭉개지지 않는다.
/// 그래서 자유 리사이즈 대신 배율을 고르게 한다.
pub const LOGICAL_SIZE: u32 = 85;

/// 폴링 주기로 고를 수 있는 분. 트레이와 창 버튼이 이 순서로 돈다.
pub const POLL_CHOICES: [u32; 3] = [1, 2, 5];
pub const DEFAULT_POLL_MINUTES: u32 = 2;

/// 고를 수 없는 주기를 기본값으로 되돌린다. 배율과 같은 규칙이다.
pub fn sanitize_poll_minutes(minutes: u32) -> u32 {
    if POLL_CHOICES.contains(&minutes) {
        minutes
    } else {
        DEFAULT_POLL_MINUTES
    }
}

/// serde 가 없는 필드를 채울 때 쓴다.
/// 이 필드가 생기기 전에 저장된 파일에도 배율과 위치는 들어 있다.
/// 기본값으로 통째로 되돌리면 그것까지 잃는다.
fn default_poll_minutes() -> u32 {
    DEFAULT_POLL_MINUTES
}

pub const MIN_SCALE: u32 = 1;
pub const MAX_SCALE: u32 = 3;
pub const DEFAULT_SCALE: u32 = 2;

/// 고를 수 없는 배율을 기본값으로 되돌린다.
///
/// `clamp` 을 쓰지 않는다. 예전 버전은 4~6배를 저장했는데, 접기만 하면 그 값들이
/// 전부 최대 배율인 3배가 되어 쓰던 것보다 오히려 큰 창이 뜬다. 범위 밖이면
/// 무슨 값이었든 기본값으로 보낸다.
fn sanitize_scale(scale: u32) -> u32 {
    if (MIN_SCALE..=MAX_SCALE).contains(&scale) {
        scale
    } else {
        DEFAULT_SCALE
    }
}

/// 위치를 얼마나 자주 파일에 쓸지. 드래그 중에는 Moved 가 초당 수십 번 온다.
const WRITE_THROTTLE: Duration = Duration::from_secs(1);

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Settings {
    /// 논리 해상도에 곱할 배율.
    pub scale: u32,
    /// 사용량을 몇 분마다 조회할지.
    #[serde(default = "default_poll_minutes")]
    pub poll_minutes: u32,
    /// 창 왼쪽 위 물리 좌표. 한 번도 옮긴 적이 없으면 없다.
    pub x: Option<i32>,
    pub y: Option<i32>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            scale: DEFAULT_SCALE,
            poll_minutes: DEFAULT_POLL_MINUTES,
            x: None,
            y: None,
        }
    }
}

impl Settings {
    /// 파일에서 읽은 값이 범위를 벗어났으면 되돌린다.
    /// 손으로 고칠 수 있는 파일이라 아무 값이나 들어올 수 있다.
    fn sanitized(mut self) -> Self {
        self.scale = sanitize_scale(self.scale);
        self.poll_minutes = sanitize_poll_minutes(self.poll_minutes);
        self
    }
}

/// 배율에 해당하는 창 한 변의 길이.
pub fn window_size(scale: u32) -> u32 {
    LOGICAL_SIZE * scale
}

/// 앱이 들고 다니는 현재 설정. 디스크 쓰기 시각도 같이 쥔다.
pub struct SettingsState {
    inner: Mutex<Inner>,
}

struct Inner {
    settings: Settings,
    /// 마지막으로 파일에 쓴 시각.
    written_at: Instant,
    /// 마지막으로 쓴 뒤 값이 바뀌었는가.
    dirty: bool,
}

impl SettingsState {
    /// 지금 설정. 잠금을 못 잡으면 기본값으로 답한다.
    pub fn current(&self) -> Settings {
        self.inner
            .lock()
            .map(|inner| inner.settings)
            .unwrap_or_default()
    }

    pub fn new(settings: Settings) -> Self {
        Self {
            inner: Mutex::new(Inner {
                settings,
                written_at: Instant::now(),
                dirty: false,
            }),
        }
    }
}

fn settings_path<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|dir| dir.join("settings.json"))
}

/// 저장된 설정을 읽는다. 없거나 깨졌으면 기본값.
pub fn load<R: Runtime>(app: &AppHandle<R>) -> Settings {
    let Some(path) = settings_path(app) else {
        return Settings::default();
    };
    let Ok(text) = fs::read_to_string(&path) else {
        return Settings::default();
    };

    // 손으로 고칠 수 있는 파일이다. Windows 의 메모장과 PowerShell 은
    // UTF-8 로 저장할 때 BOM 을 붙이는데, serde_json 은 그걸 만나면 실패한다.
    // 사용자가 보기에는 멀쩡한 JSON 이라 원인을 알아채기 어렵다.
    let text = text.strip_prefix('\u{feff}').unwrap_or(&text);

    match serde_json::from_str::<Settings>(text) {
        Ok(settings) => settings.sanitized(),
        Err(error) => {
            eprintln!("[settings] 읽지 못해 기본값으로 갑니다: {error}");
            Settings::default()
        }
    }
}

fn write<R: Runtime>(app: &AppHandle<R>, settings: &Settings) {
    let Some(path) = settings_path(app) else {
        return;
    };
    if let Some(dir) = path.parent() {
        let _ = fs::create_dir_all(dir);
    }
    match serde_json::to_string_pretty(settings) {
        Ok(text) => {
            if let Err(error) = fs::write(&path, text) {
                eprintln!("[settings] 저장 실패: {error}");
            }
        }
        Err(error) => eprintln!("[settings] 직렬화 실패: {error}"),
    }
}

/// 배율을 바꾸고 바로 저장한다. 메뉴에서 고른 것이라 자주 일어나지 않는다.
pub fn set_scale<R: Runtime>(app: &AppHandle<R>, scale: u32) -> Settings {
    let state = app.state::<SettingsState>();
    let updated = {
        let Ok(mut inner) = state.inner.lock() else {
            return Settings::default();
        };
        inner.settings.scale = sanitize_scale(scale);
        inner.written_at = Instant::now();
        inner.dirty = false;
        inner.settings
    };

    write(app, &updated);
    updated
}

/// 폴링 주기를 바꾸고 바로 저장한다.
pub fn set_poll_minutes<R: Runtime>(app: &AppHandle<R>, minutes: u32) -> Settings {
    let state = app.state::<SettingsState>();
    let updated = {
        let Ok(mut inner) = state.inner.lock() else {
            return Settings::default();
        };
        inner.settings.poll_minutes = sanitize_poll_minutes(minutes);
        inner.written_at = Instant::now();
        inner.dirty = false;
        inner.settings
    };

    write(app, &updated);
    updated
}

/// 창이 움직였다. 메모리에는 바로 반영하고 파일은 가끔만 쓴다.
pub fn remember_position<R: Runtime>(app: &AppHandle<R>, x: i32, y: i32) {
    let state = app.state::<SettingsState>();
    let to_write = {
        let Ok(mut inner) = state.inner.lock() else {
            return;
        };
        if inner.settings.x == Some(x) && inner.settings.y == Some(y) {
            return;
        }
        inner.settings.x = Some(x);
        inner.settings.y = Some(y);
        inner.dirty = true;

        if inner.written_at.elapsed() < WRITE_THROTTLE {
            None
        } else {
            inner.written_at = Instant::now();
            inner.dirty = false;
            Some(inner.settings)
        }
    };

    if let Some(settings) = to_write {
        write(app, &settings);
    }
}

/// 남은 변경분을 마저 쓴다. 창을 닫을 때 부른다.
/// 드래그를 멈춘 마지막 위치가 스로틀에 걸려 안 써졌을 수 있다.
pub fn flush<R: Runtime>(app: &AppHandle<R>) {
    let state = app.state::<SettingsState>();
    let to_write = {
        let Ok(mut inner) = state.inner.lock() else {
            return;
        };
        if !inner.dirty {
            return;
        }
        inner.dirty = false;
        inner.written_at = Instant::now();
        inner.settings
    };

    write(app, &to_write);
}

/// 창에 배율과 위치를 적용한다.
pub fn apply<R: Runtime>(window: &WebviewWindow<R>, settings: &Settings) {
    let size = window_size(settings.scale);

    // 논리 크기로 준다. tauri.conf.json 의 width/height 와 같은 단위라
    // 디스플레이 배율이 달라도 눈에 보이는 크기가 일정하다.
    if let Err(error) = window.set_size(LogicalSize::new(size, size)) {
        eprintln!("[settings] 창 크기를 바꾸지 못했습니다: {error}");
    }

    let (Some(x), Some(y)) = (settings.x, settings.y) else {
        return;
    };

    // 모니터 구성이 바뀌었으면 저장된 자리가 화면 밖일 수 있다.
    // 그대로 옮기면 창을 찾을 수 없게 된다.
    if !position_is_visible(window, x, y) {
        eprintln!("[settings] 저장된 위치 ({x}, {y}) 가 화면 밖이라 무시합니다");
        return;
    }

    if let Err(error) = window.set_position(PhysicalPosition::new(x, y)) {
        eprintln!("[settings] 창 위치를 바꾸지 못했습니다: {error}");
    }
}

/// 그 좌표가 어느 모니터 안에 들어가는가.
fn position_is_visible<R: Runtime>(window: &WebviewWindow<R>, x: i32, y: i32) -> bool {
    let Ok(monitors) = window.available_monitors() else {
        // 모니터를 못 읽으면 판단할 수 없다. 저장된 값을 믿는다.
        return true;
    };

    monitors.iter().any(|monitor| {
        let origin = monitor.position();
        let size = monitor.size();
        let right = origin.x + size.width as i32;
        let bottom = origin.y + size.height as i32;
        x >= origin.x && x < right && y >= origin.y && y < bottom
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn 없어진_배율은_기본값으로_돌아간다() {
        // 4~6배를 저장해 둔 예전 설정 파일. 접으면 전부 3배가 되어버린다.
        for old in [4, 5, 6] {
            assert_eq!(sanitize_scale(old), DEFAULT_SCALE, "{old} 배 보정이 틀렸다");
        }
    }

    #[test]
    fn 고를_수_있는_배율은_그대로_둔다() {
        for scale in MIN_SCALE..=MAX_SCALE {
            assert_eq!(sanitize_scale(scale), scale);
        }
    }

    #[test]
    fn 말도_안_되는_값도_기본값으로() {
        for bad in [0, 99, u32::MAX] {
            assert_eq!(sanitize_scale(bad), DEFAULT_SCALE);
        }
    }

    #[test]
    fn 없어진_주기는_기본값으로_돌아간다() {
        for bad in [0, 3, 10, 60, u32::MAX] {
            assert_eq!(
                sanitize_poll_minutes(bad),
                DEFAULT_POLL_MINUTES,
                "{bad} 분 보정이 틀렸다"
            );
        }
    }

    #[test]
    fn 고를_수_있는_주기는_그대로_둔다() {
        for minutes in POLL_CHOICES {
            assert_eq!(sanitize_poll_minutes(minutes), minutes);
        }
    }

    /// 주기 필드가 생기기 전에 저장된 파일. 통째로 기본값이 되면
    /// 쓰던 배율과 창 위치까지 잃는다.
    #[test]
    fn 주기가_없는_예전_설정도_배율과_위치를_지킨다() {
        let old = r#"{"scale":3,"x":100,"y":200}"#;
        let parsed: Settings = serde_json::from_str(old).expect("읽혀야 한다");
        let settings = parsed.sanitized();

        assert_eq!(settings.poll_minutes, DEFAULT_POLL_MINUTES);
        assert_eq!(settings.scale, 3);
        assert_eq!(settings.x, Some(100));
        assert_eq!(settings.y, Some(200));
    }

    #[test]
    fn 창_크기는_배율의_정수배() {
        assert_eq!(window_size(1), 85);
        assert_eq!(window_size(2), 170);
        assert_eq!(window_size(3), 255);
    }
}
