// WZAKER Tauri (Linux) — backend Rust
// Frontend = original HTML/CSS/JS (reused verbatim). Native features via plugins + tray + shortcuts.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use std::sync::Mutex;
use serde::{Deserialize, Serialize};

const CURRENT_VERSION: &str = "3.6.4-alpha01";
const REPO: &str = "AhmedMohamedH10/WZAKER";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub status: String,      // idle | checking | none | downloading | ready | error | unsupported
    pub version: String,
    pub percent: u32,
    pub error: String,
    pub latest_tag: String,
    pub download_url: String,
}

impl Default for UpdateInfo {
    fn default() -> Self {
        UpdateInfo { status: "idle".into(), version: String::new(), percent: 0, error: String::new(), latest_tag: String::new(), download_url: String::new() }
    }
}
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

#[tauri::command]
fn trigger_tick() { /* frontend handles via event */ }

fn start_global_scroll(app: &tauri::AppHandle) {
    let app = app.clone();
    std::thread::spawn(move || {
        use rdev::{listen, Event, EventType};
        let mut last: i64 = 0;
        if let Err(e) = listen(move |event: Event| {
            if let EventType::Wheel { .. } = event.event_type {
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_millis() as i64)
                    .unwrap_or(0);
                if now - last > 200 {
                    let _ = app.emit("global_tick", ());
                    last = now;
                }
            }
        }) {
            eprintln!("rdev listen error: {:?}", e);
        }
    });
}

pub struct AppState {
    pub upd: Mutex<UpdateInfo>,
}

#[tauri::command]
async fn check_update(state: tauri::State<'_, AppState>) -> Result<UpdateInfo, String> {
    let url = format!("https://api.github.com/repos/{}/releases/latest", REPO);
    let client = reqwest::Client::builder()
        .user_agent("wzaker-updater")
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client.get(&url).send().await.map_err(|_| "network".to_string())?;
    if !resp.status().is_success() {
        return Ok(UpdateInfo { status: "none".into(), error: "no-release".into(), ..Default::default() });
    }
    let v: serde_json::Value = resp.json().await.map_err(|_| "parse".to_string())?;
    let tag = v.get("tag_name").and_then(|t| t.as_str()).unwrap_or("").trim_start_matches('v').to_string();
    let html = v.get("html_url").and_then(|t| t.as_str()).unwrap_or("").to_string();
    let newer = tag != CURRENT_VERSION && !tag.is_empty();
    Ok(UpdateInfo {
        status: if newer { "ready".into() } else { "none".into() },
        version: tag.clone(),
        percent: if newer { 100 } else { 0 },
        latest_tag: tag,
        download_url: html,
        ..Default::default()
    })
}

#[tauri::command]
fn install_update(state: tauri::State<'_, AppState>) {
    let u = state.upd.lock().unwrap();
    if !u.download_url.is_empty() {
        let _ = open::that(u.download_url.clone());
    }
}

pub fn run() {
    tauri::Builder::default()
        .manage(AppState { upd: Mutex::new(UpdateInfo::default()) })
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
        .invoke_handler(tauri::generate_handler![quit_app, open_url, check_update, install_update, trigger_tick])
        .setup(|app| {
            // Tray icon
            // Global shortcut Ctrl+Alt+W
            let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyW);
            let _ = app.global_shortcut().register(shortcut);

            // Tray icon
            let show_i = MenuItem::with_id(app, "show", "إظهار السبحة", true, None::<&str>)?;
            let hide_i = MenuItem::with_id(app, "hide", "إخفاء", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "خروج", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &hide_i, &quit_i])?;
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => { if let Some(w) = app.get_webview_window("main") { let _ = w.show(); let _ = w.set_focus(); } }
                    "hide" => { if let Some(w) = app.get_webview_window("main") { let _ = w.hide(); } }
                    "quit" => { app.exit(0); }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            if w.is_visible().unwrap_or(false) { let _ = w.hide(); } else { let _ = w.show(); let _ = w.set_focus(); }
                        }
                    }
                })
                .build(app)?;

            // Global scroll (X11/XWayland via rdev)
            start_global_scroll(app.handle());

            // Autostart: register (default off; controlled by settings)
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
