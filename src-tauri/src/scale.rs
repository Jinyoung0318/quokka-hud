//! 배율 변경은 어디서 시작하든 여기를 지난다.
//!
//! 트레이 메뉴와 타이틀바 버튼 두 곳에서 바꿀 수 있는데, 각자 제 갈 길로
//! 가면 한쪽만 바뀐 상태가 생긴다. 창 크기 · 설정 파일 · 트레이 체크 표시 ·
//! 버튼 라벨을 한 함수에서 모두 갱신한다.

use tauri::{AppHandle, Emitter, Manager, Runtime};

use crate::{settings, tray};

/// 고를 수 있는 배율과 트레이 메뉴에 보일 이름. 순환 순서이기도 하다.
pub const CHOICES: [(u32, &str); 3] = [(1, "작게"), (2, "보통"), (3, "크게")];

/// 배율이 바뀌었음을 프론트에 알리는 이벤트.
/// 트레이에서 바꿔도 타이틀바 버튼 라벨이 따라오게 하려고 쓴다.
pub const SCALE_CHANGED_EVENT: &str = "scale-changed";

pub fn current<R: Runtime>(app: &AppHandle<R>) -> u32 {
    app.state::<settings::SettingsState>().current().scale
}

/// 다음 배율. 마지막에서 처음으로 돈다.
pub fn next(scale: u32) -> u32 {
    let index = CHOICES
        .iter()
        .position(|(choice, _)| *choice == scale)
        .unwrap_or(0);
    CHOICES[(index + 1) % CHOICES.len()].0
}

/// 배율을 바꾸고 관련된 것을 모두 맞춘다. 적용된 배율을 돌려준다.
pub fn change<R: Runtime>(app: &AppHandle<R>, scale: u32) -> u32 {
    let updated = settings::set_scale(app, scale);

    if let Some(window) = app.get_webview_window("main") {
        settings::apply(&window, &updated);
    }

    tray::refresh_menu(app, updated.scale);

    // 실패해도 창 크기는 이미 바뀌었다. 라벨만 못 따라올 뿐이라 넘어간다.
    let _ = app.emit(SCALE_CHANGED_EVENT, updated.scale);

    updated.scale
}

/// 지금 배율. 버튼이 처음 라벨을 그릴 때 쓴다.
#[tauri::command]
pub fn window_scale<R: Runtime>(app: AppHandle<R>) -> u32 {
    current(&app)
}

/// 다음 배율로 넘긴다. 타이틀바 버튼이 부른다.
#[tauri::command]
pub fn cycle_window_scale<R: Runtime>(app: AppHandle<R>) -> u32 {
    change(&app, next(current(&app)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::settings::{MAX_SCALE, MIN_SCALE};

    #[test]
    fn 다음_배율은_한_바퀴_돈다() {
        assert_eq!(next(1), 2);
        assert_eq!(next(2), 3);
        // 마지막에서 처음으로.
        assert_eq!(next(3), 1);
    }

    #[test]
    fn 세_번_누르면_제자리로() {
        let mut scale = 2;
        for _ in 0..CHOICES.len() {
            scale = next(scale);
        }
        assert_eq!(scale, 2);
    }

    /// 설정 파일에 예전 배율이 남아 있어도 순환이 멈추지 않아야 한다.
    /// position() 이 못 찾으면 0 번으로 떨어지므로 첫 배율의 다음이 나온다.
    #[test]
    fn 없어진_배율에서도_순환이_이어진다() {
        for old in [4, 5, 6] {
            assert_eq!(next(old), CHOICES[1].0, "{old} 배에서 멈췄다");
        }
    }

    #[test]
    fn 고를_수_있는_배율이_설정_범위_안에_있다() {
        for (choice, _) in CHOICES {
            assert!(
                (MIN_SCALE..=MAX_SCALE).contains(&choice),
                "{choice} 배는 저장 시 잘려나간다"
            );
        }
    }
}
