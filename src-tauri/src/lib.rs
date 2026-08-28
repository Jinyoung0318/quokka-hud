mod collector;
mod polling;
mod scale;
mod settings;
mod tray;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            collector::fetch_usage_output,
            scale::window_scale,
            scale::cycle_window_scale,
            polling::poll_interval,
            polling::cycle_poll_interval
        ])
        .setup(|app| {
            let handle = app.handle().clone();

            // 저장된 배율과 위치를 창이 보이기 전에 적용한다.
            let stored = settings::load(&handle);
            app.manage(settings::SettingsState::new(stored));

            if let Some(window) = app.get_webview_window("main") {
                settings::apply(&window, &stored);
            }

            tray::build(&handle)?;
            Ok(())
        })
        .on_window_event(|window, event| match event {
            // 드래그로 옮길 때마다 온다. 파일 쓰기는 안에서 걸러낸다.
            tauri::WindowEvent::Moved(position) => {
                settings::remember_position(window.app_handle(), position.x, position.y);
            }
            // 스로틀에 걸려 아직 안 쓴 마지막 위치를 여기서 마저 쓴다.
            tauri::WindowEvent::CloseRequested { .. } | tauri::WindowEvent::Destroyed => {
                settings::flush(window.app_handle());
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
