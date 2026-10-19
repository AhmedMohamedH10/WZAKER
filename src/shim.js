// WZAKER Tauri shim — يوفر window.azkar و window.wzx (بدلاً من Electron IPC)
// الحالة تُحفظ في localStorage؛ العدّ والعرض يعملان دون backend Rust.
(function () {
  'use strict';

  const KEY = 'wzaker-state-v1';

  // ── حالة افتراضية (من DEFAULT_STATE في main.js) ─────────────────────────
  const DEFAULT_STATE = {
    count: 0, total: 0,
    dhikrId: 'd0', customAzkar: [], stats: {},
    daily: {}, streak: null, dndFullscreen: false, autoAdvance: true, target: 33,
    sound: true, volume: 0.4, startupSound: true, startupVolume: 0.2,
    completionSound: true, completionVolume: 0.2, exitSound: true, exitVolume: 0.2,
    miniMode: false, miniOpacity: 0.85, idleOpacity: 0.7, spaceKey: false,
    hotkeys: { quit: null, mini: null, show: null, settings: null },
    customKeyOn: false, customKey: null, dialLocked: false, scrollOn: true, clickOn: false,
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

  const listeners = { tick: [], state: [], stats: [], startup: [], exitPlay: [], shown: [], hover: [],
    settingsFocus: [], keyCaptured: [], popupScale: [], popupReveal: [], popupTick: [], popupSuccess: [],
    popupFail: [], inlineOpen: [], popupDocking: [], inlineHint: [], inlineClose: [], splashGo: [] };

  const on = (ch, cb) => { if (listeners[ch]) listeners[ch].push(cb); };

  const emit = (ch, data) => { (listeners[ch] || []).forEach(cb => { try { cb(data); } catch (e) { console.error(e); } }); };

  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {} };

  function publicState() { return { ...state }; }

  const api = {
    getState: () => Promise.resolve({ ...state }),
    getStats: () => Promise.resolve({}),
    patch: (p) => {
      if (p && typeof p === 'object') Object.assign(state, p);
      save();
      emit('state', { ...state });
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
      const payload = { completed, shown: null, state: { count: state.count, total: state.total, target: state.target, dhikrId: state.dhikrId, dhikrText: state.dhikrText || 'سُبْحَانَ اللَّهِ', challenge: false } };
      emit('tick', payload);
      emit('state', { ...state });
      // صوت
      try { if (state.sound) { /* click sound handled by frontend? original plays in main */ } } catch (_) {}
      return Promise.resolve();
    },
    addDhikr: (text) => { state.customAzkar = state.customAzkar || []; state.customAzkar.push({ id: 'c' + Date.now(), text }); save(); emit('state', { ...state }); return Promise.resolve(state.customAzkar[state.customAzkar.length-1].id); },
    deleteDhikr: (id) => { state.customAzkar = (state.customAzkar || []).filter(x => x.id !== id); save(); emit('state', { ...state }); return Promise.resolve(); },
    setHitRects: () => {},
    alive: () => {},
    hold: () => {},
    openSettings: (focus) => { try { window.__TAURI__?.core?.invoke('open_settings', { focus: focus || null }); } catch (_) { window.open('settings.html', 'settings', 'width=980,height=700'); } },
    closeSettings: () => { try { window.close(); } catch (_) {} },
    saveAyahImage: () => Promise.resolve(null),
    showInFolder: () => {},
    getLogoData: () => Promise.resolve(null),
    getBannerData: () => Promise.resolve(null),
    settingsWide: () => {},
    minimize: () => { try { window.__TAURI__?.window?.getCurrentWindow?.()?.minimize?.(); } catch (_) {} },
    hideToTray: () => { try { window.__TAURI__?.window?.getCurrentWindow?.()?.hide?.(); } catch (_) {} },
    quit: () => { try { window.__TAURI__?.core?.invoke('quit_app'); } catch (_) { window.close(); } },
    openContact: () => {},
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
    onShown: (cb) => on('shown', cb),
    onHover: (cb) => on('hover', cb),
    onSettingsFocus: (cb) => on('settingsFocus', cb),
    captureKey: () => {},
    cancelCaptureKey: () => {},
    onKeyCaptured: (cb) => on('keyCaptured', cb),
    popupGet: () => Promise.resolve(null),
    popupFit: () => {},
    popupPick: () => {},
    popupClose: () => {},
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
    getAlerts: () => Promise.resolve([]),
    saveAlert: () => Promise.resolve(),
    deleteAlert: () => Promise.resolve(),
    toggleAlert: () => Promise.resolve(),
    testAz: () => {},
    copyMin: () => {},
    pickSound: () => Promise.resolve(null),
    previewAlert: () => {},
    onAlerts: (cb) => {},
    backupList: () => Promise.resolve([]),
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
    khatmaPage: () => {},
    khatmaNew: () => {},
  };

  // ── boot ─────────────────────────────────────────────────────────────────
  // onShown: أظهر النافذة (Tauri يظهرها تلقائيًا)
  setTimeout(() => {
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

  // wheel → tick (إذا مفعّل) — handled by Rust global shortcut ideally; here fallback
  // (global scroll is handled by Rust side; this is a no-op fallback)

  console.log('WZAKER Tauri shim loaded');
})();
