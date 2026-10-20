// WZAKER Tauri shim — يوفر window.azkar و window.wzx (بدلاً من Electron IPC)
// الحالة تُحفظ في localStorage؛ العدّ والعرض يعملان دون backend Rust.
(function () {
  'use strict';

  const KEY = 'wzaker-state-v1';

  // ── روابط التواصل (نفس روابط نسخة ويندوز) ─────────────────────────────
  const CONTACT_LINKS = {
    fb: 'https://www.facebook.com/AKA.AlHussin',
    dc: 'https://discord.com/users/339177356843548673',
    wa: 'https://wa.link/lv4cu4',
    sg: 'https://tally.so/r/QKgVQl',
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
    challengeOn: true, challengeEvery: 3600, popupPos: 'corner', px: null, py: null, popupScale: 1,
    cardsPos: 'corner', cx: null, cy: null, cardsScale: 1,
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
    popupFail: [], inlineOpen: [], popupDocking: [], inlineHint: [], inlineClose: [], splashGo: [] };

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
    dialLayout: state.dialLayout || null,
    popupSaved: state.px !== null && state.px !== undefined,
    cardsSaved: state.cx !== null && state.cx !== undefined,
    dndNow: false,
    azDue: '', azRest: '', wirdDue: '',
    prayerInfo: (window.prayerInfoFor ? window.prayerInfoFor(state) : null),
    hook: 'ok', hookErr: '', hookRestarts: 0,
    appVersion: '3.6.4',
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
    getBannerData: () => assetDataUrl('assets/banner.png'),
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
    dragStart: () => { try { window.__TAURI__?.window?.getCurrentWindow?.()?.startDragging?.(); } catch (_) {} },
    dragMove: () => {},
    dragEnd: () => {},
    onTick: (cb) => on('tick', cb),
    onState: (cb) => on('state', cb),
    onStats: (cb) => on('stats', cb),
    onStartup: (cb) => on('startup', cb),
    onExitPlay: (cb) => on('exitPlay', cb),
    onShown: (cb) => { try { window.__TAURI__?.core?.invoke('log_msg', { msg: 'onShown registered' }); } catch (_) {} on('shown', cb); },
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
    onPopupScale: (cb) => on('popupScale', cb),
    popupTest: () => {},
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
    startupDone: () => {},
  };

  window.azkar = api;

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
    backupNow: () => Promise.resolve(),
    backupPath: () => Promise.resolve(''),
    backupOpenDir: () => {},
    backupCopyPath: () => {},
    backupRestore: () => Promise.resolve(),
    backupExport: () => Promise.resolve(),
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
    if (p === 'done') {
      try { emit('splashGo'); } catch (_) {}
      try { window.__TAURI__?.core?.invoke('splash_done'); } catch (_) {}
    }
  };

  // ── boot ─────────────────────────────────────────────────────────────────
  // onShown: أظهر النافذة (Tauri يظهرها تلقائيًا)
  setTimeout(() => {
    try { window.__TAURI__?.core?.invoke('log_msg', { msg: 'shim: emit shown' }); } catch (_) {}
    try { emit('shown'); } catch (_) {}
    try { document.body.classList.remove('pre-show'); } catch (_) {}
  }, 300);

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
          payload: JSON.stringify({ kind: 'verse', verse: 'أذكار الصباح', capSec: 120 }),
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
  try {
    window.__TAURI__?.event?.listen('main_shown', () => {
      try { emit('shown'); } catch (_) {}
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
