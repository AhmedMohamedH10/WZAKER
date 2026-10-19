// WZAKER Tauri (Linux) — backend Rust
// Frontend = original HTML/CSS/JS (reused verbatim). Native features via plugins + tray + shortcuts.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn open_url(url: String) {
    let _ = open::that(url);
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .plugin(tauri_plugin_global_shortcut::Builder::new().with_handler(|app, shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                if let Some(w) = app.get_webview_window("main") {
                    if w.is_visible().unwrap_or(false) {
                        let _ = w.hide();
                    } else {
                        let _ = w.show();
                        let _ = w.set_focus();
                    }
                }
            }
            let _ = shortcut;
        }).build())
        .invoke_handler(tauri::generate_handler![quit_app, open_url])
        .setup(|app| {
            // Tray icon
            // Global shortcut Ctrl+Alt+W
            let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyW);
            let _ = app.global_shortcut().register(shortcut);

            // Autostart: register (default off; controlled by settings)
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
