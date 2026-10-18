/**
 * WZAKER — Desktop Overlay (Electron 33 / Windows)
 *
 * MAIN PROCESS مسؤول عن: النافذة (عادية + Mini Mode)، نافذة الإعدادات، الـ Tray،
 * الـ Global Mouse/Keyboard Hook، الإعدادات المحفوظة، الإحصائيات، وتنسيق الصوت.
 * الـ renderer للعرض والأنيميشن والصوت فقط.
 * كل البيانات محلية فقط (ملف JSON داخل userData) ولا يتم إرسال أي شيء للإنترنت.
 *
 * ⚠️ حدود مهمة (Limitations):
 *  1) Exclusive Fullscreen بياخد الشاشة بالكامل، وويندوز مش بيسمح لأي نافذة عادية تظهر فوقه.
 *     الـ overlay بيشتغل مع Windowed و Borderless Fullscreen، والظهور فوق Exclusive غير مضمون.
 *  2) بعض أنظمة Anti-Cheat (EAC / BattlEye / Vanguard) بتمنع الـ global hooks والـ overlays.
 *  3) البرامج اللي شغالة كـ Administrator: ويندوز (UIPI) مش بيوصّل أحداث الماوس/الكيبورد الخاصة بها
 *     لتطبيق عادي. شغّل التطبيق كـ Administrator لو عايز يعد فوقها.
 */
const { app, BrowserWindow, Tray, Menu, ipcMain, globalShortcut, screen, nativeImage, dialog, clipboard, shell, net} = require('electron');
const AZ = require('./azkar-data.js');   // أذكار الصباح والمساء
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { spawn } = require('child_process');

// منع Chromium من تجميد/خنق الـ renderer لما النافذة تتخبّى أو تتغطى
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');

// ───────────── إعدادات ─────────────
// هامش شفاف حول الكارت بيحتوي الـ Glow بالكامل (من غير ما يتقص عند حافة النافذة). لازم يساوي --gm في index.html
const GLOW = 18;
const CARD_FULL = { w: 258, h: 354 };   // الكارت الظاهر (كان 248×340: تكبير بسيط ~4%)
const CARD_MINI = { w: 232, h: 48 };
// حجم النافذة الكاملة بيتغيّر مع "حجم المسبحة كلها" (تخصيص المسبحة): الكارت بيتكبّر/يتصغّر بنفس النسبة
const fullSize = () => {
  const k = (state && state.dialLayout && state.dialLayout.k) || 1;
  return { w: Math.round(CARD_FULL.w * k) + GLOW * 2, h: Math.round(CARD_FULL.h * k) + GLOW * 2 };
};
const MINI = { w: CARD_MINI.w + GLOW * 2, h: CARD_MINI.h + GLOW * 2 };
const OLD_GLOW_MARGIN = 6;              // الهامش القديم (inset: 6px): لترحيل المكان المحفوظ
const SETTINGS_SIZE = { w: 720, h: 720 };
const SETTINGS_WIDE = { w: 940, h: 1000 };   // وقت قراءة المصحف: النافذة بتكبر (وبتتصغّر تلقائيًا لو الشاشة أصغر)   // نافذة الإعدادات (شبه مربعة). بتتصغّر تلقائيًا لو الشاشة أصغر
const WHEEL_GESTURE_GAP_MS = 200;    // حركة سكرول واحدة = تسبيحة واحدة: أي wheel events متتالية بينها أقل من كده تتحسب حركة واحدة (حتى لو الاتجاه اتعكس)
const WHEEL_MIN_TICK_GAP_MS = 300;   // أقل فاصل بين تسبيحتين من السكرول: السكرول السريع فوق/تحت مش بيعدّ بسرعة
const TOGGLE_SHORTCUT = 'CommandOrControl+Alt+T';
const CLICK_VOLUME_PRESETS = [0, 10, 25, 40, 60, 80, 100];
const MAX_TARGET = 1_000_000_000;
const MAX_CUSTOM = 50;
const MAX_DHIKR_LEN = 60;
const IDLE_OPACITY_MIN = 0.3;                      // أقل شفافية مسموحة (علشان النافذة تفضل قابلة للاستخدام)
// تنبيه الأذكار المنبثق + التحدي
const POPUP_POS_EXTRA = ['tl', 'tc', 'bl', 'bc', 'br'];                  // أماكن ثابتة على الشاشة: أعلى شمال/منتصف، أسفل شمال/منتصف/يمين (corner = أعلى يمين)
const POPUP_POS_VERSE = ['corner', ...POPUP_POS_EXTRA, 'right', 'left', 'saved'];            // مكان تنبيهات الأذكار (الآيات + المخصصة)
const POPUP_POS_CARDS = ['corner', ...POPUP_POS_EXTRA, 'right', 'left', 'dial', 'saved'];    // مكان بطاقات الذكر الخفي (dial = مكان المسبحة نفسها: بتختفي وتظهر البطاقات)
const POPUP_GAP = 8;                                                     // المسافة بين الإشعار والمسبحة (لو جنبها)
const SCALE_MIN = 0.75, SCALE_MAX = 1.3;                                   // حجم الإشعار: 100% هو التصميم الأساسي (الحد الأقصى، مفيش تكبير) | أقل من 75% الكلام بيبقى صغير جدًا
const POPUP_W = 404, POPUP_MX = 6, POPUP_MY = 10;   // عرض نافذة الإشعار (الإشعار نفسه 352 + هامش Glow 26 من كل جانب) وهوامشها من حافة الشاشة (أعلى اليمين)
// التنبيهات المخصصة
const MAX_ALERTS = 30;                               // أقصى عدد تنبيهات مخصصة
const MAX_ALERT_LEN = 140;                           // أقصى طول لنص التنبيه (حرف)
const MAX_URL_LEN = 2000;
const MAX_SOUND_BYTES = 25 * 1024 * 1024;            // أقصى حجم لملف صوت التنبيه (25MB)
const CUSTOM_AUDIO_EXT = ['.mp3', '.wav', '.ogg', '.oga', '.opus', '.m4a', '.aac', '.flac', '.weba', '.webm'];
const SOUND_FILE_RE = /^[A-Za-z0-9_-]{4,64}\.(mp3|wav|ogg|oga|opus|m4a|aac|flac|weba|webm)$/i;
const CUSTOM_PLAY_CAP_S = 45;                        // أقصى مدة تشغيل لصوت تنبيه مخصص (بعدها Fade Out) علشان الإشعار ما يفضلش معلّق
const CHALLENGE_MS = 60_000;                         // مدة التحدي: دقيقة بالظبط
const REVEAL_MS = 1700;                              // وقت قلب البطاقة قبل ما الإطار يبدأ يعد
const INLINE_REVEAL_MS = 1300;                       // نفس الفكرة لما البطاقات بتظهر جوه المسبحة نفسها (اختفاء المربع + رجوع الدايرة)
const CARD_MIN = 2, CARD_MAX = 33;                   // عدد مرات الذكر العشوائي في كل بطاقة
const INTERVAL_MIN = 10, INTERVAL_MAX = 86_400;      // أقل/أكثر فاصل (بالثواني): 10 ثواني .. 24 ساعة

// الأذكار الافتراضية (ما بتتحذفش). الـ ids ثابتة علشان الترحيل من النسخ القديمة.
const DEFAULT_AZKAR = [
  { id: 'd0', text: 'سبحان الله' },
  { id: 'd1', text: 'الحمد لله' },
  { id: 'd2', text: 'الله أكبر' },
  { id: 'd4', text: 'أستغفر الله' },
  { id: 'd3', text: 'لا إله إلا الله' },
  { id: 'd5', text: 'اللهم صلِّ على محمد' }
];

// ───────────── نسخة واحدة فقط (علشان hook واحد و Tray واحد) ─────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.exit(0);

// ───────────── الحالة + الحفظ ─────────────
const stateFile = () => path.join(app.getPath('userData'), 'azkar-state.json');
const DEFAULT_STATE = {
  count: 0, total: 0,
  dhikrId: 'd0', customAzkar: [], stats: {},       // stats: { [dhikrId]: { n, last } }
  daily: {},                                       // عدّ يومي لكل ذكر: { 'YYYY-MM-DD': { [dhikrId]: n } } (آخر 40 يوم بس)
  streak: null,                                    // السلاسل: { cur: السلسلة الحالية, best: أطول سلسلة, last: آخر يوم فيه تسبيح, days: إجمالي أيام التسبيح } (بتتبني من daily لو مش موجودة)
  dndFullscreen: false,                            // عدم الإزعاج تلقائي: التنبيهات تستنى طول ما فيه برنامج بملء الشاشة (لعبة / عرض تقديمي / فيديو)
  autoAdvance: true,                               // الانتقال للذكر التالي عند اكتمال الهدف
  target: 33,                                      // null = بدون هدف
  sound: true, volume: 0.4,                        // صوت الكليك
  startupSound: true, startupVolume: 0.2,          // "فسبحان الله" عند التشغيل
  completionSound: true, completionVolume: 0.2,    // "بارك الله فيك" عند اكتمال الهدف (مرة واحدة)
  exitSound: true, exitVolume: 0.2,                // "لسانك" عند الإغلاق النهائي فقط
  miniMode: false, miniOpacity: 0.85,
  idleOpacity: 0.7,                                // شفافية النافذة لما الماوس مش فوقها (1 = بدون تغيير)
  spaceKey: false,                                 // Spacebar للتسبيح (معطّل افتراضيًا)
  hotkeys: { quit: null, mini: null, show: null, settings: null },   // اختصارات كيبورد لأوامر البرنامج (قفل / تصغير / إظهار / إعدادات)
  customKeyOn: false, customKey: null,            // زر/اختصار مخصص للتسبيح: { code, ctrl, alt, shift, meta, name }
  dialLocked: false,                               // قفل مكان المسبحة (يمنع السحب بالماوس)
  scrollOn: true,                                  // التسبيح بعجلة الماوس (Scroll)
  clickOn: false,                                  // التسبيح بالنقر بالماوس على العدّاد
  dialStyle: 'ring',                               // شكل العدّاد: 'ring' (الدايرة) | 'beads' (حبات سبحة بتلف بأنيميشن) | 'strand' (خرز كبير على الدايرة نفسها)
  beadLight: .3,                                   // سطوع الخرز (0 = داكن زي الأول .. 1 = فاتح جدًا)
  beadGlow: true,                                  // توهّج الحبات/الخرز (مفعّل = متوهجة | مقفول = مطفية)
  autoLaunch: false,                               // التشغيل مع ويندوز
  reminderOn: false, reminderEvery: 1800,          // تنبيه الأذكار المنبثق (الآية + الصوت): كل كام ثانية (الافتراضي 30 د)
  customAlerts: [],                                // تنبيهات مخصصة: { id, text, enabled, sound: null | {kind:'file',file,name} | {kind:'url',url} }
  builtinVerses: true,                             // آيات التطبيق الافتراضية تفضل ضمن التنبيهات (لو false ومفيش مخصص مفعّل: بترجع تلقائيًا)
  dialLayout: null,                                // تخصيص المسبحة الكبيرة: { k: الحجم الكلي, els: { id: {dx,dy,s,hide} }, extras: [ عناصر مضافة ] }
  glowV: 0,                                        // نسخة تخطيط النافذة (لترحيل المكان المحفوظ بعد توسيع هامش الـ Glow)
  popupVolume: 0.5,                                // مستوى صوت الإنبثاق (التحدي وغيره: صوت إنجاز التحدي، البطاقات)
  reminderSound: true, reminderVolume: 0.5,        // صوت تنبيه الأذكار (الآية العشوائية) لوحده: تشغيل/إيقاف + مستواه
  challengeOn: true, challengeEvery: 3600,         // بطاقات التحدي المخفية (تحت تنبيه الأذكار): كل كام ثانية (الافتراضي ساعة)
  popupPos: 'corner', px: null, py: null, popupScale: 1,   // تنبيهات الأذكار (الآيات + المخصصة): المكان + آخر مكان اتسحب فيه + الحجم
  cardsPos: 'corner', cx: null, cy: null, cardsScale: 1,   // بطاقات الذكر الخفي (التحدي): نفس الحاجات
  dailyAz: { d: '', m: [], e: [], sl: [], wk: [], mq: [], pr: [], wu: [], mf: false, ef: false, slf: false, wkf: false, wd: false, wf: false },   // أذكار اليوم: التاريخ + اللي اتقرا (صباح/مساء) + هل التنبيه اتبعت
  azSound: true, azVolume: 0.5,                    // صوت تنبيه أذكار الصباح والمساء (مستوى واحد للاتنين)
  wirdAlert: false, wirdAt: '20:00', wirdSound: true, wirdVolume: 0.5,   // الورد اليومي من القرآن (تنبيه + صوت اقرأ)
  sabahAlert: false, sabahAt: '06:00', sabahEnd: '12:00',   // أذكار الصباح: من - إلى (بتوقيت الجهاز: AM لحد الظهر)
  masaaAlert: false, masaaAt: '16:00', masaaEnd: '20:00',   // أذكار المساء: من العصر (4 م) لحد 8 مساءً
  sleepAlert: false, sleepAt: '22:00', sleepEnd: '23:59',   // أذكار النوم: من 10 م لحد آخر اليوم (بتوقيت الجهاز)
  wakeAlert: false, wakeAt: '04:00', wakeEnd: '11:00',      // أذكار الاستيقاظ: من 4 ص لحد 11 ص (أول ما البرنامج يفتح في الفترة دي يظهر التنبيه)
  prayerAlert: false, prayerSound: true, prayerVolume: 0.2, prayerVolV: 0,   // مواقيت الصلاة: تنبيه + صوت الأذان
  prayerOn: { fj: true, du: true, dh: true, as: true, mg: true, is: true },   // أي صلاة عليها تنبيه
  prayerCity: 'auto', prayerLat: null, prayerLng: null, prayerPlace: '', prayerMethod: 'egypt',   // الموقع: auto = من الإنترنت (IP)، أو مدينة من القائمة
  ach: {}, achInit: false, cycles: 0, bestDay: 0,        // الشارات: { id: تاريخ الفتح } + عدّادات مساعدة
  khatma: { bits: '', start: '', days: 30, count: 0, today: { d: '', n: 0 } },   // الختمة: bits = 604 خانة (الصفحات اللي اتقرت) + بداية + المدة + عدد الختمات
  autoUpdateOn: true, autoBackup: true,                  // التحديث التلقائي + النسخ الاحتياطي التلقائي
  azTimeV: 0,
  x: null, y: null,                                // مكان النافذة العادية
  mx: null, my: null                               // مكان الـ Mini Mode
};
let state = { ...DEFAULT_STATE };
let restoringBackup = false;                              // أثناء استعادة نسخة احتياطية: ممنوع أي حفظ يكتب فوقها

// الإشعار المنبثق + التحدي (نافذة واحدة فقط في أي لحظة)
let popupWin = null;       // BrowserWindow الإشعار
let popup = null;          // { kind: 'verse'|'cards', phase, cards, picked }
let challenge = null;      // { id, text, need, done, startsAt, endsAt, timer } أثناء التحدي فقط
let popupSafety = null, popupShowTimer = null;
const popupTimers = { reminder: null, challenge: null };

// ───────────── تخصيص المسبحة (الشكل الخارجي للمسبحة الكبيرة) ─────────────
const LAYOUT_IDS = ['logo', 'tag', 'dial', 'num', 'of', 'dhikr', 'total', 'snd', 'btns', 'az', 'topL', 'topR'];
const LAYOUT_NOHIDE = new Set(['topL']);                  // زر الإعدادات لازم يفضل ظاهر
const EXTRA_TYPES = ['clock', 'date', 'hijri', 'today', 'pct', 'prayer', 'text'];
const LAYOUT_K_MIN = 0.8, LAYOUT_K_MAX = 1.6, EXTRAS_MAX = 8;
function sanitizeLayout(L) {
  const out = { k: 1, els: {}, extras: [] };
  if (!L || typeof L !== 'object') return out;
  const n = (v, lo, hi, d) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v * 100) / 100)) : d);
  out.k = n(L.k, LAYOUT_K_MIN, LAYOUT_K_MAX, 1);
  const one = e => ({ dx: n(e && e.dx, -400, 400, 0), dy: n(e && e.dy, -400, 400, 0), s: n(e && e.s, 0.4, 3, 1) });
  for (const id of LAYOUT_IDS) {
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
}
// بعد تغيير الحجم الكلي: النافذة بتتغيّر حوالين نفس المركز وتفضل جوه الشاشة
function refitDialWindow() {
  if (!win || win.isDestroyed() || vis !== 'shown' || state.miniMode) return;
  const b = win.getBounds(), s = size();
  if (b.width === s.w && b.height === s.h) return;
  const wa = screen.getDisplayMatching(b).workArea;
  let x = Math.round(b.x + (b.width - s.w) / 2), y = Math.round(b.y + (b.height - s.h) / 2);
  x = Math.min(Math.max(x, wa.x - GLOW), wa.x + wa.width - s.w + GLOW);
  y = Math.min(Math.max(y, wa.y - GLOW), wa.y + wa.height - s.h + GLOW);
  win.setBounds({ x, y, width: s.w, height: s.h });
  rememberPosition();
  resetMouse();
}

function sanitizeKey(k) {
  if (!k || typeof k !== 'object' || !Number.isInteger(k.code) || k.code < 1 || k.code > 0xFFFF) return null;
  return { code: k.code, ctrl: !!k.ctrl, alt: !!k.alt, shift: !!k.shift, meta: !!k.meta, name: String(k.name || '').slice(0, 40) };
}
function loadState() {
  try {
    const saved = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    state = { ...DEFAULT_STATE, ...saved };
    // ترحيل من النسخ السابقة
    if (saved.target === undefined && saved.goal !== undefined) state.target = [33, 99, 100][saved.goal] || 33;
    if (saved.dhikrId === undefined && Number.isInteger(saved.dhikr)) state.dhikrId = 'd' + saved.dhikr;
    delete state.goal; delete state.dhikr;
  } catch (_) {
    if (fs.existsSync(stateFile())) { const b = latestBackupObj(); if (b && b.state) state = { ...DEFAULT_STATE, ...b.state }; }   // الملف باظ: نرجّع من آخر نسخة احتياطية
  }   // (لو الملف مش موجود = أول تشغيل)
  // تنظيف/تحقق
  if (state.target !== null && !(state.target >= 1)) state.target = 33;
  state.customAzkar = (Array.isArray(state.customAzkar) ? state.customAzkar : [])
    .filter(a => a && typeof a.id === 'string' && typeof a.text === 'string' && a.text.trim())
    .slice(0, MAX_CUSTOM);
  if (!state.stats || typeof state.stats !== 'object') state.stats = {};
  if (!state.daily || typeof state.daily !== 'object' || Array.isArray(state.daily)) state.daily = {};
  if (typeof state.dndFullscreen !== 'boolean') state.dndFullscreen = false;
  normStreak();
  if (!dhikrById(state.dhikrId)) state.dhikrId = 'd0';
  const iv = (v, d) => (Number.isFinite(v) ? Math.min(INTERVAL_MAX, Math.max(INTERVAL_MIN, Math.floor(v))) : d);
  state.reminderEvery = iv(state.reminderEvery, DEFAULT_STATE.reminderEvery);
  state.challengeEvery = iv(state.challengeEvery, DEFAULT_STATE.challengeEvery);
  state.popupVolume = Number.isFinite(state.popupVolume) ? Math.min(1, Math.max(0, state.popupVolume)) : DEFAULT_STATE.popupVolume;
  state.idleOpacity = Number.isFinite(state.idleOpacity) ? Math.min(1, Math.max(IDLE_OPACITY_MIN, state.idleOpacity)) : DEFAULT_STATE.idleOpacity;
  state.reminderOn = state.reminderOn === true;
  state.reminderSound = state.reminderSound !== false;
  state.reminderVolume = Number.isFinite(state.reminderVolume) ? Math.min(1, Math.max(0, state.reminderVolume)) : DEFAULT_STATE.reminderVolume;
  state.dialLocked = state.dialLocked === true;
  state.dialLayout = sanitizeLayout(state.dialLayout);
  state.customKey = sanitizeKey(state.customKey);
  state.customKeyOn = state.customKeyOn === true && !!state.customKey;
  state.scrollOn = state.scrollOn !== false;
  state.clickOn = state.clickOn === true;
  state.dialStyle = ['ring', 'beads', 'strand'].includes(state.dialStyle) ? state.dialStyle : 'ring';
  state.beadGlow = state.beadGlow !== false;
  state.beadLight = Number.isFinite(state.beadLight) ? Math.min(1, Math.max(0, state.beadLight)) : .3;
  state.autoLaunch = state.autoLaunch === true;
  state.challengeOn = state.challengeOn !== false;
  state.builtinVerses = state.builtinVerses !== false;
  if (!Number.isFinite(state.px) || !Number.isFinite(state.py)) { state.px = null; state.py = null; }
  if (!Number.isFinite(state.cx) || !Number.isFinite(state.cy)) { state.cx = null; state.cy = null; }
  if (!POPUP_POS_VERSE.includes(state.popupPos) || (state.popupPos === 'saved' && state.px === null)) state.popupPos = 'corner';
  if (!POPUP_POS_CARDS.includes(state.cardsPos) || (state.cardsPos === 'saved' && state.cx === null)) state.cardsPos = 'corner';
  const sc = v => (Number.isFinite(v) ? Math.min(SCALE_MAX, Math.max(SCALE_MIN, v)) : 1);
  state.popupScale = sc(state.popupScale); state.cardsScale = sc(state.cardsScale);
  state.customAlerts = sanitizeAlerts(state.customAlerts);
  state.azSound = state.azSound !== false;
  state.azVolume = Number.isFinite(state.azVolume) ? Math.min(1, Math.max(0, state.azVolume)) : 0.5;
  state.wirdAlert = state.wirdAlert === true; state.wirdSound = state.wirdSound !== false;
  state.wirdVolume = Number.isFinite(state.wirdVolume) ? Math.min(1, Math.max(0, state.wirdVolume)) : 0.5;
  if (!TIME_RE.test(state.wirdAt)) state.wirdAt = '20:00';
  state.sabahAlert = state.sabahAlert === true; state.masaaAlert = state.masaaAlert === true;
  if (!TIME_RE.test(state.sabahAt)) state.sabahAt = '06:00';
  if (!TIME_RE.test(state.masaaAt)) state.masaaAt = '16:00';
  if (!TIME_RE.test(state.sabahEnd)) state.sabahEnd = '12:00';
  if (!TIME_RE.test(state.masaaEnd)) state.masaaEnd = '20:00';
  state.sleepAlert = state.sleepAlert === true; state.wakeAlert = state.wakeAlert === true;
  if (!TIME_RE.test(state.sleepAt)) state.sleepAt = '22:00';
  if (!TIME_RE.test(state.sleepEnd)) state.sleepEnd = '23:59';
  if (!TIME_RE.test(state.wakeAt)) state.wakeAt = '04:00';
  if (!TIME_RE.test(state.wakeEnd)) state.wakeEnd = '11:00';
  state.prayerAlert = state.prayerAlert === true; state.prayerSound = state.prayerSound !== false;
  state.prayerVolume = Number.isFinite(state.prayerVolume) ? Math.min(1, Math.max(0, state.prayerVolume)) : 0.2;
  if (state.prayerVolV !== 1) { state.prayerVolume = 0.2; state.prayerVolV = 1; }   // ترحيل: مستوى صوت الأذان الأصلي 20% (المستخدم يقدر يرفعه بعد كده)
  { const o = (state.prayerOn && typeof state.prayerOn === 'object') ? state.prayerOn : {}; state.prayerOn = {}; for (const k of PRAYER_KEYS) state.prayerOn[k] = o[k] !== false; }
  if (state.prayerCity === 'cairo') state.prayerCity = 'eg';
  if (state.prayerCity !== 'auto' && !PRAYER_CITIES[state.prayerCity]) state.prayerCity = 'auto';
  if (!Number.isFinite(state.prayerLat) || !Number.isFinite(state.prayerLng)) { state.prayerLat = null; state.prayerLng = null; }
  if (!PRAYER_METHODS[state.prayerMethod]) state.prayerMethod = 'egypt';
  { const h = (state.hotkeys && typeof state.hotkeys === 'object') ? state.hotkeys : {}; state.hotkeys = {}; for (const a of HOTKEY_ACTIONS) state.hotkeys[a] = sanitizeKey(h[a]); }
  state.ach = (state.ach && typeof state.ach === 'object' && !Array.isArray(state.ach)) ? state.ach : {};
  state.achInit = state.achInit === true;
  state.cycles = Number.isFinite(state.cycles) ? Math.max(0, Math.floor(state.cycles)) : 0;
  state.bestDay = Number.isFinite(state.bestDay) ? Math.max(0, Math.floor(state.bestDay)) : 0;
  { const k = (state.khatma && typeof state.khatma === 'object') ? state.khatma : {}, td = (k.today && typeof k.today === 'object') ? k.today : {};
    state.khatma = {
      bits: (typeof k.bits === 'string' && /^[01]{604}$/.test(k.bits)) ? k.bits : '0'.repeat(604),
      start: (typeof k.start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k.start)) ? k.start : dayKeyOf(new Date()),
      days: (Number.isInteger(k.days) && k.days >= 1 && k.days <= 365) ? k.days : 30,
      count: Number.isFinite(k.count) ? Math.max(0, Math.floor(k.count)) : 0,
      today: { d: typeof td.d === 'string' ? td.d : '', n: Number.isFinite(td.n) ? Math.max(0, Math.floor(td.n)) : 0 }
    }; }
  state.autoUpdateOn = state.autoUpdateOn !== false; state.autoBackup = state.autoBackup !== false;
  state.prayerPlace = typeof state.prayerPlace === 'string' ? state.prayerPlace.slice(0, 60) : '';
  if (state.azTimeV !== 3) { if (state.masaaAt === '17:00' || state.masaaAt === '12:00') state.masaaAt = '16:00'; state.azTimeV = 3; }   // ترحيل: الميعاد الافتراضي القديم للمساء (5م أو 12 ظهرًا) بقى من العصر 4م
  if (!state.dailyAz || typeof state.dailyAz !== 'object') state.dailyAz = { d: '', m: [], e: [], sl: [], wk: [], mq: [], pr: [], wu: [], mf: false, ef: false, slf: false, wkf: false, wd: false, wf: false };
  // ترحيل المكان المحفوظ: الهامش الشفاف زاد، فنزحزح الإحداثيات علشان الكارت يفضل في نفس مكانه على الشاشة
  if (!state.glowV) {
    for (const k of ['x', 'y', 'mx', 'my']) if (Number.isFinite(state[k])) state[k] -= (GLOW - OLD_GLOW_MARGIN);
    state.glowV = 1;
  }
}

let saveTimer = null;
function saveStateSoon() {                 // حفظ مؤجّل: مفيش كتابة على الديسك مع كل Scroll
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveStateNow, 600);
}
function saveStateNow() {
  clearTimeout(saveTimer);
  if (restoringBackup) return;
  try { fs.writeFileSync(stateFile(), JSON.stringify(state)); } catch (_) {}
}

// ───────────── الأذكار + الإحصائيات ─────────────
const allAzkar = () => [
  ...DEFAULT_AZKAR.map(a => ({ id: a.id, text: a.text, custom: false })),
  ...state.customAzkar.map(a => ({ id: a.id, text: a.text, custom: true }))
];
const dhikrById = id => allAzkar().find(a => a.id === id);
const currentDhikr = () => dhikrById(state.dhikrId) || { id: 'd0', text: DEFAULT_AZKAR[0].text, custom: false };
function nextDhikrId() {
  const list = allAzkar();
  const i = list.findIndex(a => a.id === state.dhikrId);
  return list[(i + 1) % list.length].id;
}
function selectDhikr(id) {
  if (!dhikrById(id) || id === state.dhikrId) return;
  state.dhikrId = id;
  state.count = 0;                         // تغيير الذكر يبدأ عدّ جديد (زي السلوك السابق)
}
function addDhikr(raw) {
  const text = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
  if (!text) return { ok: false, error: 'اكتب الذكر الأول' };
  if ([...text].length > MAX_DHIKR_LEN) return { ok: false, error: `الحد الأقصى ${MAX_DHIKR_LEN} حرف` };
  if (state.customAzkar.length >= MAX_CUSTOM) return { ok: false, error: `الحد الأقصى ${MAX_CUSTOM} ذكر مخصص` };
  if (allAzkar().some(a => a.text === text)) return { ok: false, error: 'الذكر موجود بالفعل' };
  const id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  state.customAzkar.push({ id, text });
  afterAzkarChange();
  return { ok: true, id };
}
function deleteDhikr(id) {
  const i = state.customAzkar.findIndex(a => a.id === id);   // الافتراضية مش ممكن تتحذف
  if (i === -1) return { ok: false };
  state.customAzkar.splice(i, 1);
  delete state.stats[id];
  for (const k of Object.keys(state.daily || {})) if (state.daily[k]) delete state.daily[k][id];
  if (state.dhikrId === id) { state.dhikrId = 'd0'; state.count = 0; }
  afterAzkarChange();
  return { ok: true };
}
function afterAzkarChange() {
  broadcastState(); refreshTrayTip(); refreshTrayMenu(); saveStateSoon();
}
function dayKeyOf(dt) { return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0'); }
function bumpDaily(id) {                                   // عدّ اليوم لكل ذكر (بتوقيت الجهاز) + تنظيف اللي أقدم من 40 يوم
  const k = dayKeyOf(new Date());
  const day = state.daily[k] || (state.daily[k] = {});
  day[id] = (day[id] || 0) + 1;
  const old = Object.keys(state.daily).filter(x => x < dayKeyOf(dateAgo(40)));
  for (const x of old) delete state.daily[x];
  streakTouch();                                           // أول تسبيحة في اليوم = اليوم ده دخل السلسلة
}

// ───────────── السلاسل (Streak): أيام متتالية فيها تسبيح ─────────────
// daily بيتمسح منه اللي أقدم من 40 يوم، فالسلسلة بتتحفظ لوحدها في state.streak علشان تعدّي الـ 40 يوم.
const dateAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return d; };   // "من n يوم": بالتقويم مش بالميلي ثانية (مصر فيها توقيت صيفي: يوم 23/25 ساعة)
const dayShift = n => dayKeyOf(dateAgo(n));
const dayDiff = (a, b) => { const p = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); }; return Math.round((p(b) - p(a)) / 864e5); };   // فرق أيام تقويمي بين 'YYYY-MM-DD' و 'YYYY-MM-DD'
const dayTotal = k => Object.values((state.daily || {})[k] || {}).reduce((a, b) => a + (b || 0), 0);
function nextDayKey(k) { const [y, mo, d] = k.split('-').map(Number); return dayKeyOf(new Date(y, mo - 1, d + 1)); }
function rebuildStreak() {                                 // أول مرة (أو ملف قديم): نبنيها من العدّ اليومي المتاح
  const keys = Object.keys(state.daily || {}).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k) && dayTotal(k) > 0).sort();
  let run = 0, best = 0, prev = null;
  for (const k of keys) { run = prev && nextDayKey(prev) === k ? run + 1 : 1; if (run > best) best = run; prev = k; }
  state.streak = { cur: run, best, last: prev || '', days: keys.length };
}
function normStreak() {
  const s = state.streak;
  if (!s || typeof s !== 'object' || ![s.cur, s.best, s.days].every(Number.isFinite) || typeof s.last !== 'string') return rebuildStreak();
  s.cur = Math.max(0, Math.floor(s.cur)); s.best = Math.max(s.cur, Math.floor(s.best)); s.days = Math.max(0, Math.floor(s.days));
}
function streakTouch() {
  if (!state.streak) rebuildStreak();
  const s = state.streak, t = dayKeyOf(new Date());
  if (s.last === t) return;                                // النهارده اتحسب قبل كده
  s.cur = s.last === dayShift(1) ? s.cur + 1 : 1;          // امبارح كان فيه تسبيح = السلسلة كملت، غير كده بتبدأ من 1
  s.last = t; s.days += 1;
  if (s.cur > s.best) s.best = s.cur;
}
function streakView() {
  const s = state.streak || { cur: 0, best: 0, last: '', days: 0 }, t = dayKeyOf(new Date());
  const doneToday = s.last === t, cur = (doneToday || s.last === dayShift(1)) ? s.cur : 0;   // لو فات يوم من غير تسبيح: السلسلة الحالية صفر
  const dots = []; for (let i = 13; i >= 0; i--) dots.push(dayTotal(dayShift(i)) > 0);        // آخر 14 يوم (الأقدم أولاً)
  return { cur, best: Math.max(s.best, cur), days: s.days, doneToday, dots };
}
const statsPayload = () => ({ list: statsList(), streak: streakView(), week: weeklyPayload(), ach: achView(), khatma: khatmaView() });
function statsList() {
  const today = dayKeyOf(new Date());
  const week = new Set(); for (let i = 0; i < 7; i++) week.add(dayKeyOf(dateAgo(i)));   // آخر 7 أيام شامل النهارده
  const dayN = {}, weekN = {}, ddN = {};
  const dayIdx = {}; for (let i = 0; i < 7; i++) dayIdx[dayKeyOf(dateAgo(i))] = 6 - i;
  for (const [k, m] of Object.entries(state.daily || {})) {
    if (!m || typeof m !== 'object') continue;
    for (const [id, n] of Object.entries(m)) {
      if (!(n > 0)) continue;
      if (k === today) dayN[id] = (dayN[id] || 0) + n;
      if (week.has(k)) { weekN[id] = (weekN[id] || 0) + n; (ddN[id] || (ddN[id] = [0, 0, 0, 0, 0, 0, 0]))[dayIdx[k]] += n; }
    }
  }
  const list = allAzkar()
    .map(a => ({ id: a.id, text: a.text, n: (state.stats[a.id] || {}).n || 0, last: (state.stats[a.id] || {}).last || 0, d: dayN[a.id] || 0, w: weekN[a.id] || 0, dd: ddN[a.id] || [0, 0, 0, 0, 0, 0, 0] }))
    .filter(x => x.n > 0 || x.d > 0 || x.w > 0);
  list.sort((a, b) => b.n - a.n || b.last - a.last);          // الأكثر استخدامًا أولاً (الصفحة بترتّب كل تبويب لوحده)
  return list;
}

const todayCount = () => { const d = (state.daily || {})[dayKeyOf(new Date())] || {}; return Object.values(d).reduce((a, b) => a + (b || 0), 0); };
const publicState = () => ({
  count: state.count, total: state.total, target: state.target,
  dhikrId: state.dhikrId, dhikrText: currentDhikr().text, azkar: allAzkar(), autoAdvance: state.autoAdvance,
  sound: state.sound, volume: state.volume,
  startupSound: state.startupSound, startupVolume: state.startupVolume,
  completionSound: state.completionSound, completionVolume: state.completionVolume,
  exitSound: state.exitSound, exitVolume: state.exitVolume,
  miniMode: state.miniMode, miniOpacity: state.miniOpacity, idleOpacity: state.idleOpacity,
  dialStyle: state.dialStyle, beadGlow: state.beadGlow, beadLight: state.beadLight, spaceKey: state.spaceKey, customKeyOn: state.customKeyOn, customKeyName: state.customKey ? state.customKey.name : '', hotkeyNames: Object.fromEntries(HOTKEY_ACTIONS.map(a => [a, state.hotkeys[a] ? state.hotkeys[a].name : ''])), dialLocked: state.dialLocked, dialLayout: state.dialLayout || sanitizeLayout(null), todayN: todayCount(), scrollOn: state.scrollOn, clickOn: state.clickOn, autoLaunch: state.autoLaunch,
  reminderOn: state.reminderOn, reminderEvery: state.reminderEvery, popupVolume: state.popupVolume,
  reminderSound: state.reminderSound, reminderVolume: state.reminderVolume,
  challengeOn: state.challengeOn, challengeEvery: state.challengeEvery,
  builtinVerses: state.builtinVerses,
  dndFullscreen: state.dndFullscreen, dndNow: dndActive(),
  popupPos: state.popupPos, popupSaved: state.px !== null, popupScale: state.popupScale,
  cardsPos: state.cardsPos, cardsSaved: state.cx !== null, cardsScale: state.cardsScale,
  dailyAz: dailyAz(), azDue: azDue(), azRest: azRest(), wirdDue: wirdDue(), wirdAlert: state.wirdAlert, wirdAt: state.wirdAt, wirdSound: state.wirdSound, wirdVolume: state.wirdVolume, azSound: state.azSound, azVolume: state.azVolume, sabahAlert: state.sabahAlert, sabahAt: state.sabahAt, sabahEnd: state.sabahEnd, masaaAlert: state.masaaAlert, masaaAt: state.masaaAt, masaaEnd: state.masaaEnd, sleepAlert: state.sleepAlert, sleepAt: state.sleepAt, sleepEnd: state.sleepEnd, wakeAlert: state.wakeAlert, wakeAt: state.wakeAt, wakeEnd: state.wakeEnd,
  prayerAlert: state.prayerAlert, prayerSound: state.prayerSound, prayerVolume: state.prayerVolume, prayerOn: state.prayerOn, prayerCity: state.prayerCity, prayerInfo: prayerInfo(),
  hook: hookInfo.status, hookErr: hookInfo.error, hookRestarts: hookInfo.restarts,
  appVersion: app.getVersion(), upd, autoUpdateOn: state.autoUpdateOn, autoBackup: state.autoBackup
});
// الحالة اللي بتتعرض في نافذة الدايل: أثناء التحدي العدد والهدف والذكر بيبقوا بتوع التحدي
const viewState = () => (challenge
  ? { ...publicState(), count: challenge.done, target: challenge.need, dhikrId: challenge.id, dhikrText: challenge.text, challenge: true }
  : publicState());
const tickState = () => ({
  count: state.count, total: state.total, target: state.target, todayN: todayCount(),
  dhikrId: state.dhikrId, dhikrText: currentDhikr().text
});

// ───────────── التنبيهات المخصصة ─────────────
// النص بيظهر في نفس الإشعار المنبثق (زي الآيات) والصوت اختياري: ملف من الجهاز (بيتنسخ جوه userData/custom-sounds
// علشان يفضل شغّال لو الأصل اتنقل/اتحذف) أو رابط مباشر http/https. لو مفيش صوت الإشعار بيظهر عادي بدون صوت.
const soundDir = () => path.join(app.getPath('userData'), 'custom-sounds');
const soundFileUrl = f => pathToFileURL(path.join(soundDir(), f)).href;
const normText = raw => String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();

// بترجّع { ok, sound } أو { ok:false, error }. soft=true: أي مشكلة = بدون صوت (للتحميل من الملف المحفوظ)
function cleanSound(raw, soft) {
  const none = { ok: true, sound: null };
  const bad = error => (soft ? none : { ok: false, error });
  if (!raw || raw.kind === 'none') return none;
  if (raw.kind === 'url') {
    const str = String(raw.url == null ? '' : raw.url).trim();
    if (!str) return bad('اكتب رابط الصوت');
    if (str.length > MAX_URL_LEN) return bad('الرابط طويل جدًا');
    let u; try { u = new URL(str); } catch (_) { return bad('الرابط غير صحيح'); }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return bad('الرابط لازم يبدأ بـ http:// أو https://');
    return { ok: true, sound: { kind: 'url', url: u.href } };
  }
  if (raw.kind === 'file') {
    const f = String(raw.file == null ? '' : raw.file);
    let exists = false;
    try { exists = SOUND_FILE_RE.test(f) && fs.statSync(path.join(soundDir(), f)).isFile(); } catch (_) {}
    if (!exists) return bad('ملف الصوت غير موجود، اختره مرة أخرى');
    return { ok: true, sound: { kind: 'file', file: f, name: String(raw.name || f).slice(0, 120) } };
  }
  return bad('نوع الصوت غير معروف');
}
const soundSrc = snd => (!snd ? null : snd.kind === 'file' ? soundFileUrl(snd.file) : snd.url);

function sanitizeAlerts(list) {
  if (!Array.isArray(list)) return [];
  const out = [], seen = new Set();
  for (const a of list) {
    if (!a || typeof a.id !== 'string' || !a.id || seen.has(a.id)) continue;
    const text = normText(a.text);
    if (!text || [...text].length > MAX_ALERT_LEN) continue;
    seen.add(a.id);
    out.push({ id: a.id, text, enabled: a.enabled !== false, sound: cleanSound(a.sound, true).sound });
    if (out.length >= MAX_ALERTS) break;
  }
  return out;
}
const alertView = a => ({
  id: a.id, text: a.text, enabled: a.enabled,
  sound: a.sound ? { kind: a.sound.kind, name: a.sound.kind === 'file' ? a.sound.name : a.sound.url, file: a.sound.file || null, url: soundSrc(a.sound) } : null
});
const alertsList = () => state.customAlerts.map(alertView);
function afterAlertsChange() {
  saveStateSoon();
  sendSettings('alerts:update', alertsList());
}
function removeSoundFile(snd) {
  if (!snd || snd.kind !== 'file' || !SOUND_FILE_RE.test(snd.file)) return;
  try { fs.unlinkSync(path.join(soundDir(), snd.file)); } catch (_) {}
}
// حذف ملفات الصوت اللي مش مستخدمة في أي تنبيه (اختيارات اتلغت قبل الحفظ، أو تنبيهات اتحذفت)
function cleanupSoundFiles() {
  let files = [];
  try { files = fs.readdirSync(soundDir()); } catch (_) { return; }
  const used = new Set(state.customAlerts.filter(a => a.sound && a.sound.kind === 'file').map(a => a.sound.file));
  for (const f of files) {
    if (SOUND_FILE_RE.test(f) && !used.has(f)) { try { fs.unlinkSync(path.join(soundDir(), f)); } catch (_) {} }
  }
}

function saveAlert(d) {
  d = d || {};
  const text = normText(d.text);
  if (!text) return { ok: false, error: 'اكتب نص التنبيه الأول' };
  if ([...text].length > MAX_ALERT_LEN) return { ok: false, error: `الحد الأقصى ${MAX_ALERT_LEN} حرف` };
  const snd = cleanSound(d.sound, false);
  if (!snd.ok) return snd;
  const old = typeof d.id === 'string' ? state.customAlerts.find(a => a.id === d.id) : null;
  if (old) {
    const oldFile = old.sound && old.sound.kind === 'file' ? old.sound.file : null;
    const newFile = snd.sound && snd.sound.kind === 'file' ? snd.sound.file : null;
    if (oldFile && oldFile !== newFile) removeSoundFile(old.sound);        // الملف القديم اتبدّل أو اتشال
    old.text = text; old.sound = snd.sound;
    if (typeof d.enabled === 'boolean') old.enabled = d.enabled;
    afterAlertsChange();
    return { ok: true, id: old.id };
  }
  if (state.customAlerts.length >= MAX_ALERTS) return { ok: false, error: `الحد الأقصى ${MAX_ALERTS} تنبيه مخصص` };
  const id = 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  state.customAlerts.push({ id, text, enabled: d.enabled !== false, sound: snd.sound });
  afterAlertsChange();
  return { ok: true, id };
}
function deleteAlert(id) {
  const i = state.customAlerts.findIndex(a => a.id === id);
  if (i === -1) return { ok: false };
  const [gone] = state.customAlerts.splice(i, 1);
  removeSoundFile(gone.sound);
  afterAlertsChange();
  return { ok: true };
}
function toggleAlert(id, on) {
  const a = state.customAlerts.find(x => x.id === id);
  if (!a) return { ok: false };
  a.enabled = !!on;
  afterAlertsChange();
  return { ok: true };
}
// اختيار ملف صوت من الجهاز: بيتنسخ فورًا لمجلد التطبيق ويرجّع اسمه الداخلي (بيتربط بالتنبيه عند الحفظ)
async function pickSound() {
  try {
    const parent = settingsWin && !settingsWin.isDestroyed() ? settingsWin : undefined;
    const r = await dialog.showOpenDialog(parent, {
      title: 'اختر ملف الصوت', properties: ['openFile'],
      filters: [{ name: 'ملفات صوت', extensions: CUSTOM_AUDIO_EXT.map(x => x.slice(1)) }]
    });
    if (r.canceled || !r.filePaths || !r.filePaths[0]) return { ok: false, canceled: true };
    const src = r.filePaths[0];
    const ext = path.extname(src).toLowerCase();
    if (!CUSTOM_AUDIO_EXT.includes(ext)) return { ok: false, error: 'صيغة الملف غير مدعومة' };
    const st = await fs.promises.stat(src);
    if (!st.isFile() || st.size === 0) return { ok: false, error: 'الملف فاضي أو غير صالح' };
    if (st.size > MAX_SOUND_BYTES) return { ok: false, error: 'حجم الملف كبير (الحد الأقصى 25 ميجا)' };
    await fs.promises.mkdir(soundDir(), { recursive: true });
    const file = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + ext;
    await fs.promises.copyFile(src, path.join(soundDir(), file));
    return { ok: true, file, name: path.basename(src), url: soundFileUrl(file) };
  } catch (_) { return { ok: false, error: 'تعذّر قراءة الملف' }; }
}

// ───────────── ملفات الصوت (الامتداد بيتكشف تلقائيًا من assets/audio) ─────────────
const AUDIO_EXT = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.opus', '.webm'];
function findAudio(matchName) {
  const dir = path.join(__dirname, 'assets', 'audio');
  let files = [];
  try { files = fs.readdirSync(dir); } catch (_) {}
  for (const f of files) {
    const { name, ext } = path.parse(f);
    if (!AUDIO_EXT.includes(ext.toLowerCase())) continue;
    if (matchName(name.normalize('NFC').toLowerCase())) return pathToFileURL(path.join(dir, f)).href;
  }
  return null;
}
let audioFiles = { uiclick: null, wird: null, birds: null, owl: null, sleep: null, wake: null, athan: null, click: null, done: null, startup: null, exit: null, reminder: null, reminder2: null, challenge: null, hover: null };
function scanAudio() {
  audioFiles = {
    uiclick: findAudio(n => n === 'ui_click'),         // UI_Click.* : صوت الضغط على علامة ✓ في أذكار الصباح والمساء
    wird: findAudio(n => n === 'wird'),               // Wird.* : تنبيه الورد اليومي (اقرأ)
    birds: findAudio(n => n === 'birds'),             // Birds.* : تنبيه أذكار الصباح
    owl: findAudio(n => n === 'owl'),                 // OWL.* : تنبيه أذكار المساء
    sleep: findAudio(n => n === 'sleep'),             // Sleep.* : تنبيه أذكار النوم (لو مش موجود بيستخدم OWL)
    athan: findAudio(n => n === 'athan'),             // Athan.* : أذان الصلاة
    wake: findAudio(n => n === 'wake'),               // Wake.* : تنبيه أذكار الاستيقاظ (لو مش موجود بيستخدم Birds)
    click: findAudio(n => n === 'click') || findAudio(n => n === 'tasbeeh'),
    // Completion.* لو موجود، وإلا الصوت الهادئ الافتراضي complete.wav
    done: findAudio(n => n === 'completion') || findAudio(n => n === 'complete'),
    startup: findAudio(n => n === 'startup') || findAudio(n => n.includes('فسبحان')),   // Startup.* (أو أي اسم فيه "فسبحان")
    // Exit.* (أو أي اسم فيه "لسانك")
    exit: findAudio(n => n === 'exit') || findAudio(n => n.includes('لسانك')),
    reminder: findAudio(n => n === 'reminder'),       // Reminder.* : "ألا بذكر الله تطمئن القلوب" (الإشعار المنبثق)
    reminder2: findAudio(n => n === 'reminder2'),     // Reminder2.* : "فسبحان الله حين تمسون وحين تصبحون" (الآية التانية في الإشعار)
    challenge: findAudio(n => n === 'challenge'),     // Challenge.* : صوت إنجاز التحدي (هادي)
    hover: findAudio(n => n === 'hover')              // Hover.* : صوت المرور على بطاقات التحدي (هادي)
  };
}

// ───────────── النافذة (عادية / Mini) ─────────────
let win = null;
let settingsWin = null;
let tray = null;
let quitting = false;

const size = () => (state.miniMode ? MINI : fullSize());
const posKeys = () => (state.miniMode ? ['mx', 'my'] : ['x', 'y']);

function defaultPosition(s) {
  const wa = screen.getPrimaryDisplay().workArea;
  return { x: wa.x + wa.width - s.w - 24, y: wa.y + wa.height - s.h - 24 };
}
function resolvePosition() {
  const s = size();
  const [kx, ky] = posKeys();
  const sx = state[kx], sy = state[ky];
  if (Number.isFinite(sx) && Number.isFinite(sy)) {
    // نتأكد إن المكان المحفوظ لسه جوه شاشة موجودة (لو فصلت شاشة مثلاً)
    const b = screen.getDisplayMatching({ x: sx, y: sy, width: s.w, height: s.h }).workArea;
    if (sx >= b.x - 20 && sy >= b.y - 20 && sx <= b.x + b.width - 40 && sy <= b.y + b.height - 40) return { x: sx, y: sy };
  }
  return defaultPosition(s);
}
function capturePosition() {
  if (!win || win.isDestroyed() || vis !== 'shown' || win.isMinimized()) return;   // مكان النافذة المصغّرة مش حقيقي
  const [x, y] = win.getPosition();
  const [kx, ky] = posKeys();
  state[kx] = x; state[ky] = y;
}
function rememberPosition() { capturePosition(); saveStateSoon(); }

function assertOnTop() {
  if (!win || win.isDestroyed()) return;
  win.setAlwaysOnTop(true, 'screen-saver');          // أعلى مستوى: فوق Borderless Fullscreen
}

const send = (channel, payload) => { if (win && !win.isDestroyed()) win.webContents.send(channel, payload); };
const sendSettings = (channel, payload) => { if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send(channel, payload); };
const sendPopup = (channel, payload) => { if (popupWin && !popupWin.isDestroyed()) popupWin.webContents.send(channel, payload); };
// أحداث التحدي (كشف/عدّ/نجاح/فشل): لو البطاقات ظاهرة جوه المسبحة تروح لنافذة المسبحة، وإلا لنافذة الإشعار
const sendPop = (channel, payload) => { if (popup && popup.inline) send(channel, payload); else sendPopup(channel, payload); };
function broadcastState() {
  const s = publicState();
  send('state', viewState());
  sendSettings('state', s);
  sendSettings('stats', statsPayload());
  sendPopup('state', s);                       // مستوى صوت الإنبثاق يتحدث لحظيًا
}
const settingsFocused = () => !!settingsWin && !settingsWin.isDestroyed() && settingsWin.isFocused();

// ───────────── Debug logging (مؤقت) ─────────────
// بيكتب في: %APPDATA%/wzaker/azkar-debug.log  (غيّر DEBUG إلى false لإيقافه)
const DEBUG = false;
let dbgFile = null;
function dbg(tag, extra) {
  if (!DEBUG) return;
  let w;
  try {
    w = (win && !win.isDestroyed())
      ? `destroyed=false minimized=${win.isMinimized()} visible=${win.isVisible()} focused=${win.isFocused()}`
      : 'destroyed=true/null';
  } catch (_) { w = 'state-error'; }
  const line = `${new Date().toISOString().slice(11, 23)} ${tag} | ${w} | vis=${vis} mini=${state.miniMode} ignoring=${ignoring} holding=${holding}${extra ? ' | ' + extra : ''}`;
  console.log(line);
  try { fs.appendFileSync(dbgFile || (dbgFile = path.join(app.getPath('userData'), 'azkar-debug.log')), line + '\n'); } catch (_) {}
}

// Click-through: بيخلي الدايل (الدائرة) يمرّر الضغطات للبرنامج اللي ورا. مطفي افتراضيًا لأنه أكبر مشتبه
// في مشكلة "الواجهة مش بتستجيب بعد Restore" (تبديل WS_EX_TRANSPARENT/LAYERED على نافذة شفافة بعد Minimize).
// الـ Main UI يفضل تفاعلي دايمًا. لو عايز السلوك القديم رجّعه true.
const CLICK_THROUGH = false;

// ── حالة الظهور: حالة واحدة فقط في أي لحظة: 'shown' (ظاهرة) | 'minimized' (Taskbar) | 'tray' (مخفية)
//    وضع العرض (عادي/Mini) منفصل: state.miniMode. النافذة نفسها واحدة ولا يتم إنشاء نافذة جديدة أبدًا.
let vis = 'tray';
let exiting = false;          // بدأ الإغلاق النهائي
let finalizing = false;       // الإغلاق على وشك الاكتمال
let skipExitVoice = false;    // إغلاق بسبب shutdown/crash/إشارة نظام: بدون صوت
// أول ملف موجود فعلًا (علشان غياب icon.png ما يخلّيش الأيقونة تختفي): icon.png ثم logo.png. الـ Tray على ويندوز يفضّل .ico
const firstExisting = list => list.map(f => path.join(__dirname, 'assets', f)).find(p => { try { return fs.existsSync(p); } catch (_) { return false; } });
const ICON_PATH = firstExisting(['icon.png', 'logo.png']);
const TRAY_ICON_PATH = firstExisting(process.platform === 'win32' ? ['icon.ico', 'icon.png', 'logo.png'] : ['icon.png', 'logo.png']);

// ── Click-through مُدار من الـ main نفسه ──
// بدل setIgnoreMouseEvents(true,{forward:true}) (تمرير mousemove بيتوقف بعد hide/minimize/restore
// على ويندوز، وده سبب "الواجهة ظاهرة لكن مش بتستجيب")، الـ main بيقرأ مكان الماوس بنفسه
// ويقارنه بمستطيلات العناصر التفاعلية اللي بيبعتها الـ renderer.
let hitRects = [];
let ignoring = null;          // آخر قيمة اتضبطت (null = غير معروف)
let holding = false;          // ضغط ماوس شغّال على عنصر تفاعلي (slider مثلاً): ما نقطعش التفاعل
let hitTimer = null;
let lastInside = null;        // آخر حالة "الماوس فوق النافذة" اتبعتت للـ renderer (للشفافية عند عدم الاستخدام)
let dialCovered = false;      // المسبحة مخفية مؤقتًا (بطاقات الذكر الخفي ظاهرة مكانها): شفافة تمامًا ومش بتاخد ماوس
function setIgnore(v, force) {
  if (dialCovered) v = true;
  if (!win || win.isDestroyed() || (ignoring === v && !force)) return;
  if (ignoring !== v) dbg('setIgnoreMouseEvents', String(v));
  ignoring = v;
  win.setIgnoreMouseEvents(v);
}
function resetMouse() { ignoring = null; holding = false; setIgnore(false, true); }   // دايمًا تفاعلية بعد أي إظهار/تبديل

// ── Watchdog: لو الماوس بيتحرك فوق النافذة بعد الإظهار والـ renderer ما استقبلش أي حدث ماوس ──
let lastAlive = 0, shownAt = 0, insideSince = 0, lastCur = null, recoveries = 0, lastRecoveryAt = 0, tickN = 0;
function reviveInput(reason, grabFocus = true) {
  if (!win || win.isDestroyed() || vis !== 'shown') return;
  dbg('reviveInput', reason);
  resetMouse();
  if (grabFocus) {                                                            // الاختصار العام (Ctrl+Alt+T) ما ياخدش Focus
    win.setFocusable(true);
    win.focus();
    try { win.webContents.focus(); } catch (_) {}
  }
  const b = win.getBounds(), sz = size();
  win.setBounds({ x: b.x, y: b.y, width: sz.w + 1, height: sz.h });          // nudge: بيجبر Chromium يعيد hit-testing
  setTimeout(() => {
    if (win && !win.isDestroyed() && vis === 'shown') win.setBounds({ x: b.x, y: b.y, width: sz.w, height: sz.h });
  }, 40);
}
function watchdog(p, b) {
  const inside = p.x >= b.x && p.y >= b.y && p.x < b.x + b.width && p.y < b.y + b.height;
  const moved = !lastCur || lastCur.x !== p.x || lastCur.y !== p.y;
  lastCur = { x: p.x, y: p.y };
  if (!inside) { insideSince = 0; return; }
  const now = Date.now();
  if (!insideSince) insideSince = now;
  if (!moved || recoveries >= 2 || now - shownAt > 8000 || now - insideSince < 700 || lastAlive >= insideSince) return;
  if (now - lastRecoveryAt < 1500) return;                                    // نستنى نتيجة المحاولة السابقة
  recoveries++; lastRecoveryAt = now; insideSince = now;
  dbg('WATCHDOG: mouse moves over window but renderer got no mouse events', `attempt=${recoveries}`);
  if (recoveries === 1) reviveInput('watchdog');
  else { try { win.webContents.reload(); } catch (_) {} }                       // آخر حل: reload للصفحة (الحالة محفوظة في الـ main)
}

function hitTick() {
  if (!win || win.isDestroyed() || vis !== 'shown') return;
  if (dialCovered) { setIgnore(true); return; }
  const p = screen.getCursorScreenPoint();
  const b = win.getBounds();
  watchdog(p, b);
  const inside = holding || !!dragOrigin || (p.x >= b.x && p.y >= b.y && p.x < b.x + b.width && p.y < b.y + b.height);
  if (inside !== lastInside) { lastInside = inside; send('hover', inside); }
  if (!CLICK_THROUGH || state.miniMode || holding || dragOrigin || !hitRects.length) {
    if (++tickN % 10 === 0) setIgnore(false, true);                              // إعادة تأكيد دورية: تفاعلية
    else setIgnore(false);
    return;
  }
  const lx = p.x - b.x, ly = p.y - b.y;
  setIgnore(!hitRects.some(r => lx >= r.x && lx <= r.x + r.w && ly >= r.y && ly <= r.y + r.h));
}
function startHitTimer() { if (!hitTimer) hitTimer = setInterval(hitTick, 40); }   // timer واحد فقط
function stopHitTimer() { if (hitTimer) { clearInterval(hitTimer); hitTimer = null; } }

function createWindow() {
  const { x, y } = resolvePosition();
  const s = size();
  win = new BrowserWindow({
    x, y, width: s.w, height: s.h,
    frame: false, transparent: true, resizable: false, maximizable: false, fullscreenable: false,
    minimizable: true,
    hasShadow: false, alwaysOnTop: true,
    skipTaskbar: true,          // overlay هادي؛ بيظهر في الـ Taskbar فقط أثناء الـ Minimize
    focusable: false,           // مايسرقش الـ Focus (بيتفعّل مؤقتًا عند الـ Restore)
    show: false,
    icon: ICON_PATH,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      devTools: false,
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required'
    }
  });
  win.setMenu(null);
  win.loadFile('index.html');

  win.once('ready-to-show', () => { overlayReady = true; maybePresentOverlay(); });   // بعد شاشة اللوجو (لو شغّالة)

  // صوت "فسبحان الله": مرة واحدة بس عند بدء التشغيل
  let startupHandled = false;
  win.webContents.on('did-finish-load', () => {
    if (startupHandled) return;
    startupHandled = true;
    if (state.startupSound && audioFiles.startup) {
      setTimeout(() => send('startup:play', { volume: state.startupVolume }), 500);
    }
  });

  // Minimize من أي مصدر (زر "–" / Win+D ...): نعرضها في الـ Taskbar ونوقف الـ polling
  for (const ev of ['show', 'hide', 'focus', 'blur', 'minimize', 'restore']) win.on(ev, () => dbg('event:' + ev));
  win.on('minimize', () => {
    if (exiting || vis === 'tray') return;
    vis = 'minimized';
    stopHitTimer();
    win.setFocusable(true);
    win.setSkipTaskbar(false);
    refreshTrayMenu();
  });
  // Restore (من أيقونة الـ Taskbar) = واجهة تفاعلية بالكامل + Focus
  win.on('restore', () => { if (!exiting && vis !== 'tray') presentWindow(true); });
  // بعد ما المستخدم يسيب النافذة نرجّعها غير سارقة للـ Focus (سلوك الـ overlay الأصلي)
  win.on('blur', () => {
    setTimeout(() => {                                     // بعد ما الـ Restore يستقر، وبشرط إنها فعلًا فقدت الـ Focus
      if (vis === 'shown' && win && !win.isDestroyed() && !win.isFocused()) win.setFocusable(false);
    }, 400);
  });
  win.on('session-end', () => { skipExitVoice = true; });

  win.on('close', e => { if (!quitting) { e.preventDefault(); hideOverlay(); } });
  win.on('closed', () => { win = null; });
}

// إظهار النافذة (من الـ Tray / الـ Taskbar / أول تشغيل) وإعادتها تفاعلية بالكامل.
// بتستخدم نفس النافذة الموجودة (مفيش BrowserWindow جديدة).
function presentWindow(focus) {
  if (!win || win.isDestroyed() || exiting) return;
  if (win.isMinimized()) win.restore();
  const { x, y } = resolvePosition();                      // نفس المكان السابق (للوضع الحالي)
  const s = size();
  dbg('presentWindow', `focus=${!!focus}`);
  win.setBounds({ x, y, width: s.w, height: s.h });
  assertOnTop();
  vis = 'shown';
  shownAt = Date.now(); lastAlive = 0; insideSince = 0; lastCur = null; recoveries = 0; lastRecoveryAt = 0;
  lastInside = null;                                       // يتبعت من أول tick
  resetMouse();                                            // تفاعل فوري (setIgnoreMouseEvents(false))
  if (focus) { win.setFocusable(true); win.show(); win.focus(); }
  else { win.showInactive(); }                             // الاختصار العام: من غير ما ياخد Focus
  startHitTimer();
  // بعد ما الـ Restore يخلص فعليًا: نخفي زر الـ Taskbar (مش أثناء الـ Restore) ونتأكد إن الإدخال شغّال
  setTimeout(() => { if (win && !win.isDestroyed() && vis === 'shown') win.setSkipTaskbar(true); }, 500);
  setTimeout(() => reviveInput('after-present', !!focus), 150);
  send('overlay:shown');
  send('state', viewState());
  refreshTrayMenu();
}
const showOverlay = () => presentWindow(true);

// "–" = Minimize طبيعي إلى Windows Taskbar (مفيش destroy/close)
function minimizeOverlay() {
  dbg('click "-" → minimizeOverlay');
  if (!win || win.isDestroyed() || vis !== 'shown' || state.miniMode) return;
  dropInlineChoose();
  rememberPosition();
  stopHitTimer();
  holding = false;
  win.setFocusable(true);
  win.setSkipTaskbar(false);                               // لازم زرار الـ Taskbar يكون موجود علشان الـ Restore
  vis = 'minimized';
  setTimeout(() => { if (win && !win.isDestroyed() && vis === 'minimized' && !win.isMinimized()) win.minimize(); }, 60);
  refreshTrayMenu();
}

// Hide to Tray = مختلف تمامًا عن Minimize: النافذة مخفية، التطبيق والـ hooks يكملوا
function hideOverlay() {
  dbg('hideOverlay (tray)');
  if (!win || win.isDestroyed() || vis === 'tray') return;
  dropInlineChoose();
  rememberPosition();
  stopHitTimer();
  holding = false; dragOrigin = null;
  const wasMin = win.isMinimized();
  vis = 'tray';                                            // أولاً، علشان handler الـ 'restore' ما يعيد إظهارها
  if (wasMin) win.restore();
  win.setSkipTaskbar(true);
  win.hide();
  refreshTrayMenu();
}
const isVisible = () => vis === 'shown';
const toggleOverlay = () => (vis === 'shown' ? hideOverlay() : presentWindow(false));

// Mini Mode = نفس النافذة بحجم مصغّر (نفس الـ renderer ونفس الـ hooks؛ مفيش listeners جديدة)
function setMiniMode(on) {
  on = !!on;
  if (on === state.miniMode) return;
  if (win && !win.isDestroyed() && vis === 'shown') capturePosition();   // نحفظ مكان الوضع الحالي قبل التبديل
  dbg(on ? 'enter Mini Mode' : 'exit Mini Mode');
  state.miniMode = on;
  if (on) dropInlineChoose();
  if (win && !win.isDestroyed() && vis === 'shown') {
    const { x, y } = resolvePosition();
    const s = size();
    win.setBounds({ x, y, width: s.w, height: s.h });
    resetMouse();
  }
  refreshTrayMenu();
}

// ───────────── نافذة الإعدادات (نافذة مستقلة، بنفس التصميم) ─────────────
function openSettingsWindow(focus) {
  if (settingsWin && !settingsWin.isDestroyed()) {
    if (settingsWin.isMinimized()) settingsWin.restore();
    settingsWin.show(); settingsWin.focus();
    if (focus) sendSettings('settings:focus', focus);
    return;
  }
  const wa = screen.getPrimaryDisplay().workArea;
  const h = Math.min(SETTINGS_SIZE.h, wa.height - 40);
  const w = Math.min(SETTINGS_SIZE.w, wa.width - 40);
  settingsWin = new BrowserWindow({
    width: w, height: h,
    frame: false, transparent: true, resizable: false, maximizable: false, fullscreenable: false,
    hasShadow: false, show: false, skipTaskbar: false,
    icon: ICON_PATH,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      devTools: false, autoplayPolicy: 'no-user-gesture-required'
    }
  });
  settingsWin.setMenu(null);
  settingsWin.setAlwaysOnTop(true, 'floating');            // فوق التطبيقات، وتحت الـ overlay نفسه
  settingsWin.loadFile('settings.html', { hash: focus || '' });
  settingsWin.once('ready-to-show', () => { settingsWin.show(); settingsWin.focus(); });
  settingsWin.on('closed', () => { settingsWin = null; clearTimeout(statsTimer); statsTimer = null; cleanupSoundFiles(); });
}

let statsTimer = null;
function scheduleStats() {                                 // تحديث الإحصائيات في نافذة الإعدادات (لو مفتوحة) كل 400ms كحد أقصى
  if (!settingsWin || statsTimer) return;
  statsTimer = setTimeout(() => { statsTimer = null; sendSettings('stats', statsPayload()); }, 400);
}

// ───────────── Tray ─────────────
const trayTip = () => (state.target ? `WZAKER: ${state.count} / ${state.target}` : `WZAKER: ${state.count}`);

let tipTimer = null, tipDirty = false;
function refreshTrayTip() {
  if (!tray) return;
  if (tipTimer) { tipDirty = true; return; }
  tray.setToolTip(trayTip());
  tipTimer = setTimeout(() => { tipTimer = null; if (tipDirty) { tipDirty = false; refreshTrayTip(); } }, 250);
}

function buildTrayMenu() {
  const visible = isVisible();
  const clickPct = Math.round(state.volume * 100);
  return Menu.buildFromTemplate([
    ...(hookInfo.status === 'failed' || hookInfo.status === 'restarting'
      ? [{ label: '⚠ العدّ بالسكرول متوقف: إعادة التشغيل', click: () => { hookRetryN = 0; restartHook(true); } }, { type: 'separator' }]
      : []),
    { label: 'إظهار المسبحة', enabled: vis !== 'shown', click: showOverlay },
    { label: 'تصغير إلى شريط المهام', enabled: visible && !state.miniMode, click: minimizeOverlay },
    { label: 'إخفاء إلى الـ Tray', enabled: vis !== 'tray', click: hideOverlay },
    { type: 'separator' },
    {
      label: 'الذكر الحالي',
      submenu: allAzkar().map(a => ({
        label: a.text, type: 'radio', checked: a.id === state.dhikrId,
        click: () => applyPatch({ dhikrId: a.id })
      }))
    },
    { label: 'Mini Mode', type: 'checkbox', checked: state.miniMode, click: () => applyPatch({ miniMode: !state.miniMode }) },
    { label: 'تنبيه الأذكار', type: 'checkbox', checked: state.reminderOn, click: () => applyPatch({ reminderOn: !state.reminderOn }) },
    { label: 'تحديد عدد التسابيح…', click: () => openSettingsWindow('target') },
    { label: `الصوت: ${state.sound ? 'تشغيل' : 'إيقاف'}`, click: () => applyPatch({ sound: !state.sound }) },
    {
      label: 'مستوى صوت الكليك',
      submenu: CLICK_VOLUME_PRESETS.map(p => ({
        label: `${p}%`, type: 'radio', checked: clickPct === p,
        click: () => applyPatch({ volume: p / 100 })
      }))
    },
    {
      label: 'تشغيل صوت "فسبحان الله"', enabled: !!audioFiles.startup,
      click: () => send('startup:play', { volume: state.startupVolume, force: true })
    },
    { label: 'الإعدادات…', click: () => openSettingsWindow(null) },
    { type: 'separator' },
    { label: 'تصفير العداد', click: () => applyPatch({ count: 0, total: 0 }) },
    { type: 'separator' },
    { label: 'إغلاق البرنامج', click: () => app.quit() }
  ]);
}
let menuTimer = null;
function refreshTrayMenu() {                               // debounce: ما نعيدش بناء المنيو مع كل حركة slider
  if (!tray) return;
  clearTimeout(menuTimer);
  menuTimer = setTimeout(() => { if (tray) tray.setContextMenu(buildTrayMenu()); }, 120);
}

function createTray() {
  if (tray) return;                                        // Tray واحد فقط
  let img = TRAY_ICON_PATH ? nativeImage.createFromPath(TRAY_ICON_PATH) : nativeImage.createEmpty();
  if (!img.isEmpty() && !/\.ico$/i.test(TRAY_ICON_PATH)) img = img.resize({ width: 32, height: 32 });   // أيقونة الـ Tray صغيرة (الصور الكبيرة بتظهر فاضية أحيانًا)
  tray = new Tray(img);
  tray.setToolTip(trayTip());
  tray.setContextMenu(buildTrayMenu());                    // كليك يمين = المنيو
  tray.on('click', showOverlay);                           // كليك يسار = إظهار/استعادة في مكانها السابق
}

// ───────────── العدّاد (مشترك بين Scroll و Space) ─────────────
function registerTick() {
  if (challenge) { registerChallengeTick(); return; }      // أثناء التحدي: العدّ للتحدي فقط (مش للدورة الحالية)
  state.count += 1;                                        // 1) العدّاد يزيد فورًا
  state.total += 1;
  const st = state.stats[state.dhikrId] || (state.stats[state.dhikrId] = { n: 0, last: 0 });
  st.n += 1;                                               // إحصائية الذكر
  st.last = Date.now();
  bumpDaily(state.dhikrId);

  const shown = tickState();                               // الشكل قبل الدوران (لأنيميشن الاكتمال)
  let completed = false;
  if (state.target && state.count >= state.target) {       // وصلنا للهدف: دورة جديدة تلقائيًا (Completion مرة واحدة)
    completed = true;
    state.cycles += 1;
    state.count = 0;
    if (state.autoAdvance) { state.dhikrId = nextDhikrId(); refreshTrayMenu(); }
  }
  send('tick', { completed, shown, state: tickState() }); // 2) تحديث الـ UI (الصوت في الـ renderer بدون انتظار)
  scheduleStats();
  refreshTrayTip();
  checkAch(false);
  saveStateSoon();
}

// حركة السكرول الواحدة (حتى لو العجلة/الماوس بيبعتوا أحداث كتير) = تسبيحة واحدة.
// الحركة بتنتهي فقط لما يعدّي WHEEL_GESTURE_GAP_MS من غير أي حدث (وقفة حقيقية).
// عكس الاتجاه (فوق/تحت بسرعة) مش بيبدأ حركة جديدة، وفيه كمان حد أدنى بين تسبيحتين (WHEEL_MIN_TICK_GAP_MS).
let lastWheelAt = 0, lastWheelTickAt = 0;
function onWheel(e) {
  if (!state.scrollOn) return;                             // التسبيح بالسكرول متعطّل من الإعدادات
  if (e && e.direction === 4) return;                      // سكرول أفقي (HORIZONTAL) مش تسبيح
  if (settingsFocused()) return;                           // سكرول جوه نافذة الإعدادات نفسها مش تسبيح
  const now = Date.now();
  const sameGesture = (now - lastWheelAt) < WHEEL_GESTURE_GAP_MS;
  lastWheelAt = now;                                       // كل حدث بيمدّد الحركة الحالية
  if (sameGesture) return;                                 // نفس الحركة: اتعدّت قبل كده
  if (now - lastWheelTickAt < WHEEL_MIN_TICK_GAP_MS) return; // سريع جدًا ورا تسبيحة سابقة: تجاهل
  lastWheelTickAt = now;
  registerTick();
}

// تعديلات الواجهة/المنيو (مع التحقق من القيم)
const azRearm = new Set(); let azRearmTimer = null;
function applyPatch(p = {}) {
  const num = (v, min, max) => (Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : null);
  let v;
  if ((v = num(p.count, 0, 1e9)) !== null) state.count = Math.floor(v);
  if ((v = num(p.total, 0, 1e12)) !== null) state.total = Math.floor(v);
  if (typeof p.dhikrId === 'string') selectDhikr(p.dhikrId);
  if ('target' in p) {
    if (p.target === null) state.target = null;
    else if ((v = num(p.target, 1, MAX_TARGET)) !== null) state.target = Math.floor(v);
  }
  if ((v = num(p.volume, 0, 1)) !== null) state.volume = v;
  if ((v = num(p.startupVolume, 0, 1)) !== null) state.startupVolume = v;
  if ((v = num(p.completionVolume, 0, 1)) !== null) state.completionVolume = v;
  if ((v = num(p.exitVolume, 0, 1)) !== null) state.exitVolume = v;
  if ((v = num(p.miniOpacity, 0.2, 1)) !== null) state.miniOpacity = v;
  if ((v = num(p.idleOpacity, IDLE_OPACITY_MIN, 1)) !== null) state.idleOpacity = v;
  if ((v = num(p.popupVolume, 0, 1)) !== null) state.popupVolume = v;
  if ((v = num(p.reminderVolume, 0, 1)) !== null) state.reminderVolume = v;
  const before = { rOn: state.reminderOn, rEvery: state.reminderEvery, cOn: state.challengeOn, cEvery: state.challengeEvery };
  if ((v = num(p.reminderEvery, INTERVAL_MIN, INTERVAL_MAX)) !== null) state.reminderEvery = Math.floor(v);
  if ((v = num(p.challengeEvery, INTERVAL_MIN, INTERVAL_MAX)) !== null) state.challengeEvery = Math.floor(v);
  for (const k of ['reminderOn', 'challengeOn']) if (typeof p[k] === 'boolean') state[k] = p[k];
  // إعادة ضبط المؤقت فقط لو الإعداد الخاص به اتغيّر (تحريك سلايدر الصوت ما يصفّرش العدّ)
  if (before.rOn !== state.reminderOn || before.rEvery !== state.reminderEvery) armTimer('reminder');
  if (before.rOn !== state.reminderOn || before.cOn !== state.challengeOn || before.cEvery !== state.challengeEvery) armTimer('challenge');
  for (const k of ['sound', 'startupSound', 'completionSound', 'exitSound', 'autoAdvance', 'reminderSound']) {
    if (typeof p[k] === 'boolean') state[k] = p[k];
  }
  if (typeof p.dndFullscreen === 'boolean' && p.dndFullscreen !== state.dndFullscreen) {
    state.dndFullscreen = p.dndFullscreen; syncDndWatch();
    if (!state.dndFullscreen) pumpQueue(500);                // اتقفل: أي إشعار كان مستني يظهر
  }
  if (typeof p.spaceKey === 'boolean') { state.spaceKey = p.spaceKey; syncKeyHook(); }
  if (typeof p.customKeyOn === 'boolean') { state.customKeyOn = p.customKeyOn && !!state.customKey; syncKeyHook(); }
  if (typeof p.hotkeyClear === 'string' && HOTKEY_ACTIONS.includes(p.hotkeyClear)) { state.hotkeys[p.hotkeyClear] = null; syncKeyHook(); }
  if (p.customKeyClear === true) { state.customKey = null; state.customKeyOn = false; syncKeyHook(); }
  if (typeof p.dialLocked === 'boolean') state.dialLocked = p.dialLocked;
  if (p.dialLayout && typeof p.dialLayout === 'object') { state.dialLayout = sanitizeLayout(p.dialLayout); refitDialWindow(); }
  if (typeof p.builtinVerses === 'boolean') state.builtinVerses = p.builtinVerses;
  if (typeof p.popupPos === 'string' && POPUP_POS_VERSE.includes(p.popupPos) && (p.popupPos !== 'saved' || state.px !== null)) {
    state.popupPos = p.popupPos;
    if (popup && popup.kind === 'verse') { popupMoved = false; popupReplace(); }     // لو الإشعار ظاهر دلوقتي ينتقل للمكان الجديد فورًا
  }
  if (typeof p.cardsPos === 'string' && POPUP_POS_CARDS.includes(p.cardsPos) && (p.cardsPos !== 'saved' || state.cx !== null)) {
    state.cardsPos = p.cardsPos;
    if (popup && popup.kind === 'cards') { popupMoved = false; popupReplace(); }
  }
  if ((v = num(p.popupScale, SCALE_MIN, SCALE_MAX)) !== null) { state.popupScale = Math.round(v * 100) / 100; if (popup && popup.kind === 'verse') popupReplace(true); }
  if ((v = num(p.cardsScale, SCALE_MIN, SCALE_MAX)) !== null) { state.cardsScale = Math.round(v * 100) / 100; if (popup && popup.kind === 'cards') popupReplace(true); }
  if (p.azMark && typeof p.azMark === 'object') {          // علامة صح على ذكر (صباح 'm' / مساء 'e')
    const { t, i, on } = p.azMark;
    if (AZ_KEYS.includes(t) && Number.isInteger(i) && i >= 0 && i < AZ[t].length) {
      const d = dailyAz(), set = new Set(d[t]);
      if (on === false) set.delete(i); else set.add(i);
      d[t] = [...set].sort((a, b) => a - b);
    }
  }
  if (AZ_KEYS.includes(p.azReset)) dailyAz()[p.azReset] = [];
  for (const k of ['prayerAlert', 'prayerSound']) if (typeof p[k] === 'boolean') state[k] = p[k];
  if ((v = num(p.prayerVolume, 0, 1)) !== null) state.prayerVolume = v;
  if (p.prayerOn && typeof p.prayerOn === 'object') for (const k of PRAYER_KEYS) if (typeof p.prayerOn[k] === 'boolean') state.prayerOn[k] = p.prayerOn[k];
  if (typeof p.prayerCity === 'string' && (p.prayerCity === 'auto' || PRAYER_CITIES[p.prayerCity])) { state.prayerCity = p.prayerCity; prayerCache = null; if (p.prayerCity === 'auto') prayerLocate(); }
  if (typeof p.autoUpdateOn === 'boolean') { state.autoUpdateOn = p.autoUpdateOn; if (autoUpdater) autoUpdater.autoInstallOnAppQuit = p.autoUpdateOn; if (p.autoUpdateOn) updCheck(); }
  if (typeof p.autoBackup === 'boolean') state.autoBackup = p.autoBackup;
  if (p.updCheck === true) updCheck(true);
  if (p.hookRestart === true) { hookRetryN = 0; restartHook(true); }
  if (p.updInstall === true) updInstall();
  if (p.prayerLocate === true) { state.prayerCity = 'auto'; prayerCache = null; prayerLocate(); }
  if (p.prayerAlert === true && state.prayerCity === 'auto' && state.prayerLat === null) prayerLocate();
  const prevAt = { m: state.sabahAt, e: state.masaaAt, w: state.wirdAt, sl: state.sleepAt, wk: state.wakeAt };
  const prevOn = { m: state.sabahAlert, e: state.masaaAlert, w: state.wirdAlert, sl: state.sleepAlert, wk: state.wakeAlert };
  for (const k of ['sabahAlert', 'masaaAlert', 'sleepAlert', 'wakeAlert', 'azSound', 'wirdAlert', 'wirdSound']) if (typeof p[k] === 'boolean') state[k] = p[k];
  if ((v = num(p.azVolume, 0, 1)) !== null) state.azVolume = v;
  if ((v = num(p.wirdVolume, 0, 1)) !== null) state.wirdVolume = v;
  if (typeof p.wirdAt === 'string' && TIME_RE.test(p.wirdAt)) state.wirdAt = p.wirdAt;
  if (typeof p.wirdDone === 'boolean') dailyAz().wd = p.wirdDone;                // ضغطة على أيقونة المصحف = تم الورد النهاردة
  // المستخدم فعّل التنبيه أو غيّر ميعاده = يتحسب من جديد (لو الميعاد عدّى النهاردة يظهر فورًا مرة واحدة).
  // الانتظار 1.2 ثانية بعد آخر تعديل: حقل الوقت بيبعت تغيير مع كل خانة بيتعدّل (ساعة ثم دقيقة)، فبدون الانتظار كان الإشعار يظهر أكتر من مرة وانت لسه بتضبط.
  const touch = (key, flag, on, next) => {
    const turnedOn = on === true && !prevOn[key];
    const timeChanged = typeof next === 'string' && TIME_RE.test(next) && next !== prevAt[key];
    if (turnedOn || timeChanged) azRearm.add(flag);
  };
  touch('m', 'mf', p.sabahAlert, p.sabahAt); touch('e', 'ef', p.masaaAlert, p.masaaAt); touch('w', 'wf', p.wirdAlert, p.wirdAt);
  touch('sl', 'slf', p.sleepAlert, p.sleepAt); touch('wk', 'wkf', p.wakeAlert, p.wakeAt);
  if (azRearm.size) {
    clearTimeout(azRearmTimer);
    azRearmTimer = setTimeout(() => {
      const d = dailyAz();
      azRearm.forEach(f => {
        d[f] = false;
        if (f === 'wf') d.wd = false;                              // ضغطت على المصحف قبل كده النهاردة؟ تفعيل/تغيير الميعاد بيرجّع الورد
        if (f === 'mf' && d.m.length >= AZ.m.length) d.m = [];
        if (f === 'ef' && d.e.length >= AZ.e.length) d.e = [];
        if (f === 'slf' && d.sl.length >= AZ.sl.length) d.sl = [];
        if (f === 'wkf' && d.wk.length >= AZ.wk.length) d.wk = [];
      });
      azRearm.clear(); saveStateSoon(); azCheck();
    }, 1200);
  }
  if (!azRearm.size) setTimeout(azCheck, 300);              // لو فيه تعديل توقيت لسه مستني الـ 1.2 ثانية: ما نفحصش بتوقيت نص-مضبوط (ساعة اتغيّرت والدقيقة لسه) وإلا الإشعار يظهر بدري ويتكرر
  for (const k of ['sabahAt', 'masaaAt', 'sabahEnd', 'masaaEnd', 'sleepAt', 'sleepEnd', 'wakeAt', 'wakeEnd']) if (typeof p[k] === 'string' && TIME_RE.test(p[k])) state[k] = p[k];
  updateDialCover();
  if (typeof p.scrollOn === 'boolean') state.scrollOn = p.scrollOn;
  if (typeof p.clickOn === 'boolean') state.clickOn = p.clickOn;
  if (p.dialStyle === 'ring' || p.dialStyle === 'beads' || p.dialStyle === 'strand') state.dialStyle = p.dialStyle;
  if (typeof p.beadGlow === 'boolean') state.beadGlow = p.beadGlow;
  if (Number.isFinite(p.beadLight)) state.beadLight = Math.min(1, Math.max(0, p.beadLight));
  if (typeof p.autoLaunch === 'boolean') { state.autoLaunch = p.autoLaunch; applyAutoLaunch(state.autoLaunch); }
  if (typeof p.miniMode === 'boolean') setMiniMode(p.miniMode);
  broadcastState();
  refreshTrayTip();
  refreshTrayMenu();
  saveStateSoon();
}

// ───────────── Global Hooks ─────────────
let uIOhook = null;
let SPACE_KEYCODE = 57;
let hookStarted = false;

// حالة الـ hook (بتظهر في الإعدادات والـ Tray): off | ok | restarting | failed
const hookInfo = { status: 'off', restarts: 0, error: '' };
function setHookStatus(status, error) {
  error = error || '';
  if (hookInfo.status === status && hookInfo.error === error) return;
  hookInfo.status = status; hookInfo.error = error;
  try { broadcastState(); refreshTrayMenu(); } catch (_) {}
  if (tray) { try { tray.setToolTip(status === 'ok' || status === 'off' ? trayTip() : trayTip() + ' — العدّ بالسكرول متوقف'); } catch (_) {} }
}

function startHook() {
  if (hookStarted) return;                                 // مستحيل يتسجل مرتين
  try {
    const mod = require('uiohook-napi');
    uIOhook = mod.uIOhook;
    if (mod.UiohookKey && mod.UiohookKey.Space) SPACE_KEYCODE = mod.UiohookKey.Space;
    uIOhook.removeListener('wheel', onWheel);              // لو محاولة سابقة فشلت بعد التسجيل: ما يتسجلش مرتين
    uIOhook.on('wheel', onWheel);                          // event-based (بدون polling)
    uIOhook.start();
    hookStarted = true;
    setHookStatus('ok');
    setSpaceHook(state.spaceKey);
    installHookRecovery();
  } catch (err) {
    const msg = String((err && err.message) || err || '');
    dbg('hook start failed: ' + msg);
    setHookStatus('failed', msg);
    // غير حاجز: الإقلاع يكمل، والمستخدم يقدر يعيد المحاولة من الرسالة أو الـ Tray أو الإعدادات
    dialog.showMessageBox({
      type: 'error', title: 'تعذّر تشغيل العدّ بالسكرول',
      message: 'مكتبة uiohook-napi لم تعمل، فالتسبيح بعجلة الماوس متوقف.',
      detail: msg + '\n\nممكن تعيد المحاولة، أو تكمل والبرنامج هيشتغل بالنقر/الكيبورد.',
      buttons: ['إعادة المحاولة', 'متابعة'], defaultId: 0, cancelId: 1, noLink: true
    }).then(r => { if (r.response === 0) { hookRetryN = 0; restartHook(true); } }).catch(() => {});
  }
}

// أزرار التسبيح من الكيبورد (Space + الزر/الاختصار المخصص): الـ listeners بتتسجل بس لما أي خيار منهم يتفعّل
// (أو أثناء تسجيل زر جديد من الإعدادات)، وبتتشال تمامًا لما كلهم يتعطّلوا.
// (ملحوظة: uiohook بيستخدم hook واحد للماوس والكيبورد علشان الـ Scroll، لكن لما مفيش خيار شغّال
//  مفيش أي كود عندنا بيقرأ الأزرار، ومفيش أي منع للأزرار في البرامج التانية.)
let spaceHooked = false;
const downKeys = new Set();                                // الأزرار المضغوطة حاليًا (key repeat = ضغطة واحدة)
let capturingKey = false, captureTimer = null, captureTarget = 'custom';
const HOTKEY_ACTIONS = ['quit', 'mini', 'show', 'settings'];
const anyHotkey = () => HOTKEY_ACTIONS.some(a => !!state.hotkeys[a]);
const sameKey = (o, k) => !!o && o.code === k.code && o.ctrl === k.ctrl && o.alt === k.alt && o.shift === k.shift && o.meta === k.meta;
function runHotkey(a) {
  if (a === 'quit') app.quit();
  else if (a === 'mini') applyPatch({ miniMode: !state.miniMode });
  else if (a === 'show') toggleOverlay();
  else if (a === 'settings') openSettingsWindow(true);
}
const MOD_CODES = new Set();                               // أكواد Ctrl/Shift/Alt/Meta (تتملي من UiohookKey)
let KEY_NAMES = null;                                      // keycode → اسم (F8, A, Numpad5 ...)
function keyName(code) {
  if (!KEY_NAMES) {
    KEY_NAMES = {};
    try {
      const K = require('uiohook-napi').UiohookKey;
      for (const [n, c] of Object.entries(K)) if (!(c in KEY_NAMES)) KEY_NAMES[c] = n;
      for (const n of ['Ctrl', 'CtrlRight', 'Alt', 'AltRight', 'Shift', 'ShiftRight', 'Meta', 'MetaRight']) if (K[n]) MOD_CODES.add(K[n]);
    } catch (_) {}
  }
  return KEY_NAMES[code] || ('Key' + code);
}
function keyLabel(k) {
  return [k.ctrl && 'Ctrl', k.alt && 'Alt', k.shift && 'Shift', k.meta && 'Win', keyName(k.code)].filter(Boolean).join(' + ');
}
function stopCapture(cancelled) {
  clearTimeout(captureTimer); captureTimer = null;
  if (!capturingKey) return;
  capturingKey = false;
  syncKeyHook();
  if (cancelled) sendSettings('key:captured', { cancel: true });
}
function onKeyDown(e) {
  if (capturingKey) {                                      // وضع تسجيل زر جديد (من الإعدادات): أول زر حقيقي يتضغط
    keyName(e.keycode);
    if (MOD_CODES.has(e.keycode)) return;                  // Ctrl/Shift/Alt/Win لوحدهم: نستنى الزر الأساسي
    if (e.keycode === 1) return stopCapture(true);         // Esc = إلغاء
    const k = sanitizeKey({ code: e.keycode, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, meta: e.metaKey, name: '' });
    k.name = keyLabel(k);
    downKeys.add(e.keycode);                               // الضغطة دي للتسجيل مش للعدّ
    const tgt = captureTarget;
    const used = (tgt !== 'custom' && sameKey(state.customKey, k)) || HOTKEY_ACTIONS.some(a => a !== tgt && sameKey(state.hotkeys[a], k));
    if (used) { stopCapture(false); sendSettings('key:captured', { error: 'الاختصار ده مستخدم في حاجة تانية' }); return; }
    if (tgt !== 'custom') {                                // اختصار أمر (قفل/تصغير/...): لازم Ctrl/Alt/Shift/Win علشان ما يتنفذش بالغلط وإنت بتكتب
      const hasMod = e.ctrlKey || e.altKey || e.shiftKey || e.metaKey, isF = /^F\d+$/.test(keyName(e.keycode));
      if (!(hasMod || (isF && tgt !== 'quit'))) { stopCapture(false); sendSettings('key:captured', { error: tgt === 'quit' ? 'لازم تضغط Ctrl أو Alt أو Shift مع الزر' : 'اضغط Ctrl أو Alt أو Shift مع الزر (أو زر F1…F12)' }); return; }
      state.hotkeys[tgt] = k;
    } else { state.customKey = k; state.customKeyOn = true; }
    stopCapture(false);
    saveStateSoon(); broadcastState();
    sendSettings('key:captured', { name: k.name });
    return;
  }
  if (downKeys.has(e.keycode)) return;                     // key repeat: نفس الضغطة المستمرة = مرة واحدة فقط
  downKeys.add(e.keycode);
  const hkAct = HOTKEY_ACTIONS.find(a => { const k = state.hotkeys[a]; return k && e.keycode === k.code && !!e.ctrlKey === k.ctrl && !!e.altKey === k.alt && !!e.shiftKey === k.shift && !!e.metaKey === k.meta; });
  if (hkAct) { runHotkey(hkAct); return; }
  let hit = false;
  if (state.spaceKey && e.keycode === SPACE_KEYCODE && !(e.altKey || e.ctrlKey || e.metaKey)) hit = true;   // مش بنعد Win+Space / Ctrl+Space / Alt+Space
  const ck = state.customKey;
  if (!hit && state.customKeyOn && ck && e.keycode === ck.code &&
      !!e.ctrlKey === ck.ctrl && !!e.altKey === ck.alt && !!e.shiftKey === ck.shift && !!e.metaKey === ck.meta) hit = true;
  if (!hit) return;
  if (settingsFocused()) return;                           // الكتابة جوه نافذة الإعدادات مش تسبيح
  registerTick();
}
function onKeyUp(e) { downKeys.delete(e.keycode); }
const keyHookNeeded = () => state.spaceKey || (state.customKeyOn && !!state.customKey) || anyHotkey() || capturingKey;
function syncKeyHook() {
  if (!uIOhook || !hookStarted) return;
  const on = keyHookNeeded();
  if (on && !spaceHooked) {
    downKeys.clear();
    uIOhook.on('keydown', onKeyDown);
    uIOhook.on('keyup', onKeyUp);
    spaceHooked = true;
  } else if (!on && spaceHooked) {
    uIOhook.removeListener('keydown', onKeyDown);
    uIOhook.removeListener('keyup', onKeyUp);
    spaceHooked = false;
    downKeys.clear();
  }
}
const setSpaceHook = () => syncKeyHook();                  // (اسم قديم: بيستخدمه بدء التشغيل)

// ───── التشغيل مع ويندوز ─────
function applyAutoLaunch(on) {
  if (!app.isPackaged) return;                             // في وضع التطوير هيسجّل electron.exe نفسه: نتجاهله
  try { app.setLoginItemSettings({ openAtLogin: !!on, path: process.execPath }); } catch (err) { dbg('autoLaunch: ' + (err && err.message)); }
}
function syncAutoLaunch() {
  if (!app.isPackaged) return;
  try {
    const actual = app.getLoginItemSettings().openAtLogin;
    if (actual !== state.autoLaunch) applyAutoLaunch(state.autoLaunch);   // الإعداد المحفوظ هو المرجع
  } catch (_) {}
}

// ───── استعادة الـ Hook ─────
// ويندوز بيشيل الـ low-level hook بصمت لو الجهاز اتزحم (لعبة تقيلة) أو بعد sleep/قفل الشاشة/تغيير الدقة.
// فبنعيد تثبيته في الحالات دي بدل ما العدّ يقف.
let hookRestartAt = 0, hookRecoveryInstalled = false, hookRetryTimer = null, hookRetryN = 0;
const HOOK_RETRY_MS = [3000, 10000, 30000];                // لو إعادة التشغيل فشلت: نحاول تاني 3 مرات بعدها نعرض "متوقف"
function restartHook(manual) {
  if (exiting) return;
  if (!hookStarted || !uIOhook) { if (manual === true) startHook(); return; }   // الـ hook ما اشتغلش أصلًا: إعادة المحاولة يدويًا بس
  const now = Date.now();
  if (manual !== true && now - hookRestartAt < 2000) return;   // مفيش إعادة تشغيل متكررة
  hookRestartAt = now;
  clearTimeout(hookRetryTimer); hookRetryTimer = null;
  try { uIOhook.stop(); } catch (_) {}
  try {
    uIOhook.start();
    hookInfo.restarts++; hookRetryN = 0;
    dbg('hook restarted'); setHookStatus('ok');
  } catch (err) {
    const msg = String((err && err.message) || err || '');
    dbg('hook restart failed: ' + msg);
    const wait = HOOK_RETRY_MS[hookRetryN++];
    if (wait) { setHookStatus('restarting', msg); hookRetryTimer = setTimeout(() => { hookRetryTimer = null; restartHook(true); }, wait); }
    else { hookRetryN = 0; setHookStatus('failed', msg); }
  }
}
function installHookRecovery() {
  if (hookRecoveryInstalled) return;
  hookRecoveryInstalled = true;
  try {
    const { powerMonitor } = require('electron');
    powerMonitor.on('resume', () => setTimeout(restartHook, 1500));
    powerMonitor.on('unlock-screen', () => setTimeout(restartHook, 500));
  } catch (_) {}
  try {
    for (const ev of ['display-metrics-changed', 'display-added', 'display-removed']) screen.on(ev, () => setTimeout(restartHook, 1500));   // الألعاب بتغيّر الدقة
  } catch (_) {}
}

function stopHook() {
  if (!hookStarted || !uIOhook) return;
  hookStarted = false; spaceHooked = false; spaceDown = false;
  clearTimeout(hookRetryTimer); hookRetryTimer = null; hookInfo.status = 'off';
  try { uIOhook.removeAllListeners(); uIOhook.stop(); } catch (_) {}
}


// ───────────── شاشة اللوجو عند بدء التشغيل ─────────────
let splashWin = null, splashTimer = null;
let splashHold = true;        // الدايل ينتظر بداية الـ Fade Out بتاع اللوجو
let overlayReady = false;
let splashReady = false, startupPending = false, splashGoSent = false;
function trySplashGo() {                                   // الـ Fade Out بيبدأ بعد (إنميشن اللوجو + صوت التشغيل) مع بعض
  if (splashGoSent || !splashReady || startupPending) return;
  if (!splashWin || splashWin.isDestroyed()) return;
  splashGoSent = true;
  try { splashWin.webContents.send('splash:go'); } catch (_) {}
}
let earlyPresent = false, startupPresented = false;      // المسبحة بتظهر قبل نهاية صوت البداية (من غير ما تستنى اللوجو يختفي)
function maybePresentOverlay() {
  if (startupPresented || !overlayReady || (splashHold && !earlyPresent)) return;
  startupPresented = true;                                 // مرة واحدة بس في مسار بدء التشغيل
  presentWindow(false);
}
function endSplash() {
  clearTimeout(splashTimer); splashTimer = null;
  splashHold = false;
  if (splashWin && !splashWin.isDestroyed()) splashWin.destroy();
  splashWin = null;
  maybePresentOverlay();
}
function createSplash() {
  try {
    startupPending = !!(state.startupSound && audioFiles.startup);      // لو الصوت شغّال: اللوجو يستنّاه
    if (startupPending) setTimeout(() => { startupPending = false; trySplashGo(); }, 8000);   // شبكة أمان
    const wa = screen.getPrimaryDisplay().workArea;
    const W = 640, H = 420;
    splashWin = new BrowserWindow({
      width: W, height: H,
      x: Math.round(wa.x + (wa.width - W) / 2), y: Math.round(wa.y + (wa.height - H) / 2),
      frame: false, transparent: true, resizable: false, maximizable: false, minimizable: false, fullscreenable: false,
      hasShadow: false, alwaysOnTop: true, skipTaskbar: true, focusable: false, show: false,
      icon: ICON_PATH, backgroundColor: '#00000000',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true, nodeIntegration: false, sandbox: true, devTools: false,
        backgroundThrottling: false
      }
    });
    splashWin.setMenu(null);
    splashWin.setAlwaysOnTop(true, 'screen-saver');
    splashWin.setIgnoreMouseEvents(true);                  // اللوجو مجرد عرض: ما يعطّلش أي ضغطة
    splashWin.loadFile('splash.html');
    splashWin.once('ready-to-show', () => { if (splashWin && !splashWin.isDestroyed()) splashWin.showInactive(); });
    splashWin.on('closed', () => { splashWin = null; });
    splashTimer = setTimeout(endSplash, 11000);            // شبكة أمان: الدايل لازم يظهر في كل الأحوال
  } catch (_) { splashHold = false; }
}

// ───────────── تنبيه الأذكار المنبثق + التحدي ─────────────
const POPUP_KIND = { reminder: 'verse', challenge: 'cards' };

// ───────────── طابور الإشعارات ─────────────
// أي إشعار (أذكار صباح/مساء/ورد/تذكير/تحدي) بيدخل الطابور بدل ما يتفتح فوق التاني أو يتضيع.
// الإشعار الجاي بيستنى اللي ظاهر يخلص ويتقفل، وبعدين فاصل صغير، وبعدها يظهر (الأهم الأول، ولو نفس الأهمية بالترتيب).
const popupQueue = [];                                   // { key, prio, run() }
const QUEUE_GAP_MS = 1500;                               // فاصل بين إشعار وإشعار (النافذة اللي قبلها تتقفل بالكامل الأول)
let queueTimer = null, lastPopupClosedAt = 0;
function pumpQueue(delay) {
  clearTimeout(queueTimer);
  queueTimer = setTimeout(runQueue, Math.max(0, delay || 0));
}
function enqueuePopup(job) {
  if (exiting || popupQueue.some(j => j.key === job.key)) return;   // نفس الإشعار مستني بالفعل: مفيش تكرار
  popupQueue.push(job);
  popupQueue.sort((a, b) => a.prio - b.prio);            // sort ثابت: نفس الأهمية = بالترتيب اللي دخلوا بيه
  pumpQueue(0);
}
function runQueue() {
  queueTimer = null;
  if (exiting || !popupQueue.length) return;
  if (popup || challenge) return;                        // فيه إشعار ظاهر: closePopup هيكمل الطابور لما يتقفل
  if (dndActive()) return;                               // برنامج بملء الشاشة: الإشعارات تستنى في الطابور (setDndBusy بيكمّلها لما نخرج)
  const wait = lastPopupClosedAt + QUEUE_GAP_MS - Date.now();
  if (wait > 0) return pumpQueue(wait);
  const job = popupQueue.shift();
  let shown = false;
  try { shown = !!job.run(); } catch (err) { console.error('popup queue:', err); }
  if (!shown && popupQueue.length) pumpQueue(0);         // الإشعار ده ما بقاش مطلوب: ننتقل للي بعده فورًا
}

// ───────────── عدم الإزعاج تلقائي أثناء ملء الشاشة ─────────────
// ويندوز بيقول لأي برنامج لو فيه تطبيق بملء الشاشة (SHQueryUserNotificationState): 2 = شاشة كاملة/مشغول | 3 = لعبة D3D كاملة | 4 = وضع العرض التقديمي.
// بنشغّل PowerShell واحد مخفي (بس لما الخيار يكون مفعّل) بيسأل كل ثانيتين ويكتب الرقم لما يتغيّر. أثناء ده الإشعارات بتستنى في الطابور
// ومش بتتشال: بتظهر بالترتيب بعد ما نخرج من ملء الشاشة. المسبحة والعدّ مش بيتأثروا. لو PowerShell مش متاح: الخيار ببساطة ما بيعملش حاجة.
let dndProc = null, dndBusy = false, dndBuf = '';
const dndActive = () => !!state.dndFullscreen && dndBusy;
function setDndBusy(b) {
  if (dndBusy === b) return;
  dndBusy = b;
  dbg('dnd', b ? 'fullscreen: alerts held' : 'fullscreen ended');
  if (!b) pumpQueue(2500);                                 // خرجنا من ملء الشاشة: اللي استنّى يظهر بعد لحظة
  sendSettings('state', publicState());
}
function startDndWatch() {
  if (dndProc || process.platform !== 'win32' || !state.dndFullscreen || exiting) return;
  const script = [
    "$ErrorActionPreference = 'SilentlyContinue'",
    `$pp = ${process.pid}`,
    "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class WzQ { [DllImport(\"shell32.dll\")] public static extern int SHQueryUserNotificationState(out int state); }'",
    "$last = -1",
    "while ($true) {",
    "  if (-not (Get-Process -Id $pp)) { exit }",               // التطبيق اتقفل (حتى لو بعطل): نقفل معاه
    "  $s = 0; [void][WzQ]::SHQueryUserNotificationState([ref]$s)",
    "  if ($s -ne $last) { $last = $s; [Console]::Out.WriteLine($s); [Console]::Out.Flush() }",
    "  Start-Sleep -Milliseconds 2000",
    "}"
  ].join('\n');
  try {
    const p = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    dndProc = p; dndBuf = '';
    p.stdout.setEncoding('utf8');
    p.stdout.on('data', chunk => {
      dndBuf += chunk;
      let i;
      while ((i = dndBuf.indexOf('\n')) >= 0) {
        const n = parseInt(dndBuf.slice(0, i).trim(), 10); dndBuf = dndBuf.slice(i + 1);
        if (Number.isFinite(n) && dndProc === p) setDndBusy(n === 2 || n === 3 || n === 4);
      }
    });
    const gone = () => { if (dndProc === p) { dndProc = null; setDndBusy(false); } };
    p.on('exit', gone); p.on('error', gone);
  } catch (_) { dndProc = null; }
}
function stopDndWatch() {
  const p = dndProc; dndProc = null; dndBuf = '';
  if (p) { try { p.kill(); } catch (_) {} }
  setDndBusy(false);
}
const syncDndWatch = () => (state.dndFullscreen ? startDndWatch() : stopDndWatch());

// مؤقت كل نوع لوحده: العدّ التنازلي بيبدأ بعد ما إشعار النوع ده يتقفل (فيه فاصل حقيقي بين الإشعارات)
function armTimer(kind) {
  clearTimeout(popupTimers[kind]); popupTimers[kind] = null;
  if (exiting || !state.reminderOn) return;
  if (kind === 'challenge' && !state.challengeOn) return;
  if (popup && popup.kind === POPUP_KIND[kind]) return;    // هيتظبط لما الإشعار الحالي يتقفل
  if (popupQueue.some(j => j.key === kind)) return;        // نفس النوع مستني في الطابور: ما نعدّش من جديد
  const sec = kind === 'reminder' ? state.reminderEvery : state.challengeEvery;
  popupTimers[kind] = setTimeout(() => fireTimer(kind), sec * 1000);
}
function fireTimer(kind) {
  popupTimers[kind] = null;
  if (exiting) return;
  enqueuePopup({                                           // مشغول؟ بيستنى في الطابور بدل ما يتأجل أو يضيع
    key: kind, prio: kind === 'reminder' ? 10 : 11,
    run: () => {
      if (exiting || !state.reminderOn || (kind === 'challenge' && !state.challengeOn)) return false;
      return showPopup(POPUP_KIND[kind]);
    }
  });
}

const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
function pickCards() {                                     // 3 أذكار مختلفة عشوائيًا، ولكل واحد عدد عشوائي (2..33)
  const pool = allAzkar().slice();
  for (let i = pool.length - 1; i > 0; i--) { const j = randInt(0, i); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const three = pool.slice(0, 3);
  while (three.length < 3) three.push(pool[randInt(0, pool.length - 1)] || DEFAULT_AZKAR[0]);
  return three.map(a => ({ id: a.id, text: a.text, need: randInt(CARD_MIN, CARD_MAX) }));
}

// اختيار محتوى إشعار التذكير: آيتين التطبيق + التنبيهات المخصصة المفعّلة (بنفس الفرصة لكل واحد)
function pickVerse() {
  const customs = state.customAlerts.filter(a => a.enabled);
  const pool = [];
  if (state.builtinVerses || !customs.length) pool.push({ verse: 0 }, { verse: 1 });   // مفيش مخصص مفعّل = الآيات الافتراضية (علشان التذكير ما يتحولش لإشعار فاضي)
  for (const a of customs) pool.push({ verse: 0, custom: { text: a.text, src: soundSrc(a.sound) } });
  return pool[randInt(0, pool.length - 1)];
}


// ───────────── أذكار الصباح والمساء (بتوقيت الجهاز) ─────────────
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const pad2 = n => String(n).padStart(2, '0');
const todayKey = () => { const d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
const AZ_KEYS = ['m', 'e', 'sl', 'wk', 'mq', 'pr', 'wu'];     // صباح، مساء، نوم، استيقاظ، مسجد، صلاة، وضوء
function dailyAz() {                                       // اليوم الجديد = تقدّم جديد من الصفر
  const t = todayKey(), d = state.dailyAz;
  if (!d || d.d !== t) state.dailyAz = { d: t, m: [], e: [], sl: [], wk: [], mq: [], pr: [], wu: [], mf: false, ef: false, slf: false, wkf: false, wd: false, wf: false };
  for (const k of AZ_KEYS) if (!Array.isArray(state.dailyAz[k])) state.dailyAz[k] = [];   // ملفات محفوظة قبل التحديث
  return state.dailyAz;
}
// الفترة: من (at) إلى (end) بتوقيت الجهاز. الأيقونة بتفضل ظاهرة طول الفترة لحد ما الأذكار تخلص، والإشعار بيظهر مرة واحدة أول الفترة.
// لو الفترة اتفتح فيها البرنامج متأخر والإشعار لسه ما ظهرش النهاردة: بيظهر وقتها.

// ───────────── إشعار سريع (شارة / تحديث / ملخص): بيدخل نفس طابور الإشعارات ─────────────
function notice(key, text, ico, snd) {
  enqueuePopup({ key: 'nt:' + key, prio: 4, run: () => azPopup({ text, snd, grp: 'az', ico }, false) });
}

// ───────────── ملخص الأسبوع (للإحصائيات والشارات) ─────────────
const sumDay = m => Object.values(m || {}).reduce((a, b) => a + (b > 0 ? b : 0), 0);
function weeklyPayload() {
  const days = [];
  for (let i = 6; i >= 0; i--) { const dt = dateAgo(i); days.push({ k: dayKeyOf(dt), dow: dt.getDay(), n: sumDay((state.daily || {})[dayKeyOf(dt)]) }); }   // من أقدم يوم لحد النهارده
  let prev = 0; for (let i = 13; i >= 7; i--) prev += sumDay((state.daily || {})[dayKeyOf(dateAgo(i))]);
  const total = days.reduce((a, d) => a + d.n, 0), active = days.filter(d => d.n > 0).length;
  const best = days.reduce((b, d) => (d.n > b.n ? d : b), days[0]);
  const per = {};
  for (let i = 0; i < 7; i++) for (const [id, n] of Object.entries((state.daily || {})[dayKeyOf(dateAgo(i))] || {})) if (n > 0) per[id] = (per[id] || 0) + n;
  const topId = Object.keys(per).sort((a, b) => per[b] - per[a])[0], tp = topId && dhikrById(topId);
  return { days, total, prev, active, best: best.n > 0 ? { dow: best.dow, n: best.n } : null, top: tp ? { text: tp.text, n: per[topId] } : null };
}
// ───────────── الختمة (604 صفحة): الصفحة بتتحسب مقروءة لما تفضل ظاهرة كام ثانية في المصحف ─────────────
const KH_PAGES = 604;
function khatmaView() {
  const k = state.khatma, read = (k.bits.match(/1/g) || []).length;
  const elapsed = Math.max(0, dayDiff(k.start, dayKeyOf(new Date())));
  const left = Math.max(1, k.days - elapsed);
  return { read, total: KH_PAGES, days: k.days, elapsed, left, perDay: Math.ceil((KH_PAGES - read) / left), todayRead: k.today.d === dayKeyOf(new Date()) ? k.today.n : 0, count: k.count, start: k.start };
}
function khatmaReset(days) {
  state.khatma.bits = '0'.repeat(KH_PAGES); state.khatma.start = dayKeyOf(new Date()); state.khatma.today = { d: '', n: 0 };
  if (Number.isInteger(days) && days >= 1 && days <= 365) state.khatma.days = days;
}
ipcMain.on('khatma:page', (e, p) => {
  if (!fromSettings(e) || !Number.isInteger(p) || p < 1 || p > KH_PAGES) return;
  const k = state.khatma;
  if (k.bits[p - 1] === '1') return;
  k.bits = k.bits.slice(0, p - 1) + '1' + k.bits.slice(p);
  const t = dayKeyOf(new Date()); if (k.today.d !== t) k.today = { d: t, n: 0 }; k.today.n += 1;
  if (!k.bits.includes('0')) {                              // الختمة اكتملت
    k.count += 1; khatmaReset();
    notice('khatma', 'ما شاء الله، أتممت ختمة كاملة للقرآن الكريم! تقبّل الله منك وبارك فيك', 'bd', 'completion');
  }
  checkAch(true); scheduleStats(); saveStateSoon();
});
ipcMain.on('khatma:new', (e, days) => { if (!fromSettings(e)) return; khatmaReset(Number(days)); scheduleStats(); saveStateSoon(); });

// ───────────── الشارات (متعلّقة بحاجات البرنامج نفسه) ─────────────
// [id, الاسم, الوصف, الأيقونة, المقياس, المطلوب]
const ACH = [
  ['t1', 'أول تسبيحة', 'سبّحت لأول مرة في البرنامج', 'bead', 'total', 1],
  ['t100', 'مئة تسبيحة', 'وصل إجمالي تسبيحك إلى 100', 'bead', 'total', 100],
  ['t1k', 'ألف تسبيحة', 'وصل إجمالي تسبيحك إلى 1,000', 'bead', 'total', 1000],
  ['t10k', 'عشرة آلاف تسبيحة', 'وصل إجمالي تسبيحك إلى 10,000', 'bead', 'total', 10000],
  ['t100k', 'مئة ألف تسبيحة', 'وصل إجمالي تسبيحك إلى 100,000', 'bead', 'total', 100000],
  ['s3', 'ثلاثة أيام متتالية', 'سبّحت 3 أيام ورا بعض', 'flame', 'streak', 3],
  ['s7', 'أسبوع من المداومة', 'سبّحت 7 أيام ورا بعض', 'flame', 'streak', 7],
  ['s30', 'شهر من المداومة', 'سبّحت 30 يوم ورا بعض', 'flame', 'streak', 30],
  ['s100', 'مئة يوم متواصلة', 'سبّحت 100 يوم ورا بعض', 'flame', 'streak', 100],
  ['d100', 'يوم مبارك', '100 تسبيحة في يوم واحد', 'sun', 'bestDay', 100],
  ['d500', 'يوم عامر بالذكر', '500 تسبيحة في يوم واحد', 'sun', 'bestDay', 500],
  ['d1k', 'يوم الألف', '1,000 تسبيحة في يوم واحد', 'sun', 'bestDay', 1000],
  ['v5', 'ذاكر متنوّع', 'سبّحت بـ 5 أذكار مختلفة', 'cards', 'variety', 5],
  ['v15', 'كنز الأذكار', 'سبّحت بـ 15 ذكر مختلف', 'cards', 'variety', 15],
  ['c10', 'عشر دورات', 'أتممت 10 دورات من هدف التسبيح', 'check', 'cycles', 10],
  ['c100', 'مئة دورة', 'أتممت 100 دورة من هدف التسبيح', 'check', 'cycles', 100],
  ['u1', 'ذكرك الخاص', 'أضفت ذكرًا من عندك', 'edit', 'custom', 1],
  ['w1k', 'أسبوع مثمر', '1,000 تسبيحة في أسبوع واحد', 'chart', 'week', 1000],
  ['w5k', 'أسبوع عامر', '5,000 تسبيحة في أسبوع واحد', 'chart', 'week', 5000],
  ['k50', 'نصف المصحف', 'قرأت 302 صفحة في ختمتك الحالية', 'book', 'khPages', 302],
  ['k1', 'ختمة كاملة', 'أتممت ختمة كاملة للقرآن الكريم', 'mosque', 'khatmas', 1],
  ['k3', 'ثلاث ختمات', 'أتممت 3 ختمات للقرآن الكريم', 'mosque', 'khatmas', 3]
];
function achCtx() {
  const today = todayCount(); if (today > state.bestDay) state.bestDay = today;
  const bd = Math.max(state.bestDay, ...Object.values(state.daily || {}).map(sumDay), 0);
  state.bestDay = bd;
  return {
    total: state.total, streak: streakView().best, bestDay: bd,
    variety: Object.values(state.stats || {}).filter(s => s && s.n > 0).length, cycles: state.cycles,
    custom: state.customAzkar.length, week: weeklyPayload().total,
    khPages: (state.khatma.bits.match(/1/g) || []).length, khatmas: state.khatma.count
  };
}
let lastAchAt = 0;
function checkAch(force) {
  const now = Date.now(); if (!force && now - lastAchAt < 5000) return; lastAchAt = now;
  const c = achCtx(), fresh = [];
  for (const a of ACH) if (!state.ach[a[0]] && (c[a[4]] || 0) >= a[5]) { state.ach[a[0]] = dayKeyOf(new Date()); fresh.push(a); }
  if (!fresh.length) return;
  saveStateSoon(); scheduleStats();
  if (!state.achInit) { state.achInit = true; return; }      // أول تشغيل بعد التحديث: الشارات اللي مستحقها بالفعل بتتسجّل بصمت
  if (fresh.length > 2) notice('ach:multi', 'فتحت ' + fresh.length + ' شارات جديدة، شوفها في صفحة الإحصائيات', 'bd', 'completion');
  else for (const a of fresh) notice('ach:' + a[0], 'شارة جديدة: ' + a[1] + ' — ' + a[2], 'bd', 'completion');
}
function achView() {
  const c = achCtx();
  return ACH.map(a => ({ id: a[0], name: a[1], desc: a[2], ico: a[3], got: state.ach[a[0]] || '', cur: Math.min(c[a[4]] || 0, a[5]), need: a[5] }));
}

// ───────────── النسخ الاحتياطي التلقائي والاستعادة ─────────────
const backupDir = () => path.join(app.getPath('userData'), 'backups');
const pendingQuranFile = () => path.join(app.getPath('userData'), 'pending-quran.json');
const BK_RE = /^auto-\d{4}-\d{2}-\d{2}\.json$/;
let quranBlob = null;                                      // بيانات المصحف (علامات/ملاحظات/آخر صفحة) اللي بتتحفظ في نافذة الإعدادات: بتتبعتلنا علشان تدخل النسخة
function backupFiles() { try { return fs.readdirSync(backupDir()).filter(f => BK_RE.test(f)).sort().reverse(); } catch (_) { return []; } }
function latestBackupObj() {
  for (const f of backupFiles()) { try { const o = JSON.parse(fs.readFileSync(path.join(backupDir(), f), 'utf8')); if (o && o.state) return o; } catch (_) {} }
  return null;
}
function backupPayload() {
  let q = quranBlob; if (q === null) { const o = latestBackupObj(); q = (o && typeof o.quran === 'string') ? o.quran : null; }
  return { app: 'WZAKER', v: 1, ver: app.getVersion(), at: new Date().toISOString(), state, quran: q };
}
function autoBackup(force) {
  if (restoringBackup || (!state.autoBackup && !force)) return;
  try {
    fs.mkdirSync(backupDir(), { recursive: true });
    fs.writeFileSync(path.join(backupDir(), 'auto-' + todayKey() + '.json'), JSON.stringify(backupPayload()));
    for (const f of backupFiles().slice(10)) { try { fs.unlinkSync(path.join(backupDir(), f)); } catch (_) {} }   // آخر 10 أيام بس
  } catch (_) {}
}
function backupList() {
  return backupFiles().slice(0, 10).map(f => {
    let at = '', total = 0;
    try { const o = JSON.parse(fs.readFileSync(path.join(backupDir(), f), 'utf8')); at = o.at || ''; total = (o.state && o.state.total) || 0; } catch (_) {}
    return { name: f, at, total };
  });
}
const backupValid = o => !!o && o.app === 'WZAKER' && !!o.state && typeof o.state === 'object' && !Array.isArray(o.state) && (o.quran == null || typeof o.quran === 'string');
async function confirmRestore(o, confirmed) {         // confirmed = المستخدم أكّد جوه البرنامج (بدون مربع نظام)
  if (!backupValid(o)) return false;
  const r = confirmed ? { response: 0 } : await dialog.showMessageBox(settingsWin && !settingsWin.isDestroyed() ? settingsWin : undefined, {
    type: 'warning', buttons: ['استعادة وإعادة التشغيل', 'إلغاء'], defaultId: 1, cancelId: 1, title: 'استعادة نسخة احتياطية',
    message: 'هتتبدّل إعداداتك وإحصائياتك الحالية بنسخة ' + (o.at ? new Date(o.at).toLocaleString('ar-EG') : 'قديمة') + '.',
    detail: 'هنحتفظ بنسخة من وضعك الحالي، والبرنامج هيتقفل ويفتح تاني.'
  });
  if (r.response !== 0) return false;
  try {
    fs.mkdirSync(backupDir(), { recursive: true });
    fs.writeFileSync(path.join(backupDir(), 'pre-restore.json'), JSON.stringify(backupPayload()));   // أمان: نسخة من وضعك قبل الاستعادة
    restoringBackup = true; clearTimeout(saveTimer);
    fs.writeFileSync(stateFile(), JSON.stringify(o.state));
    if (typeof o.quran === 'string') fs.writeFileSync(pendingQuranFile(), o.quran);
  } catch (_) { restoringBackup = false; return false; }
  skipExitVoice = true; app.relaunch(); app.exit(0);
  return true;
}
ipcMain.handle('backup:list', e => (fromSettings(e) ? backupList() : []));
ipcMain.handle('backup:path', e => (fromSettings(e) ? backupDir() : ''));
ipcMain.handle('backup:open-dir', async e => {   // فتح مجلد النسخ (بنعمله لو لسه مش موجود)
  if (!fromSettings(e)) return false;
  try { fs.mkdirSync(backupDir(), { recursive: true }); return (await shell.openPath(backupDir())) === ''; } catch (_) { return false; }
});
ipcMain.handle('backup:copy-path', e => { if (!fromSettings(e)) return false; try { clipboard.writeText(backupDir()); return true; } catch (_) { return false; } });
ipcMain.handle('backup:now', e => { if (!fromSettings(e)) return []; autoBackup(true); return backupList(); });
ipcMain.handle('backup:restore', (e, name, confirmed) => {
  if (!fromSettings(e) || !BK_RE.test(String(name))) return false;
  let o; try { o = JSON.parse(fs.readFileSync(path.join(backupDir(), String(name)), 'utf8')); } catch (_) { return false; }
  return confirmRestore(o, confirmed === true);
});
ipcMain.handle('backup:export', async e => {
  if (!fromSettings(e)) return false;
  const r = await dialog.showSaveDialog(settingsWin, { title: 'حفظ نسخة احتياطية', defaultPath: 'WZAKER-backup-' + todayKey() + '.json', filters: [{ name: 'WZAKER backup', extensions: ['json'] }] });
  if (r.canceled || !r.filePath) return false;
  try { fs.writeFileSync(r.filePath, JSON.stringify(backupPayload())); return true; } catch (_) { return false; }
});
let pendingImport = null;                                   // ملف اتختار للاستيراد وبينتظر تأكيد المستخدم جوه البرنامج
ipcMain.handle('backup:import', async e => {
  if (!fromSettings(e)) return { ok: false };
  const r = await dialog.showOpenDialog(settingsWin, { title: 'استيراد نسخة احتياطية', properties: ['openFile'], filters: [{ name: 'WZAKER backup', extensions: ['json'] }] });
  if (r.canceled || !r.filePaths[0]) return { ok: false, canceled: true };
  let o; try { if (fs.statSync(r.filePaths[0]).size > 20e6) return { ok: false }; o = JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8')); } catch (_) { return { ok: false }; }
  if (!backupValid(o)) return { ok: false };
  pendingImport = o;
  return { ok: true, at: o.at || '', total: (o.state && o.state.total) || 0 };
});
ipcMain.handle('backup:import-apply', e => (fromSettings(e) && pendingImport ? confirmRestore(pendingImport, true) : false));
ipcMain.on('backup:import-cancel', e => { if (fromSettings(e)) pendingImport = null; });
ipcMain.on('backup:quran', (e, s) => { if (fromSettings(e) && typeof s === 'string' && s.length < 5e6) quranBlob = s; });
ipcMain.on('backup:pendingQuran', e => {
  e.returnValue = null;
  if (!fromSettings(e)) return;
  try { const p = pendingQuranFile(); if (fs.existsSync(p)) { e.returnValue = fs.readFileSync(p, 'utf8'); fs.unlinkSync(p); } } catch (_) {}
});

// ───────────── التحديث التلقائي (GitHub Releases عبر electron-updater) ─────────────
const upd = { status: 'idle', version: '', percent: 0, error: '' };   // idle | checking | none | downloading | ready | error | unsupported
let autoUpdater = null;
function setUpd(p) { Object.assign(upd, p); broadcastState(); }
function updFriendly(err) {
  const t = String((err && err.message) || err || '');
  if (/app-update\.yml|ENOENT/i.test(t)) return 'النسخة دي مش متجهّزة للتحديث التلقائي (النسخ اللي بتتبني من GitHub Actions بس)';
  if (/ENOTFOUND|ETIMEDOUT|ECONNRESET|ECONNREFUSED|net::|EAI_AGAIN|network/i.test(t)) return 'مفيش اتصال بالإنترنت';
  if (/404|No published versions|Cannot find latest|latest\.yml/i.test(t)) return 'مفيش إصدار منشور على GitHub لسه';
  return 'تعذّر فحص التحديثات، جرّب تاني بعد شوية';
}
function updInit() {
  if (!app.isPackaged) { upd.status = 'unsupported'; return; }   // وضع التطوير: مفيش تحديث
  try { autoUpdater = require('electron-updater').autoUpdater; } catch (_) { upd.status = 'unsupported'; return; }
  autoUpdater.autoDownload = true; autoUpdater.autoInstallOnAppQuit = state.autoUpdateOn !== false; autoUpdater.allowPrerelease = false; autoUpdater.logger = null;
  autoUpdater.on('checking-for-update', () => setUpd({ status: 'checking', error: '' }));
  autoUpdater.on('update-available', i => setUpd({ status: 'downloading', version: String((i && i.version) || ''), percent: 0 }));
  autoUpdater.on('update-not-available', () => setUpd({ status: 'none' }));
  autoUpdater.on('download-progress', p => setUpd({ status: 'downloading', percent: Math.round((p && p.percent) || 0) }));
  autoUpdater.on('update-downloaded', i => {
    setUpd({ status: 'ready', version: String((i && i.version) || upd.version), percent: 100 });
    notice('upd:' + upd.version, 'تحديث جديد (' + upd.version + ') جاهز للتثبيت، افتح الإعدادات ← حول البرنامج وثبّته', 'up', 'completion');
  });
  autoUpdater.on('error', err => setUpd({ status: 'error', error: updFriendly(err) }));
  setTimeout(() => { if (state.autoUpdateOn) updCheck(); }, 20_000);
  setInterval(() => { if (state.autoUpdateOn) updCheck(); }, 6 * 3600_000);
}
function updCheck(manual) {
  if (!autoUpdater || upd.status === 'checking' || upd.status === 'downloading' || upd.status === 'ready') return;
  try { autoUpdater.checkForUpdates().catch(() => {}); } catch (_) {}
}
function updInstall() {
  if (!autoUpdater || upd.status !== 'ready') return;
  skipExitVoice = true;
  setImmediate(() => { try { autoUpdater.quitAndInstall(false, true); } catch (_) {} });
}

// ───────────── مواقيت الصلاة (حساب محلي بدون إنترنت؛ الإنترنت بس لتحديد المدينة أول مرة) ─────────────
const PRAYER_KEYS = ['fj', 'du', 'dh', 'as', 'mg', 'is'];
const PRAYER_NAMES = { fj: 'الفجر', du: 'الضحى', dh: 'الظهر', as: 'العصر', mg: 'المغرب', is: 'العشاء' };
const PRAYER_METHODS = { egypt: { f: 19.5, i: 17.5 }, mwl: { f: 18, i: 17 }, isna: { f: 15, i: 15 }, karachi: { f: 18, i: 18 }, makkah: { f: 18.5, im: 90 } };
const PRAYER_CITIES = {   // كود الدولة: [خط العرض، خط الطول، العاصمة، الدولة، المنطقة الزمنية، طريقة الحساب]
  eg: [30.0444, 31.2357, 'القاهرة', 'مصر', 'Africa/Cairo', 'egypt'],
  sa: [24.7136, 46.6753, 'الرياض', 'السعودية', 'Asia/Riyadh', 'makkah'],
  ae: [24.4539, 54.3773, 'أبو ظبي', 'الإمارات', 'Asia/Dubai', 'mwl'],
  qa: [25.2854, 51.531, 'الدوحة', 'قطر', 'Asia/Qatar', 'makkah'],
  kw: [29.3759, 47.9774, 'مدينة الكويت', 'الكويت', 'Asia/Kuwait', 'mwl'],
  bh: [26.2285, 50.586, 'المنامة', 'البحرين', 'Asia/Bahrain', 'makkah'],
  om: [23.588, 58.3829, 'مسقط', 'عُمان', 'Asia/Muscat', 'mwl'],
  ye: [15.3694, 44.191, 'صنعاء', 'اليمن', 'Asia/Aden', 'makkah'],
  jo: [31.9454, 35.9284, 'عمّان', 'الأردن', 'Asia/Amman', 'mwl'],
  ps: [31.7683, 35.2137, 'القدس', 'فلسطين', 'Asia/Jerusalem', 'mwl'],
  lb: [33.8938, 35.5018, 'بيروت', 'لبنان', 'Asia/Beirut', 'mwl'],
  sy: [33.5138, 36.2765, 'دمشق', 'سوريا', 'Asia/Damascus', 'mwl'],
  iq: [33.3152, 44.3661, 'بغداد', 'العراق', 'Asia/Baghdad', 'mwl'],
  sd: [15.5007, 32.5599, 'الخرطوم', 'السودان', 'Africa/Khartoum', 'egypt'],
  ly: [32.8872, 13.1913, 'طرابلس', 'ليبيا', 'Africa/Tripoli', 'mwl'],
  tn: [36.8065, 10.1815, 'تونس', 'تونس', 'Africa/Tunis', 'mwl'],
  dz: [36.7538, 3.0588, 'الجزائر', 'الجزائر', 'Africa/Algiers', 'mwl'],
  ma: [34.0209, -6.8416, 'الرباط', 'المغرب', 'Africa/Casablanca', 'mwl'],
  mr: [18.0735, -15.9582, 'نواكشوط', 'موريتانيا', 'Africa/Nouakchott', 'mwl'],
  so: [2.0469, 45.3182, 'مقديشو', 'الصومال', 'Africa/Mogadishu', 'mwl'],
  dj: [11.5721, 43.1456, 'جيبوتي', 'جيبوتي', 'Africa/Djibouti', 'mwl'],
  km: [-11.7022, 43.2551, 'موروني', 'جزر القمر', 'Indian/Comoro', 'mwl'],
  tr: [39.9334, 32.8597, 'أنقرة', 'تركيا', 'Europe/Istanbul', 'mwl'],
  ir: [35.6892, 51.389, 'طهران', 'إيران', 'Asia/Tehran', 'mwl'],
  pk: [33.6844, 73.0479, 'إسلام آباد', 'باكستان', 'Asia/Karachi', 'karachi'],
  af: [34.5553, 69.2075, 'كابل', 'أفغانستان', 'Asia/Kabul', 'karachi'],
  in: [28.6139, 77.209, 'نيودلهي', 'الهند', 'Asia/Kolkata', 'karachi'],
  bd: [23.8103, 90.4125, 'دكا', 'بنغلاديش', 'Asia/Dhaka', 'karachi'],
  id: [-6.2088, 106.8456, 'جاكرتا', 'إندونيسيا', 'Asia/Jakarta', 'mwl'],
  my: [3.139, 101.6869, 'كوالالمبور', 'ماليزيا', 'Asia/Kuala_Lumpur', 'mwl'],
  ng: [9.0765, 7.3986, 'أبوجا', 'نيجيريا', 'Africa/Lagos', 'mwl'],
  sn: [14.7167, -17.4677, 'داكار', 'السنغال', 'Africa/Dakar', 'mwl'],
  gb: [51.5074, -0.1278, 'لندن', 'بريطانيا', 'Europe/London', 'mwl'],
  fr: [48.8566, 2.3522, 'باريس', 'فرنسا', 'Europe/Paris', 'mwl'],
  de: [52.52, 13.405, 'برلين', 'ألمانيا', 'Europe/Berlin', 'mwl'],
  us: [38.9072, -77.0369, 'واشنطن', 'أمريكا', 'America/New_York', 'isna'],
  ca: [45.4215, -75.6972, 'أوتاوا', 'كندا', 'America/Toronto', 'isna'],
  au: [-35.2809, 149.13, 'كانبيرا', 'أستراليا', 'Australia/Sydney', 'mwl']
};
const fixH = h => ((h % 24) + 24) % 24;
const fixA = a => ((a % 360) + 360) % 360;
function zoneOffsetH(zone, date) {                         // فرق توقيت المنطقة (مثلاً Africa/Cairo) عن UTC بالساعات في اليوم ده
  try {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(d).map(x => [x.type, x.value]));
    return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - d.getTime()) / 3600000;
  } catch (_) { return null; }
}
function prayerCalc(date, lat, lng, mk, zone) {            // بيرجّع الدقيقة (بتوقيت جهازك) من أول اليوم لكل صلاة، أو null لو الحساب مستحيل
  const R = Math.PI / 180, D = 180 / Math.PI, m = PRAYER_METHODS[mk] || PRAYER_METHODS.mwl;
  const sin = x => Math.sin(x * R), cos = x => Math.cos(x * R), tan = x => Math.tan(x * R);
  const devTz = -new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12).getTimezoneOffset() / 60;
  const cityTz = zone ? (zoneOffsetH(zone, date) ?? devTz) : devTz;
  let Y = date.getFullYear(), M = date.getMonth() + 1; const Dd = date.getDate();
  if (M <= 2) { Y -= 1; M += 12; }
  const A = Math.floor(Y / 100), B = 2 - A + Math.floor(A / 4);
  const jd = Math.floor(365.25 * (Y + 4716)) + Math.floor(30.6001 * (M + 1)) + Dd + B - 1524.5 - lng / 360;
  const sunPos = j => {
    const d = j - 2451545.0, g = fixA(357.529 + 0.98560028 * d), q = fixA(280.459 + 0.98564736 * d);
    const L = fixA(q + 1.915 * sin(g) + 0.020 * sin(2 * g)), e = 23.439 - 0.00000036 * d;
    const RA = fixH(Math.atan2(cos(e) * sin(L), cos(L)) * D / 15);
    return { decl: Math.asin(sin(e) * sin(L)) * D, eqt: q / 15 - RA };
  };
  const midDay = t => fixH(12 - sunPos(jd + t / 24).eqt);
  const angleTime = (angle, t, ccw) => {
    const decl = sunPos(jd + t / 24).decl, x = (-sin(angle) - sin(lat) * sin(decl)) / (cos(lat) * cos(decl));
    if (!(Math.abs(x) <= 1)) return NaN;
    return midDay(t) + (ccw ? -1 : 1) * Math.acos(x) * D / 15;
  };
  const decl13 = sunPos(jd + 13 / 24).decl;
  const asrAngle = -Math.atan(1 / (1 + tan(Math.abs(lat - decl13)))) * D;   // ظل الشيء = طوله (المذهب الجمهور)
  const adj = cityTz - lng / 15, a = t => t + adj;
  let fj = a(angleTime(m.f, 5, true)); const sr = a(angleTime(0.833, 6, true)), dh = a(midDay(12)), asr = a(angleTime(asrAngle, 13, false)), ss = a(angleTime(0.833, 18, false));
  let is = m.im ? ss + m.im / 60 : a(angleTime(m.i, 18, false));
  if (Number.isFinite(sr) && Number.isFinite(ss)) {          // بلاد بعيدة عن خط الاستواء في الصيف: نقسّم الليل أسباع
    const night = fixH(sr - ss);
    if (!Number.isFinite(fj)) fj = sr - night / 7;
    if (!Number.isFinite(is)) is = ss + night / 7;
  }
  const out = { fj, du: sr + 20 / 60, dh, as: asr, mg: ss, is };   // الضحى: بعد الشروق بـ 20 دقيقة
  for (const k of PRAYER_KEYS) { if (!Number.isFinite(out[k])) return null; out[k] = Math.round(fixH(out[k] + (devTz - cityTz)) * 60) % 1440; }
  return out;
}
let prayerCache = null, prayerLocating = false;
function prayerLoc() {
  const c = PRAYER_CITIES[state.prayerCity];
  if (state.prayerCity !== 'auto' && c) return { lat: c[0], lng: c[1], method: c[5], zone: c[4], name: c[2] + '، ' + c[3] };
  if (Number.isFinite(state.prayerLat) && Number.isFinite(state.prayerLng)) return { lat: state.prayerLat, lng: state.prayerLng, method: state.prayerMethod, name: state.prayerPlace || 'موقعك' };
  return null;
}
function prayerMins() {
  const loc = prayerLoc(); if (!loc) return null;
  const key = todayKey() + '|' + loc.lat + '|' + loc.lng + '|' + loc.method + '|' + (loc.zone || '');
  if (!prayerCache || prayerCache.key !== key) prayerCache = { key, t: prayerCalc(new Date(), loc.lat, loc.lng, loc.method, loc.zone) };
  return prayerCache.t;
}
const prayerMin = k => { const t = prayerMins(); return t ? t[k] : null; };
const fmtMin = m => pad2(Math.floor(m / 60)) + ':' + pad2(m % 60);
function prayerInfo() {                                    // للإعدادات: المكان + مواعيد النهاردة
  const loc = prayerLoc(), t = prayerMins();
  return { place: loc ? loc.name : '', auto: state.prayerCity === 'auto', locating: prayerLocating, times: t ? Object.fromEntries(PRAYER_KEYS.map(k => [k, t[k]])) : null };
}
async function prayerLocate() {                            // تحديد المدينة تلقائيًا من الإنترنت (IP): مرة عند التشغيل وعند الطلب
  if (prayerLocating || exiting) return;
  prayerLocating = true; broadcastState();
  try {
    const ac = new AbortController(), to = setTimeout(() => ac.abort(), 8000);
    const r = await net.fetch('https://ipwho.is/?fields=success,latitude,longitude,city,country_code', { signal: ac.signal });
    clearTimeout(to);
    const j = await r.json();
    if (j && j.success !== false && Number.isFinite(j.latitude) && Number.isFinite(j.longitude)) {
      state.prayerLat = j.latitude; state.prayerLng = j.longitude; state.prayerPlace = String(j.city || '').slice(0, 60);
      const cc = String(j.country_code || '').toUpperCase();
      state.prayerMethod = cc === 'EG' ? 'egypt' : cc === 'SA' ? 'makkah' : ['PK', 'IN', 'BD', 'AF'].includes(cc) ? 'karachi' : ['US', 'CA'].includes(cc) ? 'isna' : 'mwl';
      prayerCache = null; saveStateSoon();
    }
  } catch (_) { /* مفيش إنترنت: نكمل بآخر موقع محفوظ، أو المستخدم يختار مدينته */ }
  prayerLocating = false; broadcastState(); azCheck();
}
const PRAYER_SLOTS = PRAYER_KEYS.map((k, i) => ({
  k: 'p_' + k, pray: true, prio: -3 + i * 0.01,
  on: () => state.prayerAlert && state.prayerOn[k] !== false && prayerMin(k) !== null,
  at: () => fmtMin(prayerMin(k) || 0), end: () => fmtMin(Math.min(1439, (prayerMin(k) || 0) + 30)),   // الإشعار بيظهر وقت الصلاة (ولو البرنامج اتفتح في أول نص ساعة بعدها)
  fired: 'pf_' + k, done: () => false, ico: 'ad',
  ...(k === 'du' ? { grp: 'az', snd: 'birds' }                     // الضحى مالهاش أذان: صوت هادي بدل الأذان
                 : { grp: 'pray', snd: 'athan' }),
  text: 'حان الآن موعد صلاة ' + PRAYER_NAMES[k]
}));
const AZ_SLOTS = [
  { k: 'm', on: () => state.sabahAlert, at: () => state.sabahAt, end: () => state.sabahEnd, fired: 'mf', done: d => d.m.length >= AZ.m.length, grp: 'az', snd: 'birds', text: 'حان الآن موعد أذكار الصباح، اضغط هنا وابدأ القراءة' },
  { k: 'e', on: () => state.masaaAlert, at: () => state.masaaAt, end: () => state.masaaEnd, fired: 'ef', done: d => d.e.length >= AZ.e.length, grp: 'az', snd: 'owl', text: 'حان الآن موعد أذكار المساء، اضغط هنا وابدأ القراءة' },
  { k: 'w', on: () => state.wirdAlert, at: () => state.wirdAt, end: () => '24:00', fired: 'wf', done: d => d.wd === true, grp: 'wird', snd: 'wird', text: 'لا تنسَ وردك اليومي من القرآن الكريم' },
  { k: 'sl', prio: 1.5, on: () => state.sleepAlert, at: () => state.sleepAt, end: () => state.sleepEnd, fired: 'slf', done: d => d.sl.length >= AZ.sl.length, grp: 'az', snd: 'sleep', alt: 'owl', text: 'حان الآن موعد أذكار النوم، اضغط هنا وابدأ القراءة' },
  { k: 'wk', prio: -1, on: () => state.wakeAlert, at: () => state.wakeAt, end: () => state.wakeEnd, fired: 'wkf', done: d => d.wk.length >= AZ.wk.length, grp: 'az', snd: 'wake', alt: 'birds', text: 'حان الآن موعد أذكار الاستيقاظ، اضغط هنا وابدأ القراءة' },
  ...PRAYER_SLOTS
];
const nowMins = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };
function slotActive(s, d) {                                // جه وقته (من الميعاد لحد 6 ساعات) ولسه ما اتمّش
  const [h, mi] = s.at().split(':').map(Number), st = h * 60 + mi, mins = nowMins();
  const en = (() => { const [eh, em] = s.end().split(':').map(Number), v = eh * 60 + (em || 0); return v > st ? Math.min(1440, v) : 1440; })();   // نهاية قبل البداية/مساوية = لحد آخر اليوم
  return mins >= st && mins < en && !s.done(d);
}
const slotStart = s => { const [h, mi] = s.at().split(':').map(Number); return h * 60 + mi; };
function azDue() {                                         // الصباح/المساء اللي وقته جه ولسه ما اتمّش (أيقونة الشمس/الهلال): لو الاتنين في وقتهم يظهر الأحدث بس
  const d = dailyAz(); let best = null, bt = -1;
  for (const s of AZ_SLOTS) {
    if (s.pray || s.misc || s.k === 'w' || s.k === 'sl' || s.k === 'wk' || !slotActive(s, d)) continue;   // أيقونة الشمس/الهلال للصباح والمساء بس
    const st = slotStart(s); if (st > bt) { bt = st; best = s.k; }
  }
  return best;
}
function azRest() {                                        // أيقونة النوم/الاستيقاظ (لما التنبيه مفعّل ولسه الأذكار ما خلصتش)
  const d = dailyAz(); let best = null, bt = -1;
  for (const s of AZ_SLOTS) {
    if (s.pray || s.misc || (s.k !== 'sl' && s.k !== 'wk') || !s.on() || !slotActive(s, d)) continue;
    const st = slotStart(s); if (st > bt) { bt = st; best = s.k; }
  }
  return best;
}
function wirdDue() { return state.wirdAlert && slotActive(AZ_SLOTS.find(s => s.k === 'w'), dailyAz()); }   // أيقونة المصحف (لما التنبيه مفعّل)
let lastDue = '';
function azPopup(s, preview) {
  return showPopup('verse', { custom: { text: s.text, src: audioFiles[s.snd] || (s.alt && audioFiles[s.alt]) || null, grp: s.grp, ico: s.ico || s.k }, preview: !!preview });
}
function azCheck() {
  const key = (azDue() || '-') + (azRest() || '-') + (wirdDue() ? 'w' : '-');
  if (key !== lastDue) { lastDue = key; broadcastState(); }
  if (exiting) return;
  const d = dailyAz();
  AZ_SLOTS.forEach((s, idx) => {                           // كل تنبيه جه وقته ولسه ما اتبعتش النهاردة: يدخل الطابور (صباح ← مساء ← ورد)
    if (!s.on() || d[s.fired] || !slotActive(s, d)) return;
    enqueuePopup({
      key: 'az:' + s.k, prio: s.prio !== undefined ? s.prio : idx,
      run: () => {
        const dd = dailyAz();                              // نتأكد تاني وقت دوره: ممكن الميعاد اتغيّر أو الأذكار اتمّت وهو مستني
        if (!s.on() || dd[s.fired] || !slotActive(s, dd)) return false;
        if (!azPopup(s, false)) return false;
        dd[s.fired] = true; saveStateSoon();
        return true;
      }
    });
  });
}

// ───────────── مكان وحجم الإشعار المنبثق ─────────────
// لكل نوع إعداداته: verse (الآيات + التنبيهات المخصصة) | cards (بطاقات الذكر الخفي): مكان + آخر مكان اتسحب فيه + حجم.
let popupMoved = false;      // المستخدم سحب الإشعار الحالي: ما نرجّعوش لمكانه الأصلي مع تغيّر الارتفاع
let popupDrag = null;        // { x, y, cx, cy } بداية السحب (مكان النافذة + مكان الماوس)
let popupCssH = 170;         // آخر ارتفاع للإشعار (بكسل نافذة فعلي، بعد الحجم)
let popupHz = 1, popupZSent = 1;   // الحجم اللي اتقاس عليه الارتفاع | آخر حجم اتبعت للصفحة
const POPUP_PAD = { l: 26, r: 26, t: 22, b: 34 };   // هوامش الـ Glow الشفافة جوه نافذة الإشعار (نفس popup.html)
const popupScaleOf = k => (k === 'cards' ? state.cardsScale : state.popupScale);
const popupPosOf = k => (k === 'cards' ? state.cardsPos : state.popupPos);
let popupStartAt = null;     // مكان بداية إجباري (لما البطاقات بتطلع من المسبحة)
function popupDims(kind) {
  const z = popupScaleOf(kind);
  return { z, W: Math.ceil(POPUP_W * z), pad: { l: POPUP_PAD.l * z, r: POPUP_PAD.r * z, t: POPUP_PAD.t * z, b: POPUP_PAD.b * z } };
}
function clampPopup(kind, x, y, h) {                 // الكارت الظاهر يفضل جوه الشاشة (الهامش الشفاف ممكن يطلع بره)
  const { W, pad } = popupDims(kind);
  const wa = screen.getDisplayMatching({ x: Math.round(x), y: Math.round(y), width: W, height: h }).workArea;
  return {
    x: Math.round(Math.min(wa.x + wa.width - W + pad.r, Math.max(wa.x - pad.l, x))),
    y: Math.round(Math.min(wa.y + wa.height - h + pad.b, Math.max(wa.y - pad.t, y)))
  };
}
const dialShown = () => !!win && !win.isDestroyed() && vis === 'shown' && !win.isMinimized();
// بطاقات الذكر الخفي جوه المسبحة نفسها: المسبحة (الدايرة) تتحول مؤقتًا لشاشة اختيار من غير نافذة منفصلة.
// بيشتغل بس لما المكان = "مكان المسبحة نفسها" والمسبحة ظاهرة في الوضع الكامل (في Mini Mode بنرجع للنافذة المنفصلة زي ما كان).
const inlineCardsOk = () => state.cardsPos === 'dial' && dialShown() && !state.miniMode;   // الظهور الافتراضي جوه المسبحة (لما المكان = مكان المسبحة نفسها)
const dockOk = () => dialShown() && !state.miniMode;                                       // السحب للدخول/الخروج شغّال مع أي مكان
// اختيار البطاقات لسه شغّال والمسبحة اتصغّرت/اتخبّت: نلغيه بدل ما يفضل معلّق من غير ما حد يشوفه
function dropInlineChoose() { if (popup && popup.inline && popup.phase === 'choose') closePopup(); }
function popupPlace(kind, h) {
  if (popupStartAt) return clampPopup(kind, popupStartAt.x, popupStartAt.y, h);
  const mode = popupPosOf(kind);
  const { W, pad } = popupDims(kind);
  const sx = kind === 'cards' ? state.cx : state.px, sy = kind === 'cards' ? state.cy : state.py;
  if (mode === 'saved' && sx !== null && sy !== null) return clampPopup(kind, sx, sy, h);
  if ((mode === 'right' || mode === 'left' || mode === 'dial') && dialShown()) {
    const b = win.getBounds();
    const wa = screen.getDisplayMatching(b).workArea;
    if (mode === 'dial') {                                    // نفس مكان المسبحة: نفس المركز
      const cy = b.y + b.height / 2;
      return clampPopup(kind, b.x + b.width / 2 - W / 2, cy - pad.t - (h - pad.t - pad.b) / 2, h);
    }
    const visL = b.x + GLOW, visR = b.x + b.width - GLOW;     // حواف كارت المسبحة الظاهر
    const xRight = visR + POPUP_GAP - pad.l;
    const xLeft = visL - POPUP_GAP - W + pad.r;
    let x = mode === 'right' ? xRight : xLeft;
    const fits = xx => xx + pad.l >= wa.x && xx + W - pad.r <= wa.x + wa.width;
    if (!fits(x)) { const alt = mode === 'right' ? xLeft : xRight; if (fits(alt)) x = alt; }   // مفيش مكان في الجهة دي: الجهة التانية
    return clampPopup(kind, x, b.y + GLOW - pad.t, h);        // أعلى الإشعار = أعلى المسبحة
  }
  const wa = screen.getPrimaryDisplay().workArea;             // corner (الافتراضي) أو المسبحة مش ظاهرة
  if (POPUP_POS_EXTRA.includes(mode)) {                       // أماكن ثابتة على الشاشة
    const x = mode === 'tl' || mode === 'bl' ? wa.x + POPUP_MX
            : mode === 'tc' || mode === 'bc' ? wa.x + Math.round((wa.width - W) / 2)
            : wa.x + wa.width - W - POPUP_MX;
    const y = mode === 'tl' || mode === 'tc' ? wa.y + POPUP_MY : wa.y + wa.height - h - POPUP_MY;
    return clampPopup(kind, x, y, h);
  }
  return { x: wa.x + wa.width - W - POPUP_MX, y: wa.y + POPUP_MY };
}
function popupReplace(keep) {                         // إعادة ضبط مكان وحجم الإشعار الظاهر (تغيير المكان أو الحجم من الإعدادات)
  if (!popup || !popupWin || popupWin.isDestroyed()) return;
  const kind = popup.kind, { z, W } = popupDims(kind);
  popupZSent = z; sendPopup('popup:scale', z);                // الصفحة بتكبّر/تصغّر نفسها (transform) وبترجّع ارتفاعها الجديد
  const H = Math.ceil(popupCssH / popupHz * z);              // تقدير مؤقت لحد ما الصفحة تبلّغ بالارتفاع الحقيقي
  const cur = popupWin.getBounds();
  const p = (keep && popupMoved) ? clampPopup(kind, cur.x, cur.y, H) : popupPlace(kind, H);
  popupWin.setBounds({ x: p.x, y: p.y, width: W, height: H });
}
// بطاقات الذكر الخفي في وضع "مكان المسبحة": المسبحة بتختفي (شفافة وبتعدّي الماوس) طول ما البطاقات ظاهرة
function updateDialCover() {
  const want = !!popup && popup.kind === 'cards' && !popup.free && !!popupWin && !popupWin.isDestroyed() && state.cardsPos === 'dial' && dialShown();   // free = اتسحبت بعيد عن المسبحة
  if (want === dialCovered) return;
  dialCovered = want;
  if (win && !win.isDestroyed()) {
    try { win.setOpacity(want ? 0 : 1); } catch (_) {}
    if (!want) resetMouse();
    else setIgnore(true, true);
  }
}

function showPopup(kind, opts) {
  if (exiting || popup) return false;
  let verse = Math.floor(Math.random() * 2), custom = null;   // 0 = ألا بذكر الله تطمئن القلوب | 1 = فسبحان الله حين تمسون وحين تصبحون (عشوائي)
  if (kind === 'verse') {
    if (opts && opts.custom) custom = opts.custom;           // معاينة تنبيه مخصص
    else { const pk = pickVerse(); verse = pk.verse; custom = pk.custom || null; }
  }
  const reuse = !!(opts && opts.reuse);                    // خروج البطاقات من المسبحة: نفس البطاقات بتتنقل لنافذة منفصلة
  popup = reuse ? opts.reuse : { kind, phase: kind === 'cards' ? 'choose' : 'verse', cards: kind === 'cards' ? pickCards() : null, picked: null,
            verse, custom, preview: !!(opts && opts.preview) };
  popupMoved = reuse; popupDrag = null;
  if (kind === 'cards' && !reuse && inlineCardsOk()) {                 // داخل المسبحة: مفيش نافذة جديدة، نافذة المسبحة نفسها هي اللي بتعرض
    popup.inline = true;
    popupSafety = setTimeout(closePopup, 120_000);
    send('inline:open');
    return true;
  }
  const dm = popupDims(kind);
  popupCssH = Math.ceil((kind === 'cards' ? 280 : 170) * dm.z); popupHz = dm.z; popupZSent = dm.z;
  const h0 = popupCssH;
  const p0 = popupPlace(kind, h0);
  const w = popupWin = new BrowserWindow({
    x: p0.x, y: p0.y,
    width: dm.W, height: h0,   // الارتفاع الحقيقي بيتظبط من الصفحة (popup:fit)
    frame: false, transparent: true, resizable: false, maximizable: false, minimizable: false, fullscreenable: false,
    hasShadow: false, alwaysOnTop: true, skipTaskbar: true, focusable: false, show: false,
    icon: ICON_PATH, backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true, devTools: false,
      backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required'
    }
  });
  w.setMenu(null);
  w.setAlwaysOnTop(true, 'screen-saver');
  w.loadFile('popup.html');
  updateDialCover();
  w.on('closed', () => { if (popupWin === w) { popupWin = null; if (popup) closePopup(); } });
  popupShowTimer = setTimeout(() => { if (popupWin === w && !w.isDestroyed() && !w.isVisible()) w.showInactive(); finishUndockSwap(); }, 1200);
  popupSafety = setTimeout(closePopup, kind === 'cards' ? 120_000 : (custom ? (custom.grp === 'pray' ? 150_000 : 90_000) : 60_000));   // شبكة أمان أخيرة (الـ renderer بيقفل الإشعار بنفسه بعد انتهاء الصوت)
  return true;
}

function closePopup() {
  clearInterval(undockTimer); undockTimer = null; resetDock();
  clearTimeout(popupSafety); popupSafety = null;
  clearTimeout(popupShowTimer); popupShowTimer = null;
  if (challenge) { clearTimeout(challenge.timer); challenge = null; broadcastState(); }   // إغلاق أثناء التحدي = إلغاؤه
  const kind = popup && popup.kind, w = popupWin, wasInline = !!(popup && popup.inline);
  popup = null; popupWin = null; popupMoved = false; popupDrag = null;
  updateDialCover();                                       // المسبحة ترجع تظهر لو كانت مخفية
  if (wasInline) send('inline:close');                     // المسبحة ترجع لحالتها الطبيعية (لو لسه في وضع الاختيار/التحدي)
  if (w && !w.isDestroyed()) w.destroy();
  lastPopupClosedAt = Date.now();
  if (kind && !exiting) armTimer(kind === 'cards' ? 'challenge' : 'reminder');
  if (popupQueue.length && !exiting) pumpQueue(QUEUE_GAP_MS);   // الإشعار اللي بعده يظهر بعد فاصل صغير
}


// ───────────── دخول/خروج بطاقات الذكر الخفي من المسبحة (سحب) ─────────────
// النافذة المنفصلة لو اتسحبت قريب من المسبحة بتدخل جواها (docking)، ولو اتسحب مربع البطاقات من جوه المسبحة بيطلع نافذة تتبع الماوس.
const DOCK_NEAR = 34, DOCK_ARM = 90, DOCK_DWELL = 420;   // لازم تلزق تقريبًا في المسبحة وتفضل لحظة (مفيش سحب فوري) | لازم تبعد المسافة دي مرة علشان مفيش دخول لو بدأت ملزوق
let undockTimer = null, dockSince = 0, dockHint = false, dockRecheck = null;
function setDockHint(on) { if (on === dockHint) return; dockHint = on; send('inline:hint', on); }   // المسبحة تتوهّج بهدوء = "سيب هنا وهتدخل"
function resetDock() { dockSince = 0; clearTimeout(dockRecheck); dockRecheck = null; setDockHint(false); }
function dialGap() {                      // المسافة بين كارت المسبحة الظاهر وكارت البطاقات الظاهر (0 = متلامسين/متداخلين)
  const d = win.getBounds(), p = popupWin.getBounds(), { pad } = popupDims('cards');
  const a = { l: d.x + GLOW, r: d.x + d.width - GLOW, t: d.y + GLOW, b: d.y + d.height - GLOW };
  const q = { l: p.x + pad.l, r: p.x + p.width - pad.r, t: p.y + pad.t, b: p.y + p.height - pad.b };
  return Math.hypot(Math.max(0, a.l - q.r, q.l - a.r), Math.max(0, a.t - q.b, q.t - a.b));
}
function checkDock() {
  if (!popup || popup.kind !== 'cards' || popup.phase !== 'choose' || popup.inline) return resetDock();
  if (!popupWin || popupWin.isDestroyed() || !dockOk()) return resetDock();
  const g = dialGap();
  if (g > DOCK_ARM) popup.armed = true;
  const ok = g < DOCK_NEAR && (popup.armed || (!popup.fromDial && g === 0));
  if (!ok) return resetDock();                              // ابتعدت: نلغي العدّ والتوهّج
  const now = Date.now();
  if (!dockSince) dockSince = now;
  setDockHint(true);
  if (now - dockSince >= DOCK_DWELL) return dockPopup();    // فضلت قريب لحظة: يدخل
  clearTimeout(dockRecheck);                                // لو الماوس واقف مفيش حركة تعيد الفحص: نعيده بنفسنا
  dockRecheck = setTimeout(checkDock, DOCK_DWELL - (now - dockSince) + 25);
}
function dockPopup() {
  resetDock();
  const w = popupWin; popupWin = null; popupDrag = null;
  clearInterval(undockTimer); undockTimer = null;
  popup.inline = true; popup.free = false; popupMoved = false;
  clearTimeout(popupSafety); popupSafety = setTimeout(closePopup, 120_000);
  send('inline:open');                                      // أنيميشن عادي ناعم (مش السريع): الدايرة تتلاشى ثم يظهر المربع
  if (!w || w.isDestroyed()) return;
  try { w.webContents.send('popup:docking'); } catch (_) {}   // المربع نفسه يعمل Pop صغير وهو بيتصغّر
  const from = w.getBounds(), d = win.getBounds();
  const tx = d.x + d.width / 2 - from.width / 2, ty = d.y + d.height / 2 - from.height / 2;
  const t0 = Date.now(), DUR = 460;
  const iv = setInterval(() => {
    if (w.isDestroyed()) return clearInterval(iv);
    const k = Math.min(1, (Date.now() - t0) / DUR);
    const e = 1 - Math.pow(1 - k, 3);                                           // ease-out: تنزلق وتهدى وهي داخلة (ومربع المسبحة بيعمل Pop)
    const f = Math.max(0, (k - .35) / .65);                                   // التلاشي يبدأ متأخر شوية علشان الحركة تبان
    try { w.setBounds({ x: Math.round(from.x + (tx - from.x) * e), y: Math.round(from.y + (ty - from.y) * e), width: from.width, height: from.height }); w.setOpacity(1 - f * f); } catch (_) {}
    if (k >= 1) { clearInterval(iv); try { w.destroy(); } catch (_) {} }
  }, 16);
}
function finishUndockSwap() {                              // النافذة الجديدة ظهرت: مربع المسبحة يتشال في نفس اللحظة
  if (popup && popup.undockPending) { popup.undockPending = false; send('inline:close'); }
}
function undockPopup() {
  if (!popup || !popup.inline || popup.phase !== 'choose' || !dialShown()) return;
  const kept = popup, c = screen.getCursorScreenPoint(), { W, pad } = popupDims('cards');
  const off = { x: Math.round(W / 2), y: Math.round(pad.t + 24) };
  clearTimeout(popupSafety); popupSafety = null;
  kept.inline = false; kept.armed = false; kept.fromDial = true; kept.free = true; kept.undockPending = true; popup = null;
  popupStartAt = { x: c.x - off.x, y: c.y - off.y };
  showPopup('cards', { reuse: kept });
  popupStartAt = null;
  if (!popupWin) return;
  const t0 = Date.now();
  undockTimer = setInterval(() => {                        // النافذة بتتبع الماوس لحد ما يفلّت الزر (أو 20 ثانية أمان)
    if (!popup || !popupWin || popupWin.isDestroyed() || Date.now() - t0 > 20000) { clearInterval(undockTimer); undockTimer = null; return; }
    const cc = screen.getCursorScreenPoint(), b = popupWin.getBounds();
    popupWin.setBounds({ x: Math.round(cc.x - off.x), y: Math.round(cc.y - off.y), width: b.width, height: b.height });
    popupMoved = true;
    checkDock();
  }, 16);
}
function finishPopupDrag() {                               // نهاية السحب: تثبيت المكان وحفظه (لكل نوع لوحده)
  if (!popup || !popupWin || popupWin.isDestroyed() || !popupMoved) return;
  const b = popupWin.getBounds(), p = clampPopup(popup.kind, b.x, b.y, b.height);
  popupWin.setBounds({ x: p.x, y: p.y, width: b.width, height: b.height });
  if (popup.kind === 'cards') { state.cx = p.x; state.cy = p.y; state.cardsPos = 'saved'; }
  else { state.px = p.x; state.py = p.y; state.popupPos = 'saved'; }
  saveStateSoon(); broadcastState();
}

function startChallenge(index) {
  const c = popup.cards[index];
  popup.phase = 'running'; popup.picked = index;
  const now = Date.now(), reveal = popup.inline ? INLINE_REVEAL_MS : REVEAL_MS;
  challenge = { id: c.id, text: c.text, need: c.need, done: 0, startsAt: now + reveal, endsAt: now + reveal + CHALLENGE_MS, timer: null };
  challenge.timer = setTimeout(() => endChallenge('fail'), reveal + CHALLENGE_MS);
  clearTimeout(popupSafety);
  popupSafety = setTimeout(closePopup, reveal + CHALLENGE_MS + 15_000);
  sendPop('popup:reveal', { index, text: c.text, need: c.need, startsAt: challenge.startsAt, durationMs: CHALLENGE_MS });
  broadcastState();                                        // التطبيق نفسه يتحول لوضع التحدي
  refreshTrayTip();
}

function registerChallengeTick() {
  const c = challenge;
  c.done += 1;
  state.total += 1;
  if (dhikrById(c.id)) {                                   // الإحصائيات بتتحسب (الذكر ممكن يكون اتحذف أثناء التحدي)
    const st = state.stats[c.id] || (state.stats[c.id] = { n: 0, last: 0 });
    st.n += 1; st.last = Date.now();
    bumpDaily(c.id);
  }
  send('tick', { completed: false, shown: null, state: { count: c.done, total: state.total, target: c.need, dhikrId: c.id, dhikrText: c.text, challenge: true } });
  sendPop('popup:tick', { done: c.done, need: c.need });
  scheduleStats();
  saveStateSoon();
  if (c.done >= c.need) endChallenge('success');
}

function endChallenge(result) {                            // 'success' | 'fail'
  if (!challenge) return;
  clearTimeout(challenge.timer);
  const c = challenge; challenge = null;
  if (popup) popup.phase = result;
  sendPop(result === 'success' ? 'popup:success' : 'popup:fail', { done: c.done, need: c.need });
  clearTimeout(popupSafety);
  popupSafety = setTimeout(closePopup, 12_000);            // الصفحة بتقفل نفسها بعد الأنيميشن؛ ده احتياطي
  setTimeout(broadcastState, result === 'success' ? 900 : 0);   // الدايل يبان مكتمل لحظة ثم يرجع طبيعي
  refreshTrayTip();
}

// preload إضافي (بيتحمّل جنب preload.js على كل النوافذ): بيعرّض window.wzx للتنبيهات المخصصة فقط
function registerExtraPreload() {
  const file = path.join(__dirname, 'preload-ext.js');
  try {
    const ses = require('electron').session.defaultSession;
    if (typeof ses.registerPreloadScript === 'function') ses.registerPreloadScript({ type: 'frame', filePath: file });   // Electron 35+
    else ses.setPreloads([...ses.getPreloads(), file]);                                                                  // Electron 33
  } catch (err) { console.error('preload-ext:', err); }
}

// ───────────── IPC (بتتسجل مرة واحدة فقط) ─────────────
ipcMain.handle('state:get', e => ({ ...((win && e.sender === win.webContents) ? viewState() : publicState()), audio: audioFiles }));
ipcMain.handle('stats:get', () => statsPayload());
ipcMain.on('state:patch', (_e, p) => applyPatch(p));
ipcMain.on('tick:click', e => {                            // تسبيح بالنقر على العدّاد (من نافذة الدايل فقط)
  if ((!state.clickOn && state.dialStyle !== 'beads' && state.dialStyle !== 'strand') || exiting || !win || win.isDestroyed() || e.sender !== win.webContents) return;
  registerTick();
});
ipcMain.handle('dhikr:add', (_e, text) => addDhikr(text));
ipcMain.handle('dhikr:delete', (_e, id) => deleteDhikr(String(id)));
ipcMain.on('ui:hitrects', (_e, rects) => {                // مستطيلات العناصر التفاعلية (الـ click-through)
  if (!Array.isArray(rects)) return;
  hitRects = rects.slice(0, 64)
    .filter(r => r && [r.x, r.y, r.w, r.h].every(Number.isFinite))
    .map(r => ({ x: r.x, y: r.y, w: r.w, h: r.h }));
});
ipcMain.on('ui:alive', () => { lastAlive = Date.now(); });   // الـ renderer استقبل حدث ماوس فعلًا
ipcMain.on('ui:hold', (_e, on) => { holding = !!on; if (holding) setIgnore(false); });
ipcMain.on('settings:open', (_e, focus) => openSettingsWindow(typeof focus === 'string' ? focus : null));
ipcMain.on('settings:close', () => { if (settingsWin && !settingsWin.isDestroyed()) settingsWin.close(); });
ipcMain.on('win:minimize', () => { if (vis === 'shown' && !state.miniMode) applyPatch({ miniMode: true }); });   // "–" = Mini Mode (التصغير لشريط المهام لسه متاح من منيو الـ Tray)
ipcMain.on('win:hide', hideOverlay);                       // Hide to Tray (من الإعدادات/المنيو)
ipcMain.on('app:quit', () => app.quit());                  // "✕" = إغلاق كامل

// الإشعار المنبثق: كل الأوامر بتتقبل بس من نافذة الإشعار نفسها
const fromPopup = e => (popup && popup.inline)
  ? (!!win && !win.isDestroyed() && e.sender === win.webContents)      // الوضع الداخلي: الأوامر بتيجي من نافذة المسبحة نفسها
  : (!!popupWin && !popupWin.isDestroyed() && e.sender === popupWin.webContents);
ipcMain.handle('popup:get', e => {
  if (!popup || !fromPopup(e)) return null;
  const cgrp = popup.custom && popup.custom.grp;
  return {                                                 // نص الأذكار العشوائية ما بيتبعتش إلا بعد اختيار البطاقة
    kind: popup.kind, scale: popupScaleOf(popup.kind), cards: popup.cards ? popup.cards.length : 0,
    verse: popup.verse, custom: popup.custom, capSec: cgrp === 'pray' ? 120 : CUSTOM_PLAY_CAP_S,
    reminderSound: popup.preview ? true : (cgrp === 'az' ? state.azSound : cgrp === 'wird' ? state.wirdSound : cgrp === 'pray' ? state.prayerSound : state.reminderSound),
    reminderVolume: cgrp === 'az' ? state.azVolume : cgrp === 'wird' ? state.wirdVolume : cgrp === 'pray' ? state.prayerVolume : state.reminderVolume,   // المعاينة بتشغّل الصوت حتى لو صوت التنبيه مقفول
    popupVolume: state.popupVolume, audio: { reminder: audioFiles.reminder, reminder2: audioFiles.reminder2, challenge: audioFiles.challenge, hover: audioFiles.hover, done: audioFiles.done },
    challengeMs: CHALLENGE_MS, revealMs: REVEAL_MS
  };
});
ipcMain.on('popup:fit', (e, h) => {
  if (!fromPopup(e) || !Number.isFinite(h)) return;
  if (!popup) return;
  popupCssH = Math.min(720, Math.max(60, Math.ceil(h))); popupHz = popupZSent;   // الصفحة بتبلّغ بارتفاعها بعد الحجم (بكسل نافذة فعلي)
  const { W } = popupDims(popup.kind), height = popupCssH;
  const cur = popupWin.getBounds();
  const p = popupMoved ? clampPopup(popup.kind, cur.x, cur.y, height) : popupPlace(popup.kind, height);   // لو اتسحب يفضل في مكانه
  popupWin.setBounds({ x: p.x, y: p.y, width: W, height });
  if (!popupWin.isVisible()) { clearTimeout(popupShowTimer); popupWin.showInactive(); }
  finishUndockSwap();
});
ipcMain.on('popup:pick', (e, i) => {
  if (!fromPopup(e) || !popup || popup.kind !== 'cards' || popup.phase !== 'choose') return;
  i = Number(i);
  if (Number.isInteger(i) && popup.cards[i]) startChallenge(i);
});
ipcMain.on('popup:close', e => { if (fromPopup(e)) closePopup(); });
// سحب الإشعار بالماوس (بنحسب الحركة من مكان الماوس على الشاشة علشان تفضل دقيقة مهما كان حجم الإشعار)
ipcMain.on('popup:dragstart', e => {
  if (!fromPopup(e)) return;
  const b = popupWin.getBounds(), c = screen.getCursorScreenPoint();
  popupDrag = { x: b.x, y: b.y, cx: c.x, cy: c.y };
});
ipcMain.on('popup:dragmove', e => {
  if (!fromPopup(e) || !popupDrag || !popup) return;
  const c = screen.getCursorScreenPoint(), b = popupWin.getBounds();
  popupMoved = true;
  popupWin.setBounds({ x: Math.round(popupDrag.x + c.x - popupDrag.cx), y: Math.round(popupDrag.y + c.y - popupDrag.cy), width: b.width, height: b.height });
  if (popup.kind === 'cards' && !popup.free) { popup.free = true; updateDialCover(); }   // اتسحبت: المسبحة تظهر تاني
  checkDock();                                             // قرّبته من المسبحة؟ يدخل جواها
});
ipcMain.on('popup:dragend', e => {
  if (!fromPopup(e) || !popupDrag || !popup) return;
  popupDrag = null;
  if (!popupMoved) return;
  if (dockHint && dockSince) return dockPopup();            // سيبته وهو لازق في المسبحة: يدخل بنعومة
  resetDock();
  finishPopupDrag();
});
ipcMain.on('popup:test', (_e, kind) => {                   // معاينة من الإعدادات
  if (kind === 'athan') {                                  // معاينة الأذان من الإعدادات
    if (popup) closePopup();
    const t = prayerMins(), now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();   // المعاينة بتكتب اسم الصلاة الجاية (أو الفجر لو مفيش مواقيت)
    const nk = (t && ['fj', 'dh', 'as', 'mg', 'is'].find(k => t[k] > nowMin)) || 'fj';
    showPopup('verse', { custom: { text: 'حان الآن موعد صلاة ' + PRAYER_NAMES[nk], src: audioFiles.athan, grp: 'pray', ico: 'ad' }, preview: true });
    return;
  }
  if (kind !== 'verse' && kind !== 'cards') return;
  if (popup) closePopup();
  showPopup(kind);
});
// التنبيهات المخصصة: الأوامر بتتقبل بس من نافذة الإعدادات نفسها
const fromSettings = e => !!settingsWin && !settingsWin.isDestroyed() && e.sender === settingsWin.webContents;
ipcMain.on('settings:wide', (e, on) => {              // توسيع/تصغير نافذة الإعدادات حوالين مركزها الحالي
  if (!fromSettings(e)) return;
  const b = settingsWin.getBounds(), wa = screen.getDisplayMatching(b).workArea;
  const tw = Math.min((on ? SETTINGS_WIDE : SETTINGS_SIZE).w, wa.width - (on ? 20 : 40));
  const th = Math.min((on ? SETTINGS_WIDE : SETTINGS_SIZE).h, wa.height - (on ? 20 : 40));
  if (tw === b.width && th === b.height) return;
  const x = Math.max(wa.x, Math.min(wa.x + wa.width - tw, Math.round(b.x + b.width / 2 - tw / 2)));
  const y = Math.max(wa.y, Math.min(wa.y + wa.height - th, Math.round(b.y + b.height / 2 - th / 2)));
  settingsWin.setBounds({ x, y, width: tw, height: th });
});
// ───────────── لقطة الآية (المصحف): حفظ الصورة في Pictures/WZAKER + اللوجو ─────────────
const shotDir = () => path.join(app.getPath('pictures'), 'WZAKER');
ipcMain.handle('img:save', (e, dataUrl, name) => {
  if (!fromSettings(e)) return { ok: false };
  try {
    const pre = 'data:image/png;base64,', d = String(dataUrl || '');
    if (!d.startsWith(pre) || d.length > 60e6) return { ok: false };
    const dir = shotDir(); fs.mkdirSync(dir, { recursive: true });
    const safe = String(name || 'ayah').replace(/\.png$/i, '').replace(/[^\w\-]/g, '_').slice(0, 80) || 'ayah';
    const file = path.join(dir, safe + '.png');
    fs.writeFileSync(file, Buffer.from(d.slice(pre.length), 'base64'));
    return { ok: true, path: file };
  } catch (_) { return { ok: false }; }
});
ipcMain.on('img:show', (e, p) => {
  if (!fromSettings(e) || typeof p !== 'string') return;
  const f = path.resolve(p);
  if (f.startsWith(path.resolve(shotDir()) + path.sep)) { try { shell.showItemInFolder(f); } catch (_) {} }
});
let logoData = null;
ipcMain.handle('img:logo', e => {
  if (!fromSettings(e)) return null;
  if (logoData) return logoData;
  try { logoData = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'assets', 'logo.png')).toString('base64'); } catch (_) { logoData = null; }
  return logoData;
});
let bannerData = null;
ipcMain.handle('img:banner', e => {                        // زخرفة لافتة اسم السورة في لقطة الآية
  if (!fromSettings(e)) return null;
  if (bannerData) return bannerData;
  try { bannerData = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'assets', 'shot-banner.png')).toString('base64'); } catch (_) { bannerData = null; }
  return bannerData;
});
ipcMain.handle('alerts:list', e => (fromSettings(e) ? alertsList() : []));
ipcMain.handle('alerts:save', (e, d) => (fromSettings(e) ? saveAlert(d) : { ok: false }));
ipcMain.handle('alerts:delete', (e, id) => (fromSettings(e) ? deleteAlert(String(id)) : { ok: false }));
ipcMain.handle('alerts:toggle', (e, id, on) => (fromSettings(e) ? toggleAlert(String(id), on) : { ok: false }));
ipcMain.handle('alerts:pick', e => (fromSettings(e) ? pickSound() : { ok: false }));
ipcMain.on('alerts:preview', (e, d) => {                   // معاينة من النموذج (قبل الحفظ)
  if (!fromSettings(e)) return;
  const text = normText(d && d.text);
  if (!text || [...text].length > MAX_ALERT_LEN) return;
  const snd = cleanSound(d && d.sound, true);
  if (popup) closePopup();
  showPopup('verse', { custom: { text, src: soundSrc(snd.sound) }, preview: true });
});
ipcMain.on('inline:undock', e => { if (win && !win.isDestroyed() && e.sender === win.webContents) undockPopup(); });
ipcMain.on('inline:dragend', e => {                        // الماوس اتفلّت بعد سحب البطاقات بره المسبحة
  if (!win || win.isDestroyed() || e.sender !== win.webContents || !undockTimer) return;
  clearInterval(undockTimer); undockTimer = null;
  if (popup) popup.fromDial = false;                       // بعد ما فلّت: أي سحب جاي سحب عادي
  if (dockHint && dockSince) return dockPopup();
  resetDock();
  finishPopupDrag();
});
ipcMain.on('az:test', (e, k) => {                         // معاينة تنبيه الصباح/المساء/الورد (من الإعدادات)
  if (!fromSettings(e)) return;
  const s = AZ_SLOTS.find(x => x.k === k); if (!s) return;
  if (popup) closePopup();
  azPopup(s, true);
});
ipcMain.on('key:capture', (e, target) => {                   // الإعدادات: "اضغط الزر اللي عاوزه"
  if (!fromSettings(e)) return;
  captureTarget = HOTKEY_ACTIONS.includes(target) ? target : 'custom';
  capturingKey = true; syncKeyHook();
  clearTimeout(captureTimer); captureTimer = setTimeout(() => stopCapture(true), 15000);   // مفيش ضغطة: نلغي لوحدنا
});
ipcMain.on('key:cancel', e => { if (fromSettings(e)) stopCapture(true); });
// روابط التواصل مع المطور/الاقتراحات (من زر "تواصل مع المطور" في الإعدادات): قائمة ثابتة بس، وبتتفتح في المتصفح الافتراضي
const CONTACT_LINKS = {
  fb: 'https://www.facebook.com/AKA.AlHussin',
  dc: 'https://discord.com/users/339177356843548673',
  wa: 'https://wa.link/lv4cu4',
  sg: 'https://tally.so/r/QKgVQl'
};
ipcMain.on('contact:open', (e, k) => { if (fromSettings(e) && Object.prototype.hasOwnProperty.call(CONTACT_LINKS, k)) shell.openExternal(CONTACT_LINKS[k]).catch(() => {}); });
ipcMain.on('min:copy', e => { if (fromSettings(e)) clipboard.writeText('https://www.alminshawi.com'); });
ipcMain.on('splash:phase', (e, p) => {
  if (!splashWin || splashWin.isDestroyed() || e.sender !== splashWin.webContents) return;
  if (p === 'ready') { splashReady = true; trySplashGo(); }          // إنميشن اللوجو خلص: ننتظر صوت التشغيل لو لسه شغّال
  else if (p === 'fade') { splashHold = false; maybePresentOverlay(); }
  else if (p === 'done') endSplash();
});
ipcMain.on('startup:done', () => { startupPending = false; trySplashGo(); });   // صوت "فسبحان الله" خلّص
ipcMain.on('startup:near-end', () => { earlyPresent = true; maybePresentOverlay(); });   // باقي ~1.25 ثانية على نهاية الصوت
ipcMain.on('exit:done', () => { if (exiting) finalizeExit(); });   // الـ renderer خلّص صوت "لسانك"

// سحب النافذة يدويًا (drag-region مش بتتوافق مع click-through)
let dragOrigin = null;
ipcMain.on('drag:start', () => { if (state.dialLocked) return; if (win && !win.isDestroyed() && vis === 'shown') { const [x, y] = win.getPosition(); dragOrigin = { x, y }; setIgnore(false); } });
ipcMain.on('drag:move', (_e, d) => {
  if (!win || win.isDestroyed() || !dragOrigin || !d || !Number.isFinite(d.dx) || !Number.isFinite(d.dy)) return;
  const s = size();
  win.setBounds({ x: Math.round(dragOrigin.x + d.dx), y: Math.round(dragOrigin.y + d.dy), width: s.w, height: s.h });
});
ipcMain.on('drag:end', () => { dragOrigin = null; rememberPosition(); });

// ───────────── دورة حياة التطبيق + الإغلاق النهائي ─────────────
app.on('second-instance', () => { if (!exiting) showOverlay(); });

if (gotLock) {
  app.whenReady().then(() => {
    if (process.platform === 'win32') app.setAppUserModelId('com.wzaker.app');
    if (DEBUG) { try { fs.writeFileSync(path.join(app.getPath('userData'), 'azkar-debug.log'), ''); } catch (_) {} }
    loadState();
    scanAudio();
    registerExtraPreload();
    setInterval(azCheck, 20_000); setTimeout(azCheck, 8_000);
  updInit(); setTimeout(() => autoBackup(false), 30_000); setInterval(() => autoBackup(false), 30 * 60_000);
  setTimeout(() => checkAch(true), 6_000); setInterval(() => checkAch(true), 60_000); if (state.prayerAlert && state.prayerCity === 'auto') setTimeout(prayerLocate, 3_000);   // أذكار الصباح/المساء: فحص دوري بتوقيت الجهاز                                // preload-ext.js: واجهة التنبيهات المخصصة (window.wzx) من غير ما نلمس preload.js
    cleanupSoundFiles();
    createSplash();                                        // اللوجو بإنميشن ثم Fade Out (الدايل بيظهر مع بداية الـ Fade)
    createWindow();
    try { createTray(); } catch (err) { console.error('tray:', err); }   // فشل الـ Tray ما يوقفش باقي الإقلاع (الـ hook/الاختصار)
    startHook();
    syncAutoLaunch();
    globalShortcut.register(TOGGLE_SHORTCUT, toggleOverlay);
    armTimer('reminder'); armTimer('challenge');           // مؤقتات التنبيه (لو متفعّلة)
    syncDndWatch();                                        // عدم الإزعاج أثناء ملء الشاشة (لو متفعّل)
  });
}

const EXIT_VOICE_MAX_MS = 9000;   // شبكة أمان لو الـ renderer ما رجّعش "خلّصت"
let exitTimer = null;

// تنظيف الموارد: بيتنفذ فقط عند الإغلاق النهائي (مش عند Minimize / Tray / Mini Mode)
function releaseResources() {
  stopHook();                                              // Global Mouse + Keyboard Hook
  stopHitTimer();
  try { if (dndProc) dndProc.kill(); } catch (_) {} dndProc = null;   // PowerShell بتاع كشف ملء الشاشة
  clearTimeout(tipTimer); clearTimeout(menuTimer); clearTimeout(statsTimer);
  try { globalShortcut.unregisterAll(); } catch (_) {}
  capturePosition();
  saveStateNow();                                          // الإعدادات + المواقع + مستويات الصوت
  if (tray) { try { tray.destroy(); } catch (_) {} tray = null; }
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.destroy();
  clearTimeout(popupTimers.reminder); clearTimeout(popupTimers.challenge);
  popupQueue.length = 0; clearTimeout(queueTimer); queueTimer = null;
  clearTimeout(popupSafety); clearTimeout(popupShowTimer); clearTimeout(splashTimer);
  if (challenge) { clearTimeout(challenge.timer); challenge = null; }
  popup = null;
  if (popupWin && !popupWin.isDestroyed()) popupWin.destroy();
  if (splashWin && !splashWin.isDestroyed()) splashWin.destroy();
}

function beginExit(allowVoice) {
  if (exiting) return;
  exiting = true; quitting = true;
  try { saveStateNow(); autoBackup(false); } catch (_) {}
  const voice = allowVoice && !skipExitVoice && state.exitSound && state.exitVolume > 0 &&
                !!audioFiles.exit && !!win && !win.isDestroyed() && !win.webContents.isLoading();
  releaseResources();
  if (!voice) { finalizeExit(); return; }
  if (win.isMinimized()) win.restore();
  win.hide();                                              // الواجهة تختفي، والـ renderer يكمل تشغيل الصوت
  send('exit:play', { volume: state.exitVolume });         // "لسانك": مرة واحدة فقط وهنا فقط
  exitTimer = setTimeout(finalizeExit, EXIT_VOICE_MAX_MS);
}
function finalizeExit() {
  if (finalizing) return;
  finalizing = true;
  clearTimeout(exitTimer);
  if (win && !win.isDestroyed()) win.destroy();
  app.exit(0);
}

app.on('before-quit', e => { if (finalizing) return; e.preventDefault(); beginExit(true); });
app.on('window-all-closed', () => { if (!exiting) app.quit(); });

process.on('uncaughtException', err => { console.error(err); skipExitVoice = true; try { beginExit(false); } catch (_) {} app.exit(1); });
process.on('unhandledRejection', err => console.error(err));
process.on('SIGINT', () => { skipExitVoice = true; app.quit(); });
process.on('SIGTERM', () => { skipExitVoice = true; app.quit(); });
process.on('exit', () => { try { stopHook(); } catch (_) {} });

// للاختبارات التلقائية فقط (npm test): ما بيأثرش على التشغيل العادي
if (process.env.WZ_TEST === '1') {
  module.exports = { getState: () => state, setState: s => { state = s; }, dayKeyOf, dateAgo, dayShift, dayDiff, nextDayKey, rebuildStreak, normStreak, streakTouch, streakView, bumpDaily, khatmaView, khatmaReset, sanitizeKey, sanitizeAlerts, statsList, DEFAULT_STATE, KH_PAGES, hookInfo, setHookStatus, restartHook, stopHook, buildTrayMenu, MAX_ALERTS, MAX_ALERT_LEN };
}
