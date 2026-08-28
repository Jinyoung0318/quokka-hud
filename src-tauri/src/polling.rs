//! 폴링 주기 변경은 어디서 시작하든 여기를 지난다.
//!
//! 트레이 메뉴와 창의 버튼 두 곳에서 바꿀 수 있다. 각자 제 갈 길로 가면
//! 한쪽만 바뀐 상태가 생기므로, 설정 파일 · 트레이 체크 표시 · 버튼 라벨을
//! 한 함수에서 모두 갱신한다. scale.rs 와 같은 구조다.
//!
//! 주기 자체를 지키는 일은 프론트의 poller.ts 가 한다. 여기서는 고른 값을
//! 저장하고 알리기만 한다. Rust 에 타이머를 하나 더 두면 실제로 도는 주기와
//! 저장된 주기가 어긋날 수 있다.

use tauri::{AppHandle, Emitter, Manager, Runtime};

use crate::{settings, tray};

/// 고를 수 있는 주기(분)와 트레이 메뉴에 보일 이름. 순환 순서이기도 하다.
///
/// 1분이 들어 있는 것은 실측 때문이다. 1분 간격 30회를 돌려 실패 0건 ·
/// 레이트 리밋 흔적 0건을 확인했다. 다만 한 번 호출에 7초가 걸려서,
/// 1분은 그 시간의 12% 동안 CLI 프로세스가 떠 있다는 뜻이다.
pub const CHOICES: [(u32, &str); 3] = [(1, "1분"), (2, "2분"), (5, "5분")];

/// 주기가 바뀌었음을 프론트에 알리는 이벤트.
/// 트레이에서 바꿔도 창 버튼 라벨이 따라오게 하려고 쓴다.
pub const POLL_CHANGED_EVENT: &str = "poll-interval-changed";

pub fn current<R: Runtime>(app: &AppHandle<R>) -> u32 {
    app.state::<settings::SettingsState>()
        .current()
        .poll_minutes
}

/// 다음 주기. 마지막에서 처음으로 돈다.
pub fn next(minutes: u32) -> u32 {
    let index = CHOICES
        .iter()
        .position(|(choice, _)| *choice == minutes)
        .unwrap_or(0);
    CHOICES[(index + 1) % CHOICES.len()].0
}

/// 주기를 바꾸고 관련된 것을 모두 맞춘다. 적용된 주기를 돌려준다.
pub fn change<R: Runtime>(app: &AppHandle<R>, minutes: u32) -> u32 {
    let updated = settings::set_poll_minutes(app, minutes);

    tray::refresh_menu(app);

    // 실패해도 값은 이미 저장됐다. 라벨만 못 따라올 뿐이라 넘어간다.
    let _ = app.emit(POLL_CHANGED_EVENT, updated.poll_minutes);

    updated.poll_minutes
}

#[tauri::command]
pub fn poll_interval<R: Runtime>(app: AppHandle<R>) -> u32 {
    current(&app)
}

#[tauri::command]
pub fn cycle_poll_interval<R: Runtime>(app: AppHandle<R>) -> u32 {
    change(&app, next(current(&app)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::settings::{sanitize_poll_minutes, DEFAULT_POLL_MINUTES, POLL_CHOICES};

    #[test]
    fn 다음_주기는_한_바퀴_돈다() {
        assert_eq!(next(1), 2);
        assert_eq!(next(2), 5);
        // 마지막에서 처음으로.
        assert_eq!(next(5), 1);
    }

    #[test]
    fn 세_번_누르면_제자리로() {
        let mut minutes = 2;
        for _ in 0..CHOICES.len() {
            minutes = next(minutes);
        }
        assert_eq!(minutes, 2);
    }

    /// 설정 파일에 없어진 주기가 남아 있어도 순환이 멈추지 않아야 한다.
    #[test]
    fn 없어진_주기에서도_순환이_이어진다() {
        for old in [3, 10, 60] {
            assert_eq!(next(old), CHOICES[1].0, "{old} 분에서 멈췄다");
        }
    }

    #[test]
    fn 고를_수_있는_주기와_보정_규칙이_같다() {
        for (choice, _) in CHOICES {
            assert!(
                POLL_CHOICES.contains(&choice),
                "{choice} 분은 저장 시 기본값으로 되돌려진다"
            );
            assert_eq!(sanitize_poll_minutes(choice), choice);
        }
        assert_eq!(sanitize_poll_minutes(3), DEFAULT_POLL_MINUTES);
    }
}
