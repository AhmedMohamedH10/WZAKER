const { contextBridge, ipcRenderer } = require('electron');

// كل listener بيتسجل بـ "استبدال" علشان مستحيل يتكرر لو اتنادى أكتر من مرة
const on = (channel, cb) => {
  ipcRenderer.removeAllListeners(channel);
  ipcRenderer.on(channel, (_e, data) => cb(data));
};

contextBridge.exposeInMainWorld('azkar', {
  // حالة + إعدادات
  getState: () => ipcRenderer.invoke('state:get'),
  getStats: () => ipcRenderer.invoke('stats:get'),
  patch: p => ipcRenderer.send('state:patch', p),
  tick: () => ipcRenderer.send('tick:click'),                     // تسبيح بالنقر على العدّاد (لو الخيار مفعّل)
  addDhikr: text => ipcRenderer.invoke('dhikr:add', text),
  deleteDhikr: id => ipcRenderer.invoke('dhikr:delete', id),
  // نوافذ
  setHitRects: rects => ipcRenderer.send('ui:hitrects', rects),   // مناطق التفاعل (click-through يديرها الـ main)
  alive: () => ipcRenderer.send('ui:alive'),                      // watchdog: الماوس وصل للصفحة
  hold: v => ipcRenderer.send('ui:hold', !!v),                    // ضغط ماوس شغّال (slider/سحب)
  openSettings: focus => ipcRenderer.send('settings:open', focus || null),
  closeSettings: () => ipcRenderer.send('settings:close'),
  saveAyahImage: (dataUrl, name) => ipcRenderer.invoke('img:save', dataUrl, name),   // لقطة الآية → Pictures/WZAKER
  showInFolder: p => ipcRenderer.send('img:show', p),
  getLogoData: () => ipcRenderer.invoke('img:logo'),
  getBannerData: () => ipcRenderer.invoke('img:banner'),
  settingsWide: on => ipcRenderer.send('settings:wide', !!on),     // المصحف: نافذة الإعدادات بتتوسّع وقت القراءة
  minimize: () => ipcRenderer.send('win:minimize'),               // "–" = Taskbar
  hideToTray: () => ipcRenderer.send('win:hide'),                 // Tray
  quit: () => ipcRenderer.send('app:quit'),
  openContact: k => ipcRenderer.send('contact:open', k),         // زر الاقتراحات: 'fb' | 'dc' | 'wa'
  exitDone: () => ipcRenderer.send('exit:done'),
  startupNearEnd: () => ipcRenderer.send('startup:near-end'),   // قبل نهاية صوت البداية بشوية: تظهير المسبحة
  dragStart: () => ipcRenderer.send('drag:start'),
  dragMove: (dx, dy) => ipcRenderer.send('drag:move', { dx, dy }),
  dragEnd: () => ipcRenderer.send('drag:end'),
  // أحداث
  onTick: cb => on('tick', cb),
  onState: cb => on('state', cb),
  onStats: cb => on('stats', cb),
  onStartup: cb => on('startup:play', cb),
  onExitPlay: cb => on('exit:play', cb),
  onShown: cb => on('overlay:shown', cb),
  onMiniMorph: cb => on('mini:morph', cb),            // بدء تحوّل المسبحة ⇄ Mini ('out' = للمصغّرة | 'in' = للكبيرة)
  onMiniBlank: cb => on('mini:blank', cb),
  onMiniApplied: cb => on('mini:applied', cb),
  miniReady: () => ipcRenderer.send('mini:ready'),
  onHover: cb => on('hover', cb),                               // الماوس فوق نافذة المسبحة أو لأ (الشفافية عند عدم الاستخدام)
  onSettingsFocus: cb => on('settings:focus', cb),
  captureKey: target => ipcRenderer.send('key:capture', target),             // تسجيل زر/اختصار مخصص للتسبيح
  cancelCaptureKey: () => ipcRenderer.send('key:cancel'),
  onKeyCaptured: cb => on('key:captured', cb),
  // الإشعارات المنبثقة (آية التذكير + بطاقات التحدي)
  popupGet: () => ipcRenderer.invoke('popup:get'),
  popupFit: (h, w, nh, nw) => ipcRenderer.send('popup:fit', h, w, nh, nw),               // الإشعار بيبلّغ بارتفاعه الحقيقي
  popupPick: i => ipcRenderer.send('popup:pick', i),             // اختيار بطاقة (0..2)
  popupClose: () => ipcRenderer.send('popup:close'),
  popupDragStart: () => ipcRenderer.send('popup:dragstart'),                // سحب الإشعار
  popupDragMove: () => ipcRenderer.send('popup:dragmove'),
  popupDragEnd: () => ipcRenderer.send('popup:dragend'),
  onPopupLock: cb => on('popup:lock', cb),                                   // عرض الإشعار لما يتلزق في المسبحة (0 = رجوع للعرض الطبيعي)
  onPopupEdges: cb => on('popup:edges', cb),                                 // الحواف اللي الإشعار لازق فيها (l/r/t/b)
  onPopupScale: cb => on('popup:scale', cb),                                 // حجم الإشعار (من الإعدادات)
  popupTest: kind => ipcRenderer.send('popup:test', kind),       // معاينة من الإعدادات: 'verse' | 'cards'
  onPopupReveal: cb => on('popup:reveal', cb),
  onPopupTick: cb => on('popup:tick', cb),
  onPopupSuccess: cb => on('popup:success', cb),
  onPopupFail: cb => on('popup:fail', cb),
  onInlineOpen: cb => on('inline:open', cb),                    // بطاقات الذكر الخفي جوه المسبحة نفسها: فتح
  inlineUndock: () => ipcRenderer.send('inline:undock'),          // سحب مربع البطاقات بره المسبحة
  inlineDragEnd: () => ipcRenderer.send('inline:dragend'),
  onPopupDocking: cb => on('popup:docking', cb),                // النافذة المنفصلة بتدخل المسبحة: أنيميشن Pop
  onInlineHint: cb => on('inline:hint', cb),                    // توهّج المسبحة وقت تقريب البطاقات منها
  onInlineClose: cb => on('inline:close', cb),                  // ... وإغلاق فوري (إلغاء من الـ main)
  // شاشة اللوجو عند بدء التشغيل
  splashPhase: p => ipcRenderer.send('splash:phase', p),         // 'ready' | 'fade' | 'done'
  onSplashGo: cb => on('splash:go', cb),                         // الـ main بيسمح بالـ Fade Out بعد ما صوت التشغيل يخلص
  startupDone: () => ipcRenderer.send('startup:done')            // صوت "فسبحان الله" خلّص (أو فشل)
});
