// WZAKER Tauri (Linux) — backend Rust
// Frontend = original HTML/CSS/JS (reused verbatim). Native features via plugins + tray + shortcuts.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, LogicalSize, Manager, PhysicalPosition, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};
use std::sync::Mutex;
use serde::{Deserialize, Serialize};

const CURRENT_VERSION: &str = "3.6.4";
const GLOW: f64 = 18.0;                       // هامش التوهج (زي main.js)
const CARD_FULL: (f64, f64) = (258.0, 354.0);  // كارت المسبحة
const CARD_MINI: (f64, f64) = (232.0, 48.0);
const EDGE: f64 = 24.0;                        // هامش من حافة الشاشة
const SPLASH_SIZE: (f64, f64) = (640.0, 420.0);
const SETTINGS_SIZE: (f64, f64) = (720.0, 720.0);
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

/// إنهاء شاشة اللوجو وإظهار المسبحة
#[tauri::command]
fn splash_done(app: tauri::AppHandle) {
    if let Some(s) = app.get_webview_window("splash") {
        let _ = s.close();
    }
    if let Some(m) = app.get_webview_window("main") {
        let _ = m.show();
        let _ = m.set_focus();
    }
}

/// فتح نافذة الإعدادات (settings.html) — زي نسخة ويندوز
#[tauri::command]
fn open_settings(app: tauri::AppHandle, focus: Option<String>) {
    if let Some(w) = app.get_webview_window("settings") {
        let _ = w.show();
        let _ = w.set_focus();
        return;
    }
    let url = match focus {
        Some(f) if !f.is_empty() => format!("settings.html#{}", f),
        _ => "settings.html".to_string(),
    };
    let _ = WebviewWindowBuilder::new(&app, "settings", WebviewUrl::App(std::path::PathBuf::from(url)))
        .inner_size(SETTINGS_SIZE.0, SETTINGS_SIZE.1)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .resizable(false)
        .build();
}

/// تصغير/تكبير المسبحة (mini mode) + إعادة تموضعها
#[tauri::command]
fn set_window_mode(app: tauri::AppHandle, mini: bool) {
    if let Some(w) = app.get_webview_window("main") {
        let (cw, ch) = if mini { CARD_MINI } else { CARD_FULL };
        let _ = w.set_size(LogicalSize::new(cw + GLOW * 2.0, ch + GLOW * 2.0));
        place_bottom_right(&w);
    }
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

/// وضع النافذة في أسفل يمين الشاشة (زي نسخة ويندوز)
fn place_bottom_right(w: &WebviewWindow) {
    if let Ok(Some(monitor)) = w.current_monitor() {
        let scale = monitor.scale_factor();
        let size = w.outer_size().unwrap_or(tauri::PhysicalSize::new(0, 0));
        let m = monitor.size();
        let x = (m.width as f64) / scale - (size.width as f64) / scale - EDGE;
        let y = (m.height as f64) / scale - (size.height as f64) / scale - EDGE;
        let _ = w.set_position(PhysicalPosition::new(
            (x.max(0.0) * scale) as i32,
            (y.max(0.0) * scale) as i32,
        ));
    }
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
        .plugin(tauri_plugin_updater::Builder::new().build())
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
        .invoke_handler(tauri::generate_handler![quit_app, open_url, check_update, install_update, trigger_tick, splash_done, open_settings, set_window_mode])
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

            // شاشة اللوجو عند البدء (splash.html) — بتقفل نفسها لما تخلص
            if let Ok(sp) = WebviewWindowBuilder::new(app, "splash", WebviewUrl::App(std::path::PathBuf::from("splash.html")))
                .inner_size(SPLASH_SIZE.0, SPLASH_SIZE.1)
                .decorations(false)
                .transparent(true)
                .always_on_top(true)
                .resizable(false)
                .visible(true)
                .build()
            {
                let _ = sp.center();   // شاشة اللوجو في نص الشاشة (زي نسخة ويندوز)
            }
            // المسبحة: أسفل يمين الشاشة
            if let Some(mw) = app.get_webview_window("main") {
                place_bottom_right(&mw);
            }
            // شبكة أمان: لو اللوجو ما قفلتش بنفسها
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(9000));
                if let Some(s) = handle.get_webview_window("splash") {
                    let _ = s.close();
                }
                if let Some(m) = handle.get_webview_window("main") {
                    let _ = m.show();
                }
            });

            // Autostart: register (default off; controlled by settings)
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
