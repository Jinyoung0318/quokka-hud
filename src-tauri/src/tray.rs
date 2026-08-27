//! 트레이 아이콘과 메뉴.
//!
//! 창에 테두리가 없어서 크기를 끌어 늘릴 방법이 없다. 픽셀 아트라 어차피
//! 정수 배율만 써야 하므로, 자유 리사이즈 대신 여기서 배율을 고른다.
//!
//! 메뉴는 고를 때마다 통째로 다시 만든다. 체크 표시를 갱신하려고 항목
//! 핸들을 들고 다니는 것보다 단순하고, 항목이 여섯 개뿐이라 비용도 없다.

use tauri::menu::{CheckMenuItem, IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, Runtime};

use crate::{scale, settings};

const TRAY_ID: &str = "main";

const MENU_SETTING: &str = "setting";
const MENU_EXIT: &str = "exit";
const SIZE_PREFIX: &str = "size:";

pub fn build<R: Runtime>(app: &AppHandle<R>, scale: u32) -> tauri::Result<()> {
    let menu = build_menu(app, scale)?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("quokka-hud")
        .menu(&menu)
        // 왼쪽 클릭은 메뉴가 아니라 창을 불러오는 데 쓴다.
        .show_menu_on_left_click(false)
        .on_menu_event(handle_menu_event)
        .on_tray_icon_event(handle_tray_event);

    // 창 아이콘을 그대로 쓴다. 트레이용 아이콘을 따로 두지 않는다.
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder.build(app)?;
    Ok(())
}

fn build_menu<R: Runtime>(app: &AppHandle<R>, scale: u32) -> tauri::Result<Menu<R>> {
    let size_items = scale::CHOICES
        .iter()
        .map(|(choice, label)| {
            let side = settings::window_size(*choice);
            CheckMenuItem::with_id(
                app,
                format!("{SIZE_PREFIX}{choice}"),
                format!("{label} ({side}px · {choice}배)"),
                true,
                *choice == scale,
                None::<&str>,
            )
        })
        .collect::<tauri::Result<Vec<_>>>()?;

    let size_refs: Vec<&dyn IsMenuItem<R>> = size_items
        .iter()
        .map(|item| item as &dyn IsMenuItem<R>)
        .collect();
    let size_menu = Submenu::with_items(app, "크기", true, &size_refs)?;

    // 설정 창은 아직 없다. 자리는 두되 눌러도 아무 일이 없으니 꺼둔다.
    // 켜두고 아무 반응이 없으면 고장난 것으로 보인다.
    let setting = MenuItem::with_id(app, MENU_SETTING, "설정 (준비 중)", false, None::<&str>)?;
    let exit = MenuItem::with_id(app, MENU_EXIT, "종료", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;

    Menu::with_items(app, &[&size_menu, &separator, &setting, &exit])
}

fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, event: tauri::menu::MenuEvent) {
    let id = event.id().as_ref();

    if let Some(rest) = id.strip_prefix(SIZE_PREFIX) {
        match rest.parse::<u32>() {
            Ok(chosen) => {
                scale::change(app, chosen);
            }
            Err(_) => eprintln!("[tray] 배율을 읽지 못했습니다: {id}"),
        }
        return;
    }

    match id {
        MENU_EXIT => {
            // 마지막 위치를 흘리지 않게 먼저 저장한다.
            settings::flush(app);
            app.exit(0);
        }
        MENU_SETTING => {}
        _ => {}
    }
}

/// 체크 표시를 옮기려면 메뉴를 다시 만들어 갈아끼운다.
/// 항목이 여섯 개뿐이라 핸들을 들고 다니는 것보다 이 편이 단순하다.
pub fn refresh_menu<R: Runtime>(app: &AppHandle<R>, scale: u32) {
    let Some(tray) = app.tray_by_id(TRAY_ID) else {
        return;
    };
    match build_menu(app, scale) {
        Ok(menu) => {
            if let Err(error) = tray.set_menu(Some(menu)) {
                eprintln!("[tray] 메뉴를 갱신하지 못했습니다: {error}");
            }
        }
        Err(error) => eprintln!("[tray] 메뉴를 다시 만들지 못했습니다: {error}"),
    }
}

fn handle_tray_event<R: Runtime>(tray: &tauri::tray::TrayIcon<R>, event: TrayIconEvent) {
    // 왼쪽 클릭으로 창을 불러온다. 최소화해두면 이것 말고는 되돌릴 길이 없다.
    let TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        ..
    } = event
    else {
        return;
    };

    let app = tray.app_handle();
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
}
