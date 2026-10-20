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
        let _ = m.set_focusable(false);   // ما تسرقش تركيز الكيبورد من باقي التطبيقات
        place_bottom_right(&m);
        eprintln!("[wzaker] splash_done → main_shown");
        let _ = app.emit("main_shown", ());
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
    *app.state::<AppState>().mini.lock().unwrap() = mini;
    if let Some(w) = app.get_webview_window("main") {
        let (cw, ch) = if mini { CARD_MINI } else { CARD_FULL };
        let _ = w.set_size(LogicalSize::new(cw + GLOW * 2.0, ch + GLOW * 2.0));
        place_bottom_right(&w);
    }
}

/// التشغيل تلقائي مع النظام (XDG autostart) — زي "التشغيل مع ويندوز"
#[tauri::command]
fn set_autostart(enabled: bool) -> Result<(), String> {
    let dir = std::path::PathBuf::from(std::env::var("HOME").unwrap_or_default())
        .join(".config")
        .join("autostart");
    let _ = std::fs::create_dir_all(&dir);
    let f = dir.join("wzaker.desktop");
    if !enabled {
        let _ = std::fs::remove_file(&f);
        return Ok(());
    }
    // مسار التنفيذ الفعلي
    let exec = if std::path::Path::new("/usr/bin/wzaker").exists() {
        "/usr/bin/wzaker".to_string()
    } else if let Ok(cur) = std::env::current_exe() {
        cur.to_string_lossy().to_string()
    } else {
        "wzaker".to_string()
    };
    let content = format!(
        "[Desktop Entry]\nType=Application\nName=ذكر\nComment=سبحة وأذكار\nExec={}\nIcon=wzaker\nTerminal=false\nX-GNOME-Autostart-enabled=true\n",
        exec
    );
    std::fs::write(&f, content).map_err(|e| e.to_string())
}

/// إخفاء النافذة (ختفي للـ tray) — زي زر "–"
#[tauri::command]
fn hide_window(app: tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.hide();
    }
}

/// مناطق التفاعل (من الواجهة) — لتفعيل الـ click-through
#[tauri::command]
fn set_hit_rects(app: tauri::AppHandle, rects: Vec<Vec<f64>>) {
    let st = app.state::<AppState>();
    let v: Vec<(f64, f64, f64, f64)> = rects
        .into_iter()
        .filter(|r| r.len() == 4 && r.iter().all(|x| x.is_finite()))
        .take(64)
        .map(|r| (r[0], r[1], r[2], r[3]))
        .collect();
    eprintln!("[wzaker] مناطق التفاعل: {}", v.len());
    *st.hit.lock().unwrap() = v;
}

/// ضبط شكل الإدخال (X11 SHAPE) — الماوس بيعدّي فوق النافذة إلا فوق العناصر التفاعلية
fn apply_input_shape(app: &tauri::AppHandle, rects: &[(f64, f64, f64, f64)], full: bool, conn: &Option<(x11rb::rust_connection::RustConnection, usize)>) {
    use raw_window_handle::{HasWindowHandle, RawWindowHandle};
    use x11rb::connection::Connection;
    use x11rb::protocol::shape::{ConnectionExt as ShapeExt, SK, SO};
    use x11rb::protocol::xproto::{ClipOrdering, Rectangle};

    let Some(w) = app.get_webview_window("main") else { return };
    if !w.is_visible().unwrap_or(false) { return }
    if rects.is_empty() && !full { return }

    // معرّف نافذة X11
    let Ok(handle) = w.window_handle() else { return };
    let xid: u32 = match handle.as_raw() {
        RawWindowHandle::Xlib(x) => x.window as u32,
        RawWindowHandle::Xcb(x) => x.window.get(),
        _ => return,
    };

    let scale = w.scale_factor().unwrap_or(1.0);
    let mut rs: Vec<Rectangle> = rects
        .iter()
        .filter_map(|r| {
            let x = (r.0 * scale).round().max(0.0) as i16;
            let y = (r.1 * scale).round().max(0.0) as i16;
            let wd = (r.2 * scale).round().max(1.0) as u16;
            let ht = (r.3 * scale).round().max(1.0) as u16;
            if wd == 0 || ht == 0 { None } else { Some(Rectangle { x, y, width: wd, height: ht }) }
        })
        .collect();
    // في الوضع المصغّر أو أثناء السحب: النافذة كلها تفاعلية
    if full {
        let size = w.inner_size().unwrap_or(tauri::PhysicalSize::new(0, 0));
        rs = vec![Rectangle { x: 0, y: 0, width: size.width as u16, height: size.height as u16 }];
    }
    if rs.is_empty() { return; }
    // شكل الإدخال = المناطق التفاعلية فقط
    if let Some((conn, _)) = conn {
        let res = conn.shape_rectangles(
            SO::SET,
            SK::INPUT,
            ClipOrdering::UNSORTED,
            xid,
            0,
            0,
            &rs,
        );
        match res {
            Ok(_) => { let _ = conn.flush(); }
            Err(e) => eprintln!("[wzaker] فشل ضبط شكل الإدخال: {}", e),
        }
    }
    rs.clear();
}

/// ضغط مطوّل (سحب/سلايدر) — يوقف الـ click-through
#[tauri::command]
fn set_hold(app: tauri::AppHandle, on: bool) {
    *app.state::<AppState>().hold.lock().unwrap() = on;
}

/// نافذة الإشعار المنبثق (آية التذكير / بطاقات التحدي)
#[tauri::command]
fn popup_show(app: tauri::AppHandle, kind: String, payload: String) {
    let st = app.state::<AppState>();
    let mut data = serde_json::json!({ "kind": kind });
    if let Ok(p) = serde_json::from_str::<serde_json::Value>(&payload) {
        data = p;
    }
    *st.popup.lock().unwrap() = Some(data);

    // 위치 النافذة: فوق المسبحة (أسفل يمين الشاشة)
    let mut pos: Option<(i32, i32)> = None;
    if let Some(main) = app.get_webview_window("main") {
        if let (Ok(p), Ok(s)) = (main.outer_position(), main.outer_size()) {
            let scale = main.scale_factor().unwrap_or(1.0);
            pos = Some((
                p.x + s.width as i32 - 340,
                p.y - 220,
            ));
            let _ = scale;
        }
    }

    if let Some(old) = app.get_webview_window("popup") {
        let _ = old.close();
    }
    let mut builder = WebviewWindowBuilder::new(&app, "popup", WebviewUrl::App(std::path::PathBuf::from("popup.html")))
        .inner_size(320.0, 200.0)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .resizable(false)
        .visible(true);
    if let Some((x, y)) = pos {
        builder = builder.position(x as f64, y as f64);
    }
    let _ = builder.build();
}

#[tauri::command]
fn popup_get(app: tauri::AppHandle) -> Option<serde_json::Value> {
    app.state::<AppState>().popup.lock().unwrap().clone()
}

#[tauri::command]
fn popup_close(app: tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("popup") {
        let _ = w.close();
    }
    *app.state::<AppState>().popup.lock().unwrap() = None;
}

#[tauri::command]
fn popup_pick(app: tauri::AppHandle, index: i32) {
    if let Some(w) = app.get_webview_window("popup") {
        let _ = w.close();
    }
    *app.state::<AppState>().popup.lock().unwrap() = None;
    let _ = index;
}

/// النسخ الاحتياطي: حفظ / عرض / استرجاع
fn backup_dir() -> std::path::PathBuf {
    std::path::PathBuf::from(std::env::var("HOME").unwrap_or_default())
        .join("Documents")
        .join("WZAKER-backups")
}

#[tauri::command]
fn backup_export(app: tauri::AppHandle, data: String) -> Result<String, String> {
    let dir = backup_dir();
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let name = format!("wzaker-backup-{}.json", chrono_like_stamp());
    let path = dir.join(name);
    std::fs::write(&path, data).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

fn chrono_like_stamp() -> String {
    let d = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("{}", d)
}

#[tauri::command]
fn backup_list() -> Vec<String> {
    let dir = backup_dir();
    let mut v: Vec<String> = std::fs::read_dir(&dir)
        .map(|rd| {
            rd.filter_map(|e| e.ok())
                .map(|e| e.path().to_string_lossy().to_string())
                .filter(|p| p.ends_with(".json"))
                .collect()
        })
        .unwrap_or_default();
    v.sort();
    v.reverse();
    v
}

#[tauri::command]
fn backup_import(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

/// إرسال الأزرار المخصصة واختصارات الأوامر للـ backend (من الواجهة)
#[tauri::command]
fn set_keys(
    app: tauri::AppHandle,
    custom: Option<CustomKey>,
    hotkeys: Option<std::collections::HashMap<String, CustomKey>>,
    space: Option<bool>,
) {
    let st = app.state::<AppState>();
    *st.custom.lock().unwrap() = custom;
    if let Some(h) = hotkeys {
        *st.hotkeys.lock().unwrap() = h;
    }
    if let Some(sp) = space {
        *st.space.lock().unwrap() = sp;
    }
}

/// مسار ملف الحالة
fn state_file() -> std::path::PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    std::path::PathBuf::from(home).join(".config").join("WZAKER").join("state.json")
}

/// تحميل الحالة المحفوظة (ملف) — عشان الإعدادات ما تضيعش
#[tauri::command]
fn load_state() -> Option<String> {
    std::fs::read_to_string(state_file()).ok()
}

/// حفظ الحالة في ملف
#[tauri::command]
fn save_state(json: String) -> Result<(), String> {
    let f = state_file();
    if let Some(parent) = f.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    std::fs::write(&f, json).map_err(|e| e.to_string())
}

/// تسجيل نص في اللوج (تشخيص)
#[tauri::command]
fn log_msg(msg: String) {
    eprintln!("[wzaker] {}", msg);
}

/// التقاط زر/اختصار مخصص (زي F1 أو Ctrl+G) — زي نسخة ويندوز
#[tauri::command]
fn capture_key(_app: tauri::AppHandle, target: String) {
    *CAPTURE_TARGET.lock().unwrap() = target;
    CAPTURE_ON.store(true, std::sync::atomic::Ordering::SeqCst);
    eprintln!("[wzaker] في وضع التقاط الزر");
}

/// إلغاء التقاط الزر
#[tauri::command]
fn cancel_capture() {
    CAPTURE_ON.store(false, std::sync::atomic::Ordering::SeqCst);
}

#[tauri::command]
fn trigger_tick() { /* frontend handles via event */ }

/// آخر تمريرة عجلة (debounce عام لكل المصادر) — يمنع العدّ المزدوج
static LAST_WHEEL: std::sync::atomic::AtomicI64 = std::sync::atomic::AtomicI64::new(0);

fn emit_wheel_tick(app: &tauri::AppHandle) {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);
    let last = LAST_WHEEL.load(std::sync::atomic::Ordering::Relaxed);
    if now - last < 200 {
        return;   // نفس حركة التمرير = تسبيحة واحدة
    }
    LAST_WHEEL.store(now, std::sync::atomic::Ordering::Relaxed);
    eprintln!("[wzaker] تمرير عجلة → تسبيحة");
    let _ = app.emit("global_tick", ());
}

/// عدّ عجلة الماوس العام على لينكس (evdev) — يشتغل على Wayland و X11 معًا
/// (المستخدم يحتاج صلاحية قراءة /dev/input — مجموعة input)
#[cfg(target_os = "linux")]
fn start_evdev_scroll(app: &tauri::AppHandle) {
    use std::io::Read;
    use std::os::unix::io::AsRawFd;

    const EV_REL: u16 = 2;
    const EV_KEY: u16 = 1;
    const REL_WHEEL: u16 = 8;          // عجلة الفأرة
    const REL_WHEEL_HI_RES: u16 = 11; // تمرير عالي الدقة (لوحات اللمس)
    const EVIOCGBIT_KEY: libc::c_ulong = 0x8004_4521;   // _IOR('E', 0x20+1, 4) → EV_KEY
    const EVIOCGBIT_REL: libc::c_ulong = 0x8004_4522;   // _IOR('E', 0x20+2, 4) → EV_REL

    let app2 = app.clone();
    std::thread::spawn(move || {
        let mut opened: Vec<String> = Vec::new();
        loop {
        // إعادة الفحص كل مرة (أجهزة تُوصل أثناء التشغيل)
        let Ok(rd) = std::fs::read_dir("/dev/input") else {
            eprintln!("[wzaker] evdev: مفيش صلاحية على /dev/input");
            return;
        };
        for entry in rd.flatten() {
            let path = entry.path();
            let fname = path
                .file_name()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();
            if !fname.starts_with("event") {
                continue;
            }
            let Ok(file) = std::fs::File::open(&path) else { continue };

            // قدرات الجهاز: EV_KEY (لوحة مفاتيح) و EV_REL (فأرة)
            let mut kbits = [0u8; 64];
            let mut rbits = [0u8; 64];
            let rck = unsafe { libc::ioctl(file.as_raw_fd(), EVIOCGBIT_KEY, kbits.as_mut_ptr()) };
            let rcr = unsafe { libc::ioctl(file.as_raw_fd(), EVIOCGBIT_REL, rbits.as_mut_ptr()) };
            if rck < 0 && rcr < 0 {
                continue;
            }
            let has_key = |code: u16| -> bool {
                let byte = (code / 8) as usize;
                let bit = code % 8;
                byte < kbits.len() && (kbits[byte] & (1u8 << bit)) != 0
            };
            let has_wheel = |code: u16| -> bool {
                let byte = (code / 8) as usize;
                let bit = code % 8;
                byte < rbits.len() && (rbits[byte] & (1u8 << bit)) != 0
            };
            // لوحة مفاتيح: فيها مفاتيح كتابة (مسافة/إدخال/A/F1) — الفأرة ما عندهاش كده
            let is_keyboard = has_key(57) || has_key(28) || has_key(30) || has_key(59);
            if !has_wheel(REL_WHEEL) && !has_wheel(REL_WHEEL_HI_RES) {
                if !is_keyboard {
                    continue;   // جهاز تاني (إضاءة/أزرار) — يتجاهَل
                }
                // لوحة المفاتيح: تُقرأ فقط لو محتاجينها (Space أو زر مخصص)
                if !app3_needs_keys(&app2) {
                    continue;
                }
            }

            if opened.contains(&fname) {
                continue;
            }
            eprintln!("[wzaker] evdev: {}", &fname);
            opened.push(fname.clone());
            let app3 = app2.clone();
            std::thread::spawn(move || {
                let mut file = file;
                let mut buf = [0u8; 24];   // struct input_event (64-bit)
                let mut mods = KeyMods { shift: false, alt: false, ctrl: false, meta: false };
                loop {
                    if file.read_exact(&mut buf).is_err() {
                        break;
                    }
                    let typ = u16::from_ne_bytes([buf[16], buf[17]]);
                    let code = u16::from_ne_bytes([buf[18], buf[19]]);
                    let value = i32::from_ne_bytes([buf[20], buf[21], buf[22], buf[23]]);
                    let pressed = value == 0;   // 0 = ضُغط
                    match code {
                        29 | 97 => mods.ctrl = pressed,
                        42 | 54 => mods.shift = pressed,
                        56 | 100 => mods.alt = pressed,
                        125 | 126 => mods.meta = pressed,
                        _ => {}
                    }
                    if typ == EV_REL && (code == REL_WHEEL || code == REL_WHEEL_HI_RES) {
                        emit_wheel_tick(&app3);
                    }
                    if typ == EV_KEY && CAPTURE_ON.load(std::sync::atomic::Ordering::SeqCst) {
                        // التقاط الزر المطلوب (من لوحة المفاتيح)
                        CAPTURE_ON.store(false, std::sync::atomic::Ordering::SeqCst);
                        let target = CAPTURE_TARGET.lock().unwrap().clone();
                        let bcode = linux_code_to_browser(code).unwrap_or_else(|| format!("Key{}", code));
                        let _ = app3.emit("key_captured", serde_json::json!({
                            "target": target, "code": bcode, "name": bcode,
                            "ctrl": mods.ctrl, "alt": mods.alt, "shift": mods.shift, "meta": mods.meta,
                        }));
                    }
                    if typ == EV_KEY {
                        // Space (لو مفعّل) + الزر المخصص + اختصارات الأوامر
                        if code == 57 {   // KEY_SPACE
                            let sp = app3.state::<AppState>();
                            if *sp.space.lock().unwrap() {
                                let _ = app3.emit("global_space", ());
                            }
                        } else if let Some(bcode) = linux_code_to_browser(code) {
                            let st = app3.state::<AppState>();
                            let ck = st.custom.lock().unwrap().clone();
                            let hit = |k: &CustomKey| -> bool {
                                k.code.eq_ignore_ascii_case(&bcode)
                                    && k.ctrl == mods.ctrl && k.alt == mods.alt
                                    && k.shift == mods.shift && k.meta == mods.meta
                            };
                            if let Some(ck) = ck {
                                if hit(&ck) {
                                    let _ = app3.emit("global_custom_key", ());
                                }
                            }
                            let hks = st.hotkeys.lock().unwrap().clone();
                            for (action, k) in hks.iter() {
                                if hit(k) {
                                    let _ = app3.emit("global_hotkey", action.clone());
                                }
                            }
                        }
                    }
                }
            });
        }
        std::thread::sleep(std::time::Duration::from_millis(2000));
        }
    });
}

fn start_global_scroll(app: &tauri::AppHandle) {
    // عجلة الماوس (X11) — بجانب evdev
    let app = app.clone();
    std::thread::spawn(move || {
        use rdev::{listen, Event, EventType};
        if let Err(e) = listen(move |event: Event| {
            if let EventType::Wheel { .. } = event.event_type {
                emit_wheel_tick(&app);
            }
        }) {
            eprintln!("rdev listen error: {:?}", e);
        }
    });
}

/// وضع النافذة في أسفل يمين الشاشة (زي نسخة ويندوز)
fn place_bottom_right(w: &WebviewWindow) {
    let monitor = w
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| w.primary_monitor().ok().flatten())
        .or_else(|| {
            // Wayland: مفيش monitor مباشر — ناخد أول شاشة متاحة
            w.available_monitors()
                .ok()
                .and_then(|m| m.into_iter().next())
        });
    let Some(monitor) = monitor else {
        eprintln!("[wzaker] مفيش مonitor");
        return;
    };
    let scale = monitor.scale_factor();
    // المقاس المعروف من الإعدادات (النافذة ممكن تكون مخفية فـ outer_size = 0)
    let size = w.outer_size().unwrap_or(tauri::PhysicalSize::new(0, 0));
    let (lw, lh) = if size.width == 0 || size.height == 0 {
        (CARD_FULL.0 + GLOW * 2.0, CARD_FULL.1 + GLOW * 2.0)
    } else {
        (size.width as f64 / scale, size.height as f64 / scale)
    };
    let m = monitor.size();
    let mp = monitor.position();
    let x = (m.width as f64) / scale - lw - EDGE + (mp.x as f64) / scale;
    let y = (m.height as f64) / scale - lh - EDGE + (mp.y as f64) / scale;
    let _ = w.set_position(PhysicalPosition::new(
        (x.max(0.0) * scale) as i32,
        (y.max(0.0) * scale) as i32,
    ));
    eprintln!("[wzaker] المسبحة: x={} y={} (شاشة {}x{})", x as i32, y as i32, m.width, m.height);
}

pub struct AppState {
    pub upd: Mutex<UpdateInfo>,
    pub hit: Mutex<Vec<(f64, f64, f64, f64)>>,   // مناطق التفاعل (click-through)
    pub hold: Mutex<bool>,                        // ضغط مطوّل (سحب/سلايدر)
    pub mini: Mutex<bool>,
    pub popup: Mutex<Option<serde_json::Value>>,  // بيانات نافذة الإشعار
    pub custom: Mutex<Option<CustomKey>>,          // الزر/الاختصار المخصص للعدّ
    pub hotkeys: Mutex<std::collections::HashMap<String, CustomKey>>,  // اختصارات الأوامر
    pub space: Mutex<bool>,                                        // العدّ بـ Space
}

/// زر مخصص: كود المتصفح + الموديفاير
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct CustomKey {
    pub code: String,
    pub ctrl: bool,
    pub alt: bool,
    pub shift: bool,
    pub meta: bool,
    pub name: String,
}

static CAPTURE_ON: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
static CAPTURE_TARGET: Mutex<String> = Mutex::new(String::new());

/// هل المستخدم محتاج قراءة لوحة المفاتيح؟ (Space مفعّل أو زر مخصص)
fn app3_needs_keys(app: &tauri::AppHandle) -> bool {
    app.try_state::<AppState>()
        .map(|st| {
            *st.space.lock().unwrap() || st.custom.lock().unwrap().is_some()
        })
        .unwrap_or(false)
}

/// موديفايرز من حدث evdev
#[derive(Clone, Copy)]
struct KeyMods { shift: bool, alt: bool, ctrl: bool, meta: bool }

/// ترجمة كود لينكس (evdev) لكود المتصفح
fn linux_code_to_browser(code: u16) -> Option<String> {
    let s = match code {
        1 => "Escape", 14 => "Backspace", 15 => "Tab", 28 => "Enter", 57 => "Space",
        16 => "KeyQ", 17 => "KeyW", 18 => "KeyE", 19 => "KeyR", 20 => "KeyT",
        21 => "KeyY", 22 => "KeyU", 23 => "KeyI", 24 => "KeyO", 25 => "KeyP",
        30 => "KeyA", 31 => "KeyS", 32 => "KeyD", 33 => "KeyF", 34 => "KeyG",
        35 => "KeyH", 36 => "KeyJ", 37 => "KeyK", 38 => "KeyL",
        44 => "KeyZ", 45 => "KeyX", 46 => "KeyC", 47 => "KeyV", 48 => "KeyB",
        49 => "KeyN", 50 => "KeyM",
        2 => "Digit1", 3 => "Digit2", 4 => "Digit3", 5 => "Digit4", 6 => "Digit5",
        7 => "Digit6", 8 => "Digit7", 9 => "Digit8", 10 => "Digit9", 11 => "Digit0",
        59 => "F1", 60 => "F2", 61 => "F3", 62 => "F4", 63 => "F5", 64 => "F6",
        65 => "F7", 66 => "F8", 67 => "F9", 68 => "F10", 69 => "F11", 70 => "F12",
        29 => "ControlLeft", 42 => "ShiftLeft", 56 => "AltLeft", 125 => "MetaLeft",
        _ => return None,
    };
    Some(s.to_string())
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
        .manage(AppState {
            upd: Mutex::new(UpdateInfo::default()),
            hit: Mutex::new(Vec::new()),
            hold: Mutex::new(false),
            mini: Mutex::new(false),
            popup: Mutex::new(None),
            custom: Mutex::new(None),
            hotkeys: Mutex::new(std::collections::HashMap::new()),
            space: Mutex::new(false),
        })
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
        .invoke_handler(tauri::generate_handler![quit_app, open_url, check_update, install_update, trigger_tick, splash_done, open_settings, set_window_mode, set_autostart, hide_window,
    set_hit_rects, set_hold, popup_show, popup_get, popup_close, popup_pick, log_msg, capture_key, set_keys, cancel_capture, load_state, save_state,
    backup_export, backup_list, backup_import])
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

            // عدّ عجلة الماوس العام: evdev (Wayland + X11) + rdev (fallback)
            start_evdev_scroll(app.handle());
            start_global_scroll(app.handle());

            // click-through: الماوس بيعدّي فوق النافذة إلا فوق العناصر التفاعلية
            // (شكل الإدخال في X11 — مناطق التفاعلية بس هي اللي بتستقبل النقر)
            let handle = app.handle().clone();
            let click_through_on = std::env::var("WZAKER_CLICK_THROUGH")
                .map(|v| v != "0" && !v.is_empty())
                .unwrap_or(true);
            std::thread::spawn(move || {
                // مهلة أولية: نستنى لحد ما النافذة تتظهور فعليًا
                std::thread::sleep(std::time::Duration::from_millis(2500));
                let conn = if click_through_on {
                    match x11rb::connect(None) {
                        Ok(c) => Some(c),
                        Err(_) => {
                            eprintln!("[wzaker] تعذّر فتح اتصال X11 — بدون click-through");
                            None
                        }
                    }
                } else {
                    None
                };
                loop {
                    std::thread::sleep(std::time::Duration::from_millis(700));
                    let st = handle.state::<AppState>();
                    let rects = st.hit.lock().unwrap().clone();
                    let holding = *st.hold.lock().unwrap();
                    let mini = *st.mini.lock().unwrap();
                    if holding || mini {
                        apply_input_shape(&handle, &rects, true, &conn);   // تفاعل كامل
                        continue;
                    }
                    apply_input_shape(&handle, &rects, false, &conn);
                }
            });

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
            // المسبحة: أسفل يمين الشاشة (بعد ما النافذة تاخد مقاسها النهائي)
            {
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    for _ in 0..100 {
                        std::thread::sleep(std::time::Duration::from_millis(150));
                        if let Some(mw) = handle.get_webview_window("main") {
                            place_bottom_right(&mw);
                        }
                    }
                });
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
                    place_bottom_right(&m);
                    eprintln!("[wzaker] safety → main_shown");
                    let _ = handle.emit("main_shown", ());
                }
            });

            // Autostart: register (default off; controlled by settings)
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
