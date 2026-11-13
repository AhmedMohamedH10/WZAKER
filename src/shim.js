// WZAKER Tauri shim — يوفر window.azkar و window.wzx (بدلاً من Electron IPC)
// الحالة تُحفظ في localStorage؛ العدّ والعرض يعملان دون backend Rust.
(function () {
  'use strict';

  const KEY = 'wzaker-state-v1';
  const windowLabel = () => {
    try { return window.__TAURI__?.window?.getCurrentWindow?.()?.label || 'main'; } catch (_) { return 'main'; }
  };

  // ── روابط التواصل (نفس روابط نسخة ويندوز) ─────────────────────────────
  const CONTACT_LINKS = {
    fb: 'https://www.facebook.com/AKA.AlHussin',
    dc: 'https://discord.com/users/339177356843548673',
    wa: 'https://wa.link/lv4cu4',
    sg: 'https://tally.so/r/QKgVQl',
    site: 'https://wzaker.site',
    // مطوّر نسخة لينكس — محمد زيتون
    fb2: 'https://www.facebook.com/mohamedzaitoon2',
    dc2: 'https://discord.com/users/mohamedzaitoon2',
    wa2: 'https://wa.me/mohamedzaitoon2',
  };

  // قراءة ملف من الحزمة كـ data URL (اللوجو/البانر)
  const assetDataUrl = (path) => {
    try {
      return fetch(path).then(r => r.blob()).then(b => new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result);
        fr.onerror = rej;
        fr.readAsDataURL(b);
      })).catch(() => null);
    } catch (_) { return Promise.resolve(null); }
  };

  // ── ملفات الصوت المرفقة (نفس أسماء main.js في ويندوز) ───────────────────
  const AUDIO_FILES = {
    uiclick: 'assets/audio/UI_Click.mp3',
    wird: 'assets/audio/Wird.mp3',
    birds: 'assets/audio/Birds.mp3',
    owl: 'assets/audio/OWL.mp3',
    sleep: 'assets/audio/Sleep.mp3',
    wake: 'assets/audio/Wake.mp3',
    athan: 'assets/audio/Athan.mp3',
    click: 'assets/audio/Click.mp3',
    done: 'assets/audio/Completion.mp3',
    startup: 'assets/audio/Startup.mp3',
    exit: 'assets/audio/Exit.mp3',
    reminder: 'assets/audio/Reminder.mp3',
    reminder2: 'assets/audio/Reminder2.mp3',
    challenge: 'assets/audio/Challenge.mp3',
    hover: 'assets/audio/Hover.mp3'
  };

  // ── حالة افتراضية (من DEFAULT_STATE في main.js) ─────────────────────────
  const DEFAULT_STATE = {
    count: 0, total: 0,
    dhikrId: 'd0', customAzkar: [], stats: {},
    daily: {}, streak: null, dndFullscreen: false, autoAdvance: true, target: 33,
    sound: true, volume: 0.4, startupSound: true, startupVolume: 0.2,
    completionSound: true, completionVolume: 0.2, exitSound: true, exitVolume: 0.2,
    miniMode: false, miniOpacity: 0.85, idleOpacity: 0.7, spaceKey: true,
    hotkeys: { quit: null, mini: null, show: null, settings: null },
    customKeyOn: false, customKey: null, dialLocked: false, scrollOn: true, clickOn: true,
    dialStyle: 'ring', beadLight: .3, beadGlow: true, autoLaunch: false,
    reminderOn: false, reminderEvery: 1800, customAlerts: [], builtinVerses: true,
    dialLayout: null, glowV: 0, popupVolume: 0.5, reminderSound: true, reminderVolume: 0.5,
    challengeOn: true, challengeEvery: 3600, popupPos: 'corner', px: null, py: null, pe: null, pm: '', popupScale: 1,
    cardsPos: 'corner', cx: null, cy: null, cardsScale: 1,
    x: null, y: null, mx: null, my: null,
    dailyAz: { d: '', m: [], e: [], sl: [], wk: [], mq: [], pr: [], wu: [], mf: false, ef: false, slf: false, wkf: false, wd: false, wf: false },
    azSound: true, azVolume: 0.5, wirdAlert: false, wirdAt: '20:00', wirdSound: true, wirdVolume: 0.5,
    sabahAlert: false, sabahAt: '06:00', sabahEnd: '12:00',
    masaaAlert: false, masaaAt: '16:00', masaaEnd: '20:00',
    sleepAlert: false, sleepAt: '22:00', sleepEnd: '23:59',
    wakeAlert: false, wakeAt: '04:00', wakeEnd: '11:00',
    prayerAlert: false, prayerSound: true, prayerVolume: 0.2, prayerVolV: 0,
    prayerOn: { fj: true, du: true, dh: true, as: true, mg: true, is: true },
    prayerCity: 'auto', prayerLat: null, prayerLng: null, prayerPlace: '', prayerMethod: 'egypt',
    ach: {}, achInit: false, cycles: 0, bestDay: 0,
    khatma: { bits: '', start: '', days: 30, count: 0, today: { d: '', n: 0 } },
    autoUpdateOn: true, autoBackup: true, azTimeV: 0,
    audio: {}, khatmaPage: 0,
  };

  let state = null;
  try { state = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { state = null; }
  if (!state || typeof state !== 'object') state = { ...DEFAULT_STATE };
  // الحالة المحفوظة في ملف (أقوى من localStorage — بتعدّي التحديثات)
  const FILE_KEY = '__wzaker_file_state';
  try {
    const p = window.__TAURI__?.core?.invoke('load_state');
    if (p && typeof p.then === 'function') {
      p.then(txt => {
        try {
          const o = JSON.parse(txt);
          if (o && typeof o === 'object') { state = Object.assign(state, o); save(); emit('state', publicState()); }
        } catch (_) {}
      }).catch(() => {});
    }
  } catch (_) {}

  const listeners = { tick: [], state: [], stats: [], startup: [], exitPlay: [], shown: [], hover: [],
    settingsFocus: [], keyCaptured: [], popupScale: [], popupReveal: [], popupTick: [], popupSuccess: [],
    popupFail: [], inlineOpen: [], popupDocking: [], inlineHint: [], inlineClose: [], splashGo: [],
    miniMorph: [], miniBlank: [], miniApplied: [], popupLock: [], popupEdges: [], windowPos: [], stateSync: [] };

  const on = (ch, cb) => { if (listeners[ch]) listeners[ch].push(cb); };

  const emit = (ch, data) => { (listeners[ch] || []).forEach(cb => { try { cb(data); } catch (e) { try { window.__TAURI__?.core?.invoke('log_msg', { msg: 'emit ' + ch + ' ERR: ' + e }); } catch (_) {} } }); };

  // حفظ الحالة: كتابة مؤجلة (مرة كل ~1.2 ثانية) عشان ما نكتبش_localStorage_ كتير
  // (كان بيملا الـ WAL بـ 14 ميجا وبيرجّع البرنامج للـ D state)
  let saveTimer = null;
  let pendingSave = false;
  const writeState = () => {
    saveTimer = null; pendingSave = false;
    let json = '';
    try { json = JSON.stringify(state); } catch (_) { return; }
    try { localStorage.setItem(KEY, json); } catch (_) {}
    try { window.__TAURI__?.core?.invoke('save_state', { json }); } catch (_) {}
    // مزامنة فورية بين النوافذ (main / settings / popup) — الحالة كانت بتتقري مرة واحدة بس قبل كده
    try {
      window.__TAURI__?.event?.emit('state_sync', { from: windowLabel(), ts: Date.now(), json });
    } catch (_) {}
  };
  const save = () => {
    pendingSave = true;
    if (saveTimer) return;
    saveTimer = setTimeout(writeState, 1200);
  };
  window.addEventListener('beforeunload', () => { if (pendingSave) { try { clearTimeout(saveTimer); } catch (_) {} writeState(); } });

  // ── الأذكار الافتراضية (زي main.js) ──────────────────────────────────────
  const DEFAULT_AZKAR = [
    { id: 'd0', text: 'سبحان الله' },
    { id: 'd1', text: 'الحمد لله' },
    { id: 'd2', text: 'الله أكبر' },
    { id: 'd4', text: 'أستغفر الله' },
    { id: 'd3', text: 'لا إله إلا الله' },
    { id: 'd5', text: 'اللهم صلِّ على محمد' },
  ];

  const allAzkar = () => DEFAULT_AZKAR.concat(
    (state.customAzkar || []).map(c => ({ id: c.id, text: c.text, custom: true })),
  );

  const currentDhikr = () => {
    const list = allAzkar();
    return list.find(a => a.id === state.dhikrId) || list[0];
  };

  const todayKey = () => {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  };

  const todayCount = () => {
    const d = (state.daily || {})[todayKey()] || {};
    return Object.values(d).reduce((a, b) => (a || 0) + (b || 0), 0);
  };

  // ── تخصيص المسبحة: نفس قواعد main.js (الشعار والآية مقفولين) ────────────
  const LAYOUT_IDS = ['logo', 'tag', 'dial', 'num', 'of', 'dhikr', 'total', 'snd', 'btns', 'az', 'topL', 'topR'];
  const LAYOUT_LOCKED = new Set(['logo', 'tag']);
  const LAYOUT_NOHIDE = new Set(['logo']);
  const EXTRA_TYPES = ['clock', 'date', 'hijri', 'today', 'pct', 'prayer', 'text'];
  const LAYOUT_K_MIN = 0.8, LAYOUT_K_MAX = 1.6, EXTRAS_MAX = 8;
  const sanitizeLayout = L => {
    const out = { k: 1, els: {}, extras: [] };
    if (!L || typeof L !== 'object') return out;
    const n = (v, lo, hi, d) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v * 100) / 100)) : d);
    out.k = n(L.k, LAYOUT_K_MIN, LAYOUT_K_MAX, 1);
    const one = e => ({ dx: n(e && e.dx, -400, 400, 0), dy: n(e && e.dy, -400, 400, 0), s: n(e && e.s, 0.4, 3, 1) });
    for (const id of LAYOUT_IDS) {
      if (LAYOUT_LOCKED.has(id)) continue;
      const e = L.els && L.els[id];
      if (!e || typeof e !== 'object') continue;
      const o = one(e);
      if (e.hide === true && !LAYOUT_NOHIDE.has(id)) o.hide = true;
      if (o.dx || o.dy || o.s !== 1 || o.hide) out.els[id] = o;
    }
    if (Array.isArray(L.extras)) {
      const seen = new Set();
      for (const e of L.extras.slice(0, EXTRAS_MAX)) {
        if (!e || typeof e !== 'object' || !/^x\d{1,9}$/.test(e.id) || seen.has(e.id) || !EXTRA_TYPES.includes(e.type)) continue;
        seen.add(e.id);
        const o = { id: e.id, type: e.type, ...one(e) };
        if (e.type === 'text') o.text = String(e.text == null ? '' : e.text).replace(/\s+/g, ' ').trim().slice(0, 40);
        if (e.hide === true) o.hide = true;
        out.extras.push(o);
      }
    }
    return out;
  };
  // ترحيل 3.6.4 → 3.6.7: pe/pm جديدان، وأي مكان إشعار قديم غير صالح يترجع للافتراضي
  if (state.pe === undefined || state.pe === null) { state.px = null; state.py = null; state.popupScale = 1; state.pe = ''; }
  if (typeof state.pm !== 'string') state.pm = '';
  state.dialLayout = sanitizeLayout(state.dialLayout);

  // ── الحالة العامة (زي publicState في main.js) ────────────────────────────
  const publicState = () => Object.assign({}, state, {
    count: state.count || 0,
    total: state.total || 0,
    target: state.target || 33,
    dhikrId: state.dhikrId || 'd0',
    dhikrText: currentDhikr().text,
    azkar: allAzkar(),
    autoAdvance: state.autoAdvance !== false,
    todayN: todayCount(),
    customKeyName: state.customKey ? state.customKey.name : '',
    hotkeyNames: {},
    dialLayout: sanitizeLayout(state.dialLayout),
    audio: AUDIO_FILES,
    popupSaved: state.px !== null && state.px !== undefined,
    cardsSaved: state.cx !== null && state.cx !== undefined,
    dndNow: false,
    azDue: '', azRest: '', wirdDue: '',
    prayerInfo: (window.prayerInfoFor ? window.prayerInfoFor(state) : null),
    hook: 'ok', hookErr: '', hookRestarts: 0,
    appVersion: '3.6.10',
    upd: state.upd || { status: 'idle', version: '', percent: 0, error: '' },
    dailyAz: state.dailyAz || { d: '', m: [], e: [], sl: [], wk: [], mq: [], pr: [], wu: [] },
    khatma: state.khatma || { bits: '', start: '', days: 30, count: 0, today: { d: '', n: 0 } },
  });

  const api = {
    getState: () => { try { window.__TAURI__?.core?.invoke('log_msg', { msg: 'getState called' }); } catch (_) {} return Promise.resolve(publicState()); },
    getStats: () => Promise.resolve({}),
    patch: (p) => {
      if (p && typeof p === 'object') {
        if (p.updCheck) {
          state.upd = state.upd || { status: 'idle', version: '', percent: 0, error: '' };
          state.upd.status = 'checking'; save(); emit('state', { ...state });
          try {
            window.__TAURI__?.core?.invoke('check_update').then(u => {
              state.upd = Object.assign(state.upd || {}, u);
              save(); emit('state', publicState());
            }).catch(e => { state.upd.status = 'error'; state.upd.error = String(e); save(); emit('state', { ...state }); });
          } catch (e) { state.upd.status = 'error'; save(); emit('state', { ...state }); }
          delete p.updCheck;
        }
        if (p.updInstall) {
          try { window.__TAURI__?.core?.invoke('install_update'); } catch (_) {}
          delete p.updInstall;
        }
        if (typeof p.autoLaunch === 'boolean') {
          try { window.__TAURI__?.core?.invoke('set_autostart', { enabled: p.autoLaunch }); } catch (_) {}
        }
        if (typeof p.miniMode === 'boolean') {
          try { window.__TAURI__?.core?.invoke('set_window_mode', { mini: p.miniMode }); } catch (_) {}
        }
        if (typeof p.autoUpdateOn === 'boolean') {
          state.autoUpdateOn = p.autoUpdateOn;
          if (p.autoUpdateOn) { api._updTimer = setInterval(() => { try { window.__TAURI__?.core?.invoke('check_update').then(u => { state.upd = Object.assign(state.upd || {}, u); save(); emit('state', { ...state }); }); } catch (_) {} }, 6 * 3600_000); setTimeout(() => { try { window.__TAURI__?.core?.invoke('check_update').then(u => { state.upd = Object.assign(state.upd || {}, u); save(); emit('state', { ...state }); }); } catch (_) {} }, 20000); }
          else { if (api._updTimer) { clearInterval(api._updTimer); api._updTimer = null; } }
        }
        Object.assign(state, p);
      }
      save();
      emit('state', publicState());
      return Promise.resolve();
    },
    tick: () => {
      const target = state.target || 33;
      const prev = state.count;
      let completed = false;
      state.count = (state.count || 0) + 1;
      state.total = (state.total || 0) + 1;
      if (target && state.count >= target) { state.count = 0; completed = true; }
      save();
      if (completed && state.autoAdvance !== false) {
        // الانتقال للذكر التالي (زي نسخة ويندوز)
        const list = allAzkar();
        const i = list.findIndex(a => a.id === state.dhikrId);
        state.dhikrId = list[(i + 1) % list.length].id;
      }
      try { window.__TAURI__?.core?.invoke('log_msg', { msg: 'tick → ' + state.count }); } catch (_) {}
      const payload = {
        completed, shown: null,
        state: {
          count: state.count, total: state.total, target: state.target,
          dhikrId: state.dhikrId, dhikrText: currentDhikr().text, challenge: false,
        },
      };
      emit('tick', payload);
      emit('state', publicState());
      // صوت
      try { if (state.sound) { /* click sound handled by frontend? original plays in main */ } } catch (_) {}
      return Promise.resolve();
    },
    addDhikr: (text) => { state.customAzkar = state.customAzkar || []; state.customAzkar.push({ id: 'c' + Date.now(), text }); save(); emit('state', { ...state }); return Promise.resolve(state.customAzkar[state.customAzkar.length-1].id); },
    deleteDhikr: (id) => { state.customAzkar = (state.customAzkar || []).filter(x => x.id !== id); save(); emit('state', { ...state }); return Promise.resolve(); },
    setHitRects: (rects) => {
      try {
        window.__TAURI__?.core?.invoke('set_hit_rects', { rects: (rects || []).map(r => [r.x, r.y, r.w, r.h]) });
      } catch (e) { }
    },
    alive: () => {},
    hold: (on) => { try { window.__TAURI__?.core?.invoke('set_hold', { on: !!on }); } catch (_) {} },
    openSettings: (focus) => { try { window.__TAURI__?.core?.invoke('open_settings', { focus: focus || null }); } catch (_) { window.open('settings.html', 'settings', 'width=980,height=700'); } },
    closeSettings: () => { try { window.close(); } catch (_) {} },
    saveAyahImage: (dataUrl, name) => { try { return window.__TAURI__?.core?.invoke('save_image', { dataUrl: dataUrl, name: name || 'ayah.png' }); } catch (_) { return Promise.resolve(null); } },
    showInFolder: (p) => { try { window.__TAURI__?.core?.invoke('show_in_folder', { path: p }); } catch (_) {} },
    getLogoData: () => assetDataUrl('assets/logo.png'),
    getBannerData: () => assetDataUrl('assets/shot-banner.png'),
    whatsNew: () => {
      const v = '3.6.10';
      if (state.seenVer === v) return Promise.resolve(null);
      state.seenVer = v; save();
      const items = [
        'إصلاح واجهة المسبحة',
        'إصلاح المسبحة المصغّرة',
        'تحسينات على الحركات الانتقالية (الأنيميشن)',
        'إصلاح مشكلة الحفظ التلقائي',
        'تحسين واجهة الحفظ التلقائي والنسخ الاحتياطي',
        'تحسين واجهة مواقيت الصلاة مع إبراز الصلاة القادمة وتحديث الأيقونات',
        'إضافة زر لحفظ تقدّمك على جهازك',
        'إعادة تصميم قسم الإصدار والتحديثات في «حول البرنامج»'
      ];
      return Promise.resolve({ ver: v, items });
    },
    settingsWide: (on) => { try { window.__TAURI__?.core?.invoke('set_settings_wide', { on: !!on }); } catch (_) {} },
    minimize: () => { try { window.__TAURI__?.core?.invoke('set_window_mode', { mini: true }); } catch (_) {} },
    hideToTray: () => { try { window.__TAURI__?.window?.getCurrentWindow?.()?.hide?.(); } catch (_) {} },
    quit: () => { try { window.__TAURI__?.core?.invoke('quit_app'); } catch (_) { window.close(); } },
    openContact: (k) => {
      const url = CONTACT_LINKS[k];
      if (!url) return Promise.resolve();
      try { window.__TAURI__?.core?.invoke('open_url', { url }); } catch (_) {}
      return Promise.resolve();
    },
    exitDone: () => {},
    startupNearEnd: () => {},
    dragStart: () => { try { window.__TAURI__?.core?.invoke('drag_start'); } catch (_) {} },
    dragMove: (dx, dy) => { try { window.__TAURI__?.core?.invoke('drag_move', { dx: Number(dx) || 0, dy: Number(dy) || 0 }); } catch (_) {} },
    dragEnd: () => { try { window.__TAURI__?.core?.invoke('drag_end'); } catch (_) {} },
    miniReady: () => { try { window.__TAURI__?.core?.invoke('mini_ready'); } catch (_) {} },
    onMiniMorph: (cb) => on('miniMorph', cb),
    onMiniBlank: (cb) => on('miniBlank', cb),
    onMiniApplied: (cb) => on('miniApplied', cb),
    onWindowPos: (cb) => on('windowPos', cb),
    onTick: (cb) => on('tick', cb),
    onState: (cb) => on('state', cb),
    onStats: (cb) => on('stats', cb),
    onStartup: (cb) => on('startup', cb),
    onExitPlay: (cb) => on('exitPlay', cb),
    onShown: (cb) => on('shown', cb),
    onHover: (cb) => on('hover', cb),
    onSettingsFocus: (cb) => on('settingsFocus', cb),
    captureKey: (target) => { try { window.__TAURI__?.core?.invoke('capture_key', { target: target || 'custom' }); } catch (_) {} },
    cancelCaptureKey: () => { try { window.__TAURI__?.core?.invoke('cancel_capture'); } catch (_) {} },
    onKeyCaptured: (cb) => on('keyCaptured', cb),
    popupGet: () => { try { return window.__TAURI__?.core?.invoke('popup_get'); } catch (_) { return Promise.resolve(null); } },
    popupFit: () => {},
    popupPick: () => {},
    popupClose: () => { try { window.__TAURI__?.core?.invoke('popup_close'); } catch (_) {} },
    popupDragStart: () => {},
    popupDragMove: () => {},
    popupDragEnd: () => {},
    onPopupLock: (cb) => on('popupLock', cb),
    onPopupEdges: (cb) => on('popupEdges', cb),
    onPopupScale: (cb) => on('popupScale', cb),
    popupTest: (kind) => {
      const k = kind === 'cards' ? 'cards' : 'verse';
      const payload = {
        kind: k, verse: 'فَاذْكُرُونِي أَذْكُرْكُمْ وَاشْكُرُوا لِي وَلَا تَكْفُرُونِ',
        scale: k === 'cards' ? state.cardsScale : state.popupScale,
        fill: k === 'verse' && !!state.pm,
        popupVolume: state.popupVolume, reminderVolume: state.reminderVolume,
        reminderSound: state.reminderSound !== false,
        capSec: 120, challengeMs: 60000, revealMs: 1700,
        audio: AUDIO_FILES,
        cards: k === 'cards' ? [{ id: 'preview', text: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', need: 33 }] : undefined,
      };
      try { window.__TAURI__?.core?.invoke('popup_show', { kind: k, payload: JSON.stringify(payload) }); } catch (_) {}
    },
    onPopupReveal: (cb) => on('popupReveal', cb),
    onPopupTick: (cb) => on('popupTick', cb),
    onPopupSuccess: (cb) => on('popupSuccess', cb),
    onPopupFail: (cb) => on('popupFail', cb),
    onInlineOpen: (cb) => on('inlineOpen', cb),
    inlineUndock: () => {},
    inlineDragEnd: () => {},
    onPopupDocking: (cb) => on('popupDocking', cb),
    onInlineHint: (cb) => on('inlineHint', cb),
    onInlineClose: (cb) => on('inlineClose', cb),
    splashPhase: () => {},
    onSplashGo: (cb) => on('splashGo', cb),
    startupDone: () => { try { window.__TAURI__?.core?.invoke('startup_done'); } catch (_) {} },
  };

  window.azkar = api;

  // ── هندسة نافذة الإشعار: المقاس الطبيعي + السحب + مغناطيس المسبحة/الحافة ──
  const setupPopupGeometry = () => {
    const T = window.__TAURI__ || {}, WAPI = T.window || {};
    if (!WAPI.getCurrentWindow || !WAPI.Window) return;
    const self = WAPI.getCurrentWindow();
    const LogicalSize = (T.dpi && T.dpi.LogicalSize) || WAPI.LogicalSize;
    const PhysicalPosition = (T.dpi && T.dpi.PhysicalPosition) || WAPI.PhysicalPosition;
    if (!LogicalSize || !PhysicalPosition) return;

    const BP = { l: 26, r: 26, t: 22, b: 34 };
    const GAP = 8, MAG = 44, SNAP = 28, VMIN = 150, VMAX = 720, MX = 6, MY = 10, VY = 56, MAIN_GLOW = 18;
    let cfg = null, natW = 0, natH = 0, cssW = 404, cssH = 170;
    let cur = { x: 0, y: 0, w: 404, h: 170 };
    let sc = 1, zoom = 1, mag = '', fill = false, moved = false, shown = false, edges = '';
    let drag = null, fitT = null, followT = null, pending = null, applying = false;
    let pointer = { x: 0, y: 0, ok: false };

    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const pad = () => ({ l: BP.l * zoom, r: BP.r * zoom, t: BP.t * zoom, b: BP.b * zoom });
    const mainWindow = async () => {
      try { const p = WAPI.Window.getByLabel('main'); return p && p.then ? await p : p; } catch (_) { return null; }
    };
    const allMonitors = async () => {
      try { const p = WAPI.availableMonitors ? WAPI.availableMonitors() : null; return p && p.then ? await p : (p || []); } catch (_) { return []; }
    };
    const monFor = async (r) => {
      const ms = await allMonitors(), cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      for (const m of ms) {
        const z = m.scaleFactor || 1, x = m.position.x / z, y = m.position.y / z, w = m.size.width / z, h = m.size.height / z;
        if (cx >= x && cx <= x + w && cy >= y && cy <= y + h) return { x, y, w, h, scale: z };
      }
      try {
        const m = await self.currentMonitor();
        if (m) { const z = m.scaleFactor || sc; return { x: m.position.x / z, y: m.position.y / z, w: m.size.width / z, h: m.size.height / z, scale: z }; }
      } catch (_) {}
      return { x: 0, y: 0, w: 1920, h: 1080, scale: sc };
    };
    const mainRect = async () => {
      const mw = await mainWindow(); if (!mw) return null;
      try {
        const [p, s, z] = await Promise.all([mw.outerPosition(), mw.innerSize(), mw.scaleFactor()]);
        return { x: p.x / z, y: p.y / z, w: s.width / z, h: s.height / z, scale: z };
      } catch (_) { return null; }
    };
    const dialRect = async () => {
      const r = await mainRect(); if (!r) return null;
      return { x: r.x + MAIN_GLOW, y: r.y + MAIN_GLOW, w: r.w - MAIN_GLOW * 2, h: r.h - MAIN_GLOW * 2, scale: r.scale };
    };
    const clampRect = (x, y, w, h, wa) => {
      const P = pad();
      return {
        x: Math.round(clamp(x, wa.x - P.l, wa.x + wa.w - w + P.r)),
        y: Math.round(clamp(y, wa.y - P.t, wa.y + wa.h - h + P.b)),
      };
    };
    const edgesOf = (b, wa) => {
      if (cfg && cfg.kind === 'verse' && mag) return '';
      const P = pad(); let e = '';
      if (b.x + P.l <= wa.x + 1) e += 'l';
      if (b.x + b.w - P.r >= wa.x + wa.w - 1) e += 'r';
      if (b.y + P.t <= wa.y + 1) e += 't';
      if (b.y + b.h - P.b >= wa.y + wa.h - 1) e += 'b';
      return e;
    };
    const emitEdges = e => { e = e || ''; if (e === edges) return; edges = e; emit('popupEdges', e); };
    const heightFor = (w, fallback) => {
      const P = pad(), pLR = P.l + P.r, pTB = P.t + P.b;
      if (!(natW > pLR + 1 && natH > pTB + 1) || !cfg || cfg.kind !== 'verse') return fallback;
      const k = clamp((w - pLR) / Math.max(1, natW - pLR), 0.55, 1);
      return Math.max(40, Math.round(pTB + (natH - pTB) * k));
    };
    const magWidth = d => { const P = pad(); return clamp(Math.ceil(d.w + P.l + P.r), VMIN, VMAX); };
    const magPlace = (d, side, w, h, wa) => {
      const P = pad(), cardH = h - P.t - P.b;
      const fitT = d.y - GAP - cardH >= wa.y, fitB = d.y + d.h + GAP + cardH <= wa.y + wa.h;
      if (side === 't' && !fitT && fitB) side = 'b';
      else if (side === 'b' && !fitB && fitT) side = 't';
      let y = side === 't' ? d.y - GAP - h + P.b : d.y + d.h + GAP - P.t;
      return { ...clampRect(d.x - P.l, y, w, h, wa), side };
    };
    const snapVerse = (x, y, w, h, wa) => {
      const P = pad(), L = x + P.l, R = x + w - P.r, T = y + P.t, B = y + h - P.b;
      if (L - wa.x <= SNAP) x = wa.x - P.l;
      else if (wa.x + wa.w - R <= SNAP) x = wa.x + wa.w - w + P.r;
      if (T - wa.y <= SNAP) y = wa.y - P.t;
      else if (wa.y + wa.h - B <= SNAP) y = wa.y + wa.h - h + P.b;
      return clampRect(x, y, w, h, wa);
    };
    const verseXY = (wa, cx, cy, e, w, h) => {
      const P = pad(); e = e || '';
      let x = e.includes('r') ? wa.x + wa.w - w + P.r : e.includes('l') ? wa.x - P.l : cx - w / 2;
      let y = e.includes('b') ? wa.y + wa.h - h + P.b : e.includes('t') ? wa.y - P.t : cy - P.t - (h - P.t - P.b) / 2;
      return clampRect(x, y, w, h, wa);
    };
    const magSide = (x, y, w, h, d) => {
      const P = pad(), L = x + P.l, R = x + w - P.r, T = y + P.t, B = y + h - P.b, cx = (L + R) / 2;
      if (cx < d.x - 70 || cx > d.x + d.w + 70) return '';
      if (B > d.y - GAP - MAG && B < d.y + d.h / 2) return 't';
      if (T < d.y + d.h + GAP + MAG && T > d.y + d.h / 2) return 'b';
      return '';
    };
    const pump = async () => {
      if (applying) return;
      applying = true;
      while (pending) {
        const b = pending; pending = null;
        try {
          await self.setSize(new LogicalSize(Math.max(40, Math.round(b.w)), Math.max(40, Math.round(b.h))));
          await self.setPosition(new PhysicalPosition(Math.round(b.x * sc), Math.round(b.y * sc)));
          cur = { x: b.x, y: b.y, w: b.w, h: b.h };
        } catch (_) {}
      }
      applying = false;
    };
    const setBounds = b => { if (!b) return; pending = { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h) }; pump(); };
    const showOnce = async () => {
      if (shown) return; shown = true;
      try { await self.show(); } catch (_) {}
    };
    const initialPlace = async (wa, d, w, h) => {
      const P = pad();
      if (d && state.pm) {
        mag = state.pm === 'b' ? 'b' : 't'; fill = true;
        const mw = magWidth(d); return { ...magPlace(d, mag, mw, heightFor(mw, h), wa), w: mw, h: heightFor(mw, h) };
      }
      if (state.popupPos === 'saved' && Number.isFinite(state.px) && Number.isFinite(state.py)) {
        return { ...verseXY(wa, state.px, state.py, state.pe || '', w, h), w, h };
      }
      if (d && (state.popupPos === 'right' || state.popupPos === 'left' || state.popupPos === 'dial')) {
        if (state.popupPos === 'dial') {
          return { ...clampRect(d.x + d.w / 2 - w / 2, d.y + d.h / 2 - P.t - (h - P.t - P.b) / 2, w, h, wa), w, h };
        }
        let x = state.popupPos === 'right' ? d.x + d.w + GAP - P.l : d.x - GAP - w + P.r;
        if (x + P.l < wa.x || x + w - P.r > wa.x + wa.w) x = state.popupPos === 'right' ? d.x - GAP - w + P.r : d.x + d.w + GAP - P.l;
        return { ...clampRect(x, d.y - P.t, w, h, wa), w, h };
      }
      return { ...clampRect(wa.x + wa.w - w - MX, wa.y + MY, w, h, wa), w, h };
    };
    const applyFit = async () => {
      if (!cfg) return;
      const d = await dialRect(), wa = await monFor(d || cur), P = pad();
      let w, h, p;
      if (cfg.kind === 'verse') {
        if (mag && d) {
          w = magWidth(d); h = heightFor(w, natH); p = magPlace(d, mag, w, h, wa);
        } else {
          w = natW || cssW; h = heightFor(w, natH);
          if (moved) p = verseXY(wa, cur.x + cur.w / 2, cur.y + P.t + (cur.h - P.t - P.b) / 2, edges, w, h);
          else { const ip = await initialPlace(wa, d, w, h); w = ip.w || w; h = ip.h || h; p = ip; }
        }
      } else {
        w = cssW || natW || 404; h = cssH || natH || 170;
        p = moved ? clampRect(cur.x, cur.y, w, h, wa) : { x: wa.x + (wa.w - w) / 2, y: wa.y + (wa.h - h) / 2 };
      }
      setBounds({ x: p.x, y: p.y, w, h });
      showOnce();
      emitEdges(edgesOf({ x: p.x, y: p.y, w, h }, wa));
    };
    const startFollow = () => {
      if (followT) clearInterval(followT);
      followT = setInterval(async () => {
        if (!mag || drag || !cfg || cfg.kind !== 'verse') return;
        const d = await dialRect(); if (!d) return;
        const wa = await monFor(d), w = magWidth(d), h = heightFor(w, cur.h), p = magPlace(d, mag, w, h, wa);
        if (Math.abs(p.x - cur.x) > 1 || Math.abs(p.y - cur.y) > 1 || Math.abs(w - cur.w) > 1 || Math.abs(h - cur.h) > 1) {
          setBounds({ x: p.x, y: p.y, w, h });
        }
        emitEdges('');
      }, 120);
    };

    api.popupFit = (h, w, nh, nw) => {
      const H = Number(h), W = Number(w), NH = Number(nh), NW = Number(nw);
      if (Number.isFinite(NW) && NW > 0) natW = clamp(Math.ceil(NW), VMIN, VMAX);
      if (Number.isFinite(NH) && NH > 0) natH = clamp(Math.ceil(NH), 60, 720);
      if (!natW && Number.isFinite(W)) natW = clamp(Math.ceil(W), VMIN, VMAX);
      if (!natH && Number.isFinite(H)) natH = clamp(Math.ceil(H), 60, 720);
      if (!cfg) return;
      clearTimeout(fitT); fitT = setTimeout(applyFit, 20);
    };
    api.popupDragStart = () => {
      if (followT) { clearInterval(followT); followT = null; }
      drag = { x: cur.x, y: cur.y, px: pointer.x, py: pointer.y };
    };
    api.popupDragMove = async () => {
      if (!drag || !pointer.ok || !cfg) return;
      moved = true;
      let nx = drag.x + pointer.x - drag.px, ny = drag.y + pointer.y - drag.py;
      const d = await dialRect(), wa = await monFor({ x: nx, y: ny, w: cur.w, h: cur.h }), P = pad();
      if (cfg.kind === 'verse' && d) {
        const side = magSide(nx, ny, cur.w, cur.h, d);
        if (side) {
          if (mag !== side) mag = side;
          if (!fill) { fill = true; emit('popupLock', { fill: true, pulse: 'in' }); }
          const w = magWidth(d), h = heightFor(w, cur.h), p = magPlace(d, mag, w, h, wa);
          setBounds({ x: p.x, y: p.y, w, h }); emitEdges('');
          return;
        }
        if (mag) {
          mag = ''; fill = true; emit('popupLock', { fill: true, pulse: 'out' });
          setTimeout(() => { fill = false; emit('popupLock', { fill: false }); }, 380);
          const w = natW || cur.w, h = heightFor(w, cur.h), p = snapVerse(nx, ny, w, h, wa);
          setBounds({ x: p.x, y: p.y, w, h }); emitEdges(edgesOf({ x: p.x, y: p.y, w, h }, wa));
          return;
        }
        const p = snapVerse(nx, ny, cur.w, cur.h, wa);
        setBounds({ x: p.x, y: p.y, w: cur.w, h: cur.h }); emitEdges(edgesOf({ x: p.x, y: p.y, w: cur.w, h: cur.h }, wa));
      } else {
        const p = clampRect(nx, ny, cur.w, cur.h, wa);
        setBounds({ x: p.x, y: p.y, w: cur.w, h: cur.h }); emitEdges(edgesOf({ x: p.x, y: p.y, w: cur.w, h: cur.h }, wa));
      }
    };
    api.popupDragEnd = async () => {
      if (!drag || !moved) { drag = null; return; }
      drag = null;
      const wa = await monFor(cur), P = pad(), e = edgesOf(cur, wa);
      emitEdges(e);
      api.patch({
        popupPos: 'saved', pm: mag || '', pe: e,
        px: Math.round(cur.x + cur.w / 2),
        py: Math.round(cur.y + P.t + (cur.h - P.t - P.b) / 2),
      });
      if (mag) startFollow();
    };
    api.onPopupEdges(() => {});

    document.addEventListener('pointermove', e => { pointer = { x: e.screenX, y: e.screenY, ok: true }; }, true);
    document.addEventListener('pointerdown', e => { pointer = { x: e.screenX, y: e.screenY, ok: true }; }, true);

    (async () => {
      try {
        const c = await api.popupGet();
        if (!c) return api.popupClose();
        cfg = c; zoom = Number(c.scale) > 0 ? Number(c.scale) : 1;
        try { sc = await self.scaleFactor(); } catch (_) { sc = 1; }
        if (c.fill) { mag = state.pm === 'b' ? 'b' : 't'; fill = true; }
        await applyFit();
      } catch (_) { try { api.popupClose(); } catch (_) {} }
    })();
    setTimeout(() => { if (!shown) { shown = true; try { self.show(); } catch (_) {} emit('popupEdges', edges || ''); } }, 1400);
  };
  if (windowLabel() === 'popup') { try { setupPopupGeometry(); } catch (e) { console.error('popup geometry', e); } }

  // ── wzx (تنبيهات مخصصة) ────────────────────────────────────────────────
  window.wzx = {
    getAlerts: () => Promise.resolve(state.customAlerts || []),
    saveAlert: (draft) => {
      const list = state.customAlerts || [];
      const d = draft || {};
      if (d.id) {
        const i = list.findIndex(a => a.id === d.id);
        if (i >= 0) list[i] = Object.assign(list[i], d);
      } else {
        list.push(Object.assign({ id: 'c' + Date.now(), enabled: true, sound: null }, d));
      }
      state.customAlerts = list; save(); emit('state', publicState());
      return Promise.resolve(list);
    },
    deleteAlert: (id) => {
      state.customAlerts = (state.customAlerts || []).filter(a => a.id !== id);
      save(); emit('state', publicState());
      return Promise.resolve();
    },
    toggleAlert: (id, on) => {
      state.customAlerts = (state.customAlerts || []).map(a => a.id === id ? Object.assign({}, a, { enabled: !!on }) : a);
      save(); emit('state', publicState());
      return Promise.resolve();
    },
    testAz: () => {},
    copyMin: () => { try { navigator.clipboard?.writeText('https://www.alminshawi.com'); } catch (_) {} },
    pickSound: () => Promise.resolve(null),
    previewAlert: () => {},
    onAlerts: (cb) => {},
    backupList: () => { try { return window.__TAURI__?.core?.invoke('backup_list'); } catch (_) { return Promise.resolve([]); } },
    backupExport: () => { try { return window.__TAURI__?.core?.invoke('backup_export', { data: JSON.stringify(state) }); } catch (_) { return Promise.resolve(''); } },
    backupImport: (path) => {
      try {
        return window.__TAURI__?.core?.invoke('backup_import', { path }).then(txt => {
          try {
            const o = JSON.parse(txt);
            if (o && typeof o === 'object') { Object.assign(state, o); save(); emit('state', publicState()); }
          } catch (_) {}
          return true;
        });
      } catch (_) { return Promise.resolve(); }
    },
    backupNow: () => { try { return window.__TAURI__?.core?.invoke('backup_now', { data: JSON.stringify(state) }); } catch (_) { return Promise.resolve([]); } },
    backupPath: () => { try { return window.__TAURI__?.core?.invoke('backup_path'); } catch (_) { return Promise.resolve(''); } },
    backupOpenDir: () => { try { return window.__TAURI__?.core?.invoke('backup_open_dir'); } catch (_) { return Promise.resolve(false); } },
    backupCopyPath: () => {
      try {
        return window.__TAURI__?.core?.invoke('backup_copy_path').then(p => {
          navigator.clipboard?.writeText(p);
          return true;
        }).catch(() => false);
      } catch (_) { return Promise.resolve(false); }
    },
    extInfo: () => { try { return window.__TAURI__?.core?.invoke('ext_info'); } catch (_) { return Promise.resolve(null); } },
    extChoose: () => { try { return window.__TAURI__?.core?.invoke('ext_choose'); } catch (_) { return Promise.resolve({ ok: false, error: 'تعذّر اختيار المجلد' }); } },
    extClear: () => { try { return window.__TAURI__?.core?.invoke('ext_clear'); } catch (_) { return Promise.resolve(null); } },
    extOpen: () => { try { return window.__TAURI__?.core?.invoke('ext_open'); } catch (_) { return Promise.resolve(false); } },
    backupRestore: () => Promise.resolve(),
    backupExport: () => { try { return window.__TAURI__?.core?.invoke('backup_export', { data: JSON.stringify(state) }); } catch (_) { return Promise.resolve(''); } },
    backupImport: () => Promise.resolve(),
    backupImportApply: () => Promise.resolve(),
    backupImportCancel: () => {},
    backupQuran: () => {},
    takePendingQuran: () => {},
    khatmaPage: (p) => { const k = state.khatma || (state.khatma = { bits: '', start: '', days: 30, count: 0, today: { d: '', n: 0 } }); k.last = p; save(); return Promise.resolve(p); },
    khatmaNew: (d) => { state.khatma = { bits: '', start: '', days: Number(d) || 30, count: 0, today: { d: '', n: 0 } }; save(); emit('state', publicState()); return Promise.resolve(); },
  };

  // ── Backup / Restore ─────────────────────────────────────────────────────
  api.backupExport = () => {
    try { return window.__TAURI__?.core?.invoke('backup_export'); } catch (_) { return Promise.resolve(''); }
  };
  api.backupImport = (path) => {
    try { return window.__TAURI__?.core?.invoke('backup_import', { path }); } catch (_) { return Promise.resolve(); }
  };

  // ── Splash ────────────────────────────────────────────────────────────────
  api.splashPhase = (p) => {
    try { window.__TAURI__?.core?.invoke('splash_phase', { phase: String(p || '') }); } catch (_) {}
    if (p === 'done') { try { emit('splashGo'); } catch (_) {} }
  };

  // ── boot ─────────────────────────────────────────────────────────────────
  // onShown بيتبعت من Rust لما نافذة المسبحة تظهر فعلًا (بعد شاشة اللوجو).
  // مفيش emit هنا: النافذة بتتخلق مخفية، فالأنيميشن لازم يبدأ مع أول ظهور حقيقي.

  // hover → idle class (للشفافية)
  document.addEventListener('mouseenter', () => document.body.classList.remove('idle'));
  document.addEventListener('mouseleave', () => document.body.classList.add('idle'));

  // keyboard: Space → tick (إذا مفعّل)
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && state.spaceKey) { e.preventDefault(); api.tick(); }
  });

  // ── عجلة الماوس داخل نافذة السبحة (تعمل على Wayland أيضاً) ──────────────
  let lastWheel = 0;
  document.addEventListener('wheel', () => {
    if (state.scrollOn === false) return;
    const now = performance.now();
    if (now - lastWheel < 200) return;   // كل "حركة" تمرير = تسبيحة واحدة
    lastWheel = now;
    api.tick();
  }, { passive: true, capture: true });

  // ── مزامنة الحالة بين النوافذ ───────────────────────────────────────────
  let lastRemoteTs = 0;
  try {
    window.__TAURI__?.event?.listen('state_sync', (ev) => {
      const p = (ev && ev.payload) || {};
      if (!p || p.from === windowLabel() || !p.json || Number(p.ts) <= lastRemoteTs) return;
      lastRemoteTs = Number(p.ts) || Date.now();
      try {
        const o = JSON.parse(p.json);
        if (!o || typeof o !== 'object') return;
        state = Object.assign({}, DEFAULT_STATE, o);
        state.dialLayout = sanitizeLayout(state.dialLayout);
        try { localStorage.setItem(KEY, p.json); } catch (_) {}
        emit('state', publicState());
      } catch (_) {}
    });
  } catch (_) {}

  // ── أحداث النافذة الرئيسية (mini / التحوّل / مكان النافذة) ──────────────
  try {
    const listenWin = (name, ch) => window.__TAURI__?.event?.listen(name, ev => emit(ch, (ev && ev.payload) || {}));
    listenWin('mini:morph', 'miniMorph');
    listenWin('mini:blank', 'miniBlank');
    listenWin('mini:applied', 'miniApplied');
    listenWin('window_pos', 'windowPos');
    listenWin('popup:lock', 'popupLock');
    listenWin('popup:edges', 'popupEdges');
    listenWin('inline:hint', 'inlineHint');
    listenWin('settings:focus', 'settingsFocus');
    listenWin('splash-go', 'splashGo');
    window.azkar.onWindowPos(d => {
      if (!d) return;
      if (d.mini) { state.mx = d.x; state.my = d.y; }
      else { state.x = d.x; state.y = d.y; }
      save();
    });
  } catch (_) {}

  // ── عجلة الماوس globally (X11 / XWayland) — Rust rdev ───────────────────
  try {
    window.__TAURI__?.event?.listen('global_tick', () => {
      if (state.scrollOn === false) return;
      api.tick();
    });
  } catch (_) {}

  // ── تذكير الأذكار المنبثق (كل state.reminderEvery ثانية) ─────────────────
  let reminderTimer = null;
  const startReminder = () => {
    if (reminderTimer) clearInterval(reminderTimer);
    const every = Math.max(60, Number(state.reminderEvery) || 1800);
    reminderTimer = setInterval(() => {
      if (!state.reminderOn) return;
      try {
        window.__TAURI__?.core?.invoke('popup_show', {
          kind: 'verse',
          payload: JSON.stringify({
            kind: 'verse', verse: 'أذكار الصباح', capSec: 120,
            popupVolume: state.popupVolume, reminderVolume: state.reminderVolume,
            reminderSound: state.reminderSound !== false, audio: AUDIO_FILES,
            challengeMs: 60000, revealMs: 1700
          }),
        });
      } catch (_) {}
    }, every * 1000);
  };
  startReminder();
  const origPatch = api.patch;
  api.patch = (p) => { const r = origPatch(p); if (p && typeof p.reminderEvery === 'number') startReminder(); return r; };

  // ── إرسال الأزرار المخصصة والاختصارات للـ backend (عبر evdev) ───────────
  const keyObj = k => (k && k.code) ? {
    code: String(k.code), ctrl: !!k.ctrl, alt: !!k.alt,
    shift: !!k.shift, meta: !!k.meta, name: k.name || k.code,
  } : null;
  const pushKeys = () => {
    try {
      const hk = {};
      for (const a of ['quit', 'mini', 'show', 'settings']) {
        if (state.hotkeys && state.hotkeys[a]) hk[a] = keyObj(state.hotkeys[a]);
      }
      window.__TAURI__?.core?.invoke('set_keys', {
        custom: state.customKeyOn ? keyObj(state.customKey) : null,
        hotkeys: hk,
        space: state.spaceKey !== false,
      });
    } catch (_) {}
  };
  pushKeys();
  const origPatch2 = api.patch;
  api.patch = (p) => {
    const r = origPatch2(p);
    if (p && ('customKey' in p || 'customKeyOn' in p || 'customKeyClear' in p || 'hotkeys' in p || 'spaceKey' in p)) {
      if (p.customKeyClear) { state.customKey = null; state.customKeyOn = false; state.customKeyName = ''; }
      if (p.customKey) { state.customKey = p.customKey; state.customKeyName = p.customKey.name || p.customKey.code; }
      if (p.customKeyOn === false) { state.customKeyOn = false; }
      pushKeys();
    }
    return r;
  };

  // النافذة ظهرت → إعادة إشعار 'shown' + إرسال مناطق التفاعل (click-through)
  const reportHitRects = () => {
    try {
      const rects = [];
      const sel = '[data-hit], #dial, #dhikr, #mini, #goal, #reset, #sound, #vol, #close, #hide, #gear, #grip, #mBar';
      document.querySelectorAll(sel).forEach(el => {
        // العناصر المخفية (display:none) ما تتحسبش
        let hidden = false;
        try { const cs = getComputedStyle(el); hidden = (cs.display === 'none' || cs.visibility === 'hidden'); } catch (_) {}
        if (hidden) return;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) rects.push({ x: r.left - 2, y: r.top - 2, w: r.width + 4, h: r.height + 4 });
      });
      if (rects.length) api.setHitRects(rects);
    } catch (_) {}
  };
  let startupOnce = false;
  try {
    window.__TAURI__?.event?.listen('main_shown', () => {
      try { emit('shown'); } catch (_) {}
      if (!startupOnce) {
        startupOnce = true;
        if (state.startupSound) emit('startup', { volume: Number(state.startupVolume) || 0 });
        else setTimeout(() => { try { api.startupDone(); } catch (_) {} }, 120);
      }
      setTimeout(reportHitRects, 120);
      setTimeout(reportHitRects, 600);
    });
  } catch (_) {}
  // تحديث دوري لمناطق التفاعل (حركة النافذة/تغيير الحجم)
  setInterval(reportHitRects, 1000);
  window.addEventListener('resize', reportHitRects);

  // ── التقاط الزر (من evdev) ─────────────────────────────────────────────
  try {
    window.__TAURI__?.event?.listen('key_captured', (ev) => {
      const d = (ev && ev.payload) || {};
      const k = { code: d.code, ctrl: !!d.ctrl, alt: !!d.alt, shift: !!d.shift, meta: !!d.meta, name: d.name || d.code };
      if (d.target === 'custom' || !d.target) {
        state.customKey = k;
        state.customKeyOn = true;
        state.customKeyName = k.name;
      } else {
        state.hotkeys = Object.assign({}, state.hotkeys || {});
        state.hotkeys[d.target] = k;
      }
      save();
      pushKeys();
      emit('state', publicState());
      emit('key_captured', { name: k.name });
    });

    // Space (عالمي)
    window.__TAURI__?.event?.listen('global_space', () => {
      if (state.spaceKey === false) return;
      api.tick();
    });

    // الزر المخصص (عالمي)
    window.__TAURI__?.event?.listen('global_custom_key', () => {
      if (state.customKeyOn === false) return;
      api.tick();
    });

    // اختصارات الأوامر (عالمي)
    window.__TAURI__?.event?.listen('global_hotkey', (ev) => {
      const a = (ev && ev.payload) || '';
      if (a === 'quit') { try { window.__TAURI__?.core?.invoke('quit_app'); } catch (_) {} }
      else if (a === 'mini') { try { window.__TAURI__?.core?.invoke('set_window_mode', { mini: true }); } catch (_) {} }
      else if (a === 'show') { try { window.__TAURI__?.window?.getCurrentWindow?.()?.show?.(); } catch (_) {} }
      else if (a === 'settings') { api.openSettings(null); }
    });
  } catch (_) {}

  console.log('WZAKER Tauri shim loaded');
})();
