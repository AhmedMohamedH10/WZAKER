'use strict';
// تشغيل: npm test  (Node 20+، من غير Electron)
process.env.TZ = 'Africa/Cairo';          // مصر فيها توقيت صيفي: أصعب حالة للتواريخ
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const m = require('./harness.js');

const fresh = () => {
  const st = JSON.parse(JSON.stringify(m.DEFAULT_STATE));
  st.daily = {}; st.streak = null; st.stats = {};
  st.khatma = { bits: '0'.repeat(604), start: '2026-10-01', days: 30, count: 0, today: { d: '', n: 0 } };
  m.setState(st);
  return st;
};
const at = iso => mock.timers.enable({ apis: ['Date'], now: new Date(iso) });
afterEach(() => mock.timers.reset());

describe('بيئة الاختبار', () => {
  test('المنطقة الزمنية القاهرة وفيها توقيت صيفي', () => {
    assert.equal(new Date('2026-07-01T12:00:00Z').getTimezoneOffset(), -180);   // صيفي UTC+3
    assert.equal(new Date('2026-01-01T12:00:00Z').getTimezoneOffset(), -120);   // شتوي UTC+2
  });
});

describe('dayKeyOf / dayDiff / nextDayKey', () => {
  test('تنسيق YYYY-MM-DD بصفر على اليسار', () => {
    assert.equal(m.dayKeyOf(new Date(2026, 0, 5)), '2026-01-05');
    assert.equal(m.dayKeyOf(new Date(2026, 11, 31)), '2026-12-31');
  });
  test('nextDayKey بيعدّي الشهر والسنة والكبيسة', () => {
    assert.equal(m.nextDayKey('2026-01-31'), '2026-02-01');
    assert.equal(m.nextDayKey('2026-12-31'), '2027-01-01');
    assert.equal(m.nextDayKey('2028-02-28'), '2028-02-29');
  });
  test('dayDiff فرق تقويمي ثابت حتى مع تغيير الساعة', () => {
    assert.equal(m.dayDiff('2026-04-23', '2026-04-25'), 2);   // بداية التوقيت الصيفي في مصر 24 أبريل
    assert.equal(m.dayDiff('2026-10-28', '2026-10-30'), 2);   // نهايته 29 أكتوبر
    assert.equal(m.dayDiff('2026-10-01', '2026-10-01'), 0);
    assert.equal(m.dayDiff('2026-12-30', '2027-01-02'), 3);
  });
});

describe('dateAgo / dayShift مع التوقيت الصيفي (إصلاح 864e5)', () => {
  test('بعد بداية الصيفي بنص ساعة: امبارح هو 24 أبريل مش 23', () => {
    at('2026-04-24T21:30:00Z');                              // = 25 أبريل 00:30 بتوقيت القاهرة (UTC+3)
    assert.equal(m.dayKeyOf(new Date()), '2026-04-25');
    assert.equal(m.dayShift(1), '2026-04-24');
    const legacy = m.dayKeyOf(new Date(Date.now() - 864e5)); // الحساب القديم
    assert.equal(legacy, '2026-04-23', 'الطريقة القديمة كانت بتتخطى يوم');
  });
  test('أسبوع كامل من غير تكرار ولا تخطّي', () => {
    for (const iso of ['2026-04-24T21:30:00Z', '2026-10-29T21:30:00Z', '2026-10-30T21:30:00Z']) {
      mock.timers.reset(); at(iso);
      const keys = Array.from({ length: 7 }, (_, i) => m.dayShift(i));
      assert.equal(new Set(keys).size, 7, iso + ' ' + keys.join());
      for (let i = 0; i < 6; i++) assert.equal(m.nextDayKey(keys[i + 1]), keys[i]);
    }
  });
});

describe('السلاسل (streak)', () => {
  test('rebuildStreak: أيام متتالية وفجوات وتجاهل الأصفار والمفاتيح التالفة', () => {
    const st = fresh();
    st.daily = {
      '2026-10-01': { d0: 5 }, '2026-10-02': { d0: 1 }, '2026-10-03': { d0: 2 },
      '2026-10-05': { d0: 4 }, '2026-10-06': { d0: 0 }, '2026-10-07': { d0: 9 },
      'garbage': { d0: 7 }, '2026-1-8': { d0: 7 },
    };
    m.rebuildStreak();
    assert.deepEqual(st.streak, { cur: 1, best: 3, last: '2026-10-07', days: 5 });
  });
  test('rebuildStreak على بيانات فاضية', () => {
    const st = fresh(); m.rebuildStreak();
    assert.deepEqual(st.streak, { cur: 0, best: 0, last: '', days: 0 });
  });
  test('streakTouch: أول تسبيحة، نفس اليوم، يوم بعده، فجوة', () => {
    const st = fresh();
    at('2026-10-10T09:00:00Z'); m.streakTouch();
    assert.deepEqual(st.streak, { cur: 1, best: 1, last: '2026-10-10', days: 1 });
    m.streakTouch();                                          // نفس اليوم: ما يتغيّرش
    assert.deepEqual(st.streak, { cur: 1, best: 1, last: '2026-10-10', days: 1 });
    mock.timers.reset(); at('2026-10-11T09:00:00Z'); m.streakTouch();
    assert.deepEqual(st.streak, { cur: 2, best: 2, last: '2026-10-11', days: 2 });
    mock.timers.reset(); at('2026-10-14T09:00:00Z'); m.streakTouch();   // فاتت يومين
    assert.deepEqual(st.streak, { cur: 1, best: 2, last: '2026-10-14', days: 3 });
  });
  test('السلسلة بتكمل عبر ليلة تغيير الساعة (24 → 25 أبريل)', () => {
    const st = fresh();
    at('2026-04-24T12:00:00Z'); m.streakTouch();              // 24 أبريل 15:00
    mock.timers.reset(); at('2026-04-24T21:30:00Z'); m.streakTouch();   // 25 أبريل 00:30
    assert.equal(st.streak.cur, 2);
  });
  test('streakView: بتصفّر الحالية لو فات يوم، وبتحتفظ بالأفضل', () => {
    const st = fresh();
    st.streak = { cur: 5, best: 9, last: '2026-10-10', days: 20 };
    at('2026-10-11T09:00:00Z');                                // امبارح كان فيه تسبيح
    assert.equal(m.streakView().cur, 5);
    assert.equal(m.streakView().doneToday, false);
    mock.timers.reset(); at('2026-10-12T09:00:00Z');           // فات يوم كامل
    const v = m.streakView();
    assert.equal(v.cur, 0); assert.equal(v.best, 9); assert.equal(v.dots.length, 14);
  });
  test('normStreak: بيانات تالفة بتتبني من جديد، والقيم بتتنظّف', () => {
    const st = fresh(); st.daily = { '2026-10-01': { d0: 1 }, '2026-10-02': { d0: 1 } };
    st.streak = { cur: 'x', best: 1, last: 3, days: 1 }; m.normStreak();
    assert.equal(st.streak.best, 2);
    st.streak = { cur: -4.7, best: 1, last: '2026-10-02', days: 2.9 }; m.normStreak();
    assert.deepEqual(st.streak, { cur: 0, best: 1, last: '2026-10-02', days: 2 });
  });
  test('bumpDaily: بيعدّ ويمسح اللي أقدم من 40 يوم', () => {
    const st = fresh(); at('2026-10-18T09:00:00Z');
    st.daily = { '2026-08-01': { d0: 3 }, '2026-09-20': { d0: 3 } };
    m.bumpDaily('d0'); m.bumpDaily('d0'); m.bumpDaily('d1');
    assert.deepEqual(st.daily['2026-10-18'], { d0: 2, d1: 1 });
    assert.ok(!('2026-08-01' in st.daily));
    assert.ok('2026-09-20' in st.daily);
    assert.equal(st.streak.cur, 1);
  });
});

describe('الختمة', () => {
  test('khatmaReset: بيصفّر ويقبل مدة صحيحة بس', () => {
    const st = fresh(); at('2026-10-18T09:00:00Z');
    st.khatma.bits = '1'.repeat(604);
    m.khatmaReset(60);
    assert.equal(st.khatma.bits, '0'.repeat(604)); assert.equal(st.khatma.start, '2026-10-18'); assert.equal(st.khatma.days, 60);
    for (const bad of [0, 366, 1.5, NaN, undefined, '7']) { m.khatmaReset(bad); assert.equal(st.khatma.days, 60, String(bad)); }
    m.khatmaReset(1); assert.equal(st.khatma.days, 1);
    m.khatmaReset(365); assert.equal(st.khatma.days, 365);
  });
  test('khatmaView: الورد اليومي بالتقريب لفوق والأيام المتبقية', () => {
    const st = fresh(); at('2026-10-11T09:00:00Z');            // اليوم 11 من أكتوبر والبداية 1 أكتوبر
    st.khatma.bits = '1'.repeat(100) + '0'.repeat(504);
    const v = m.khatmaView();
    assert.equal(v.read, 100); assert.equal(v.total, 604);
    assert.equal(v.elapsed, 10); assert.equal(v.left, 20);
    assert.equal(v.perDay, Math.ceil(504 / 20));
  });
  test('khatmaView: بعد انتهاء المدة left=1 مش صفر ولا سالب', () => {
    const st = fresh(); at('2026-12-31T09:00:00Z');
    const v = m.khatmaView();
    assert.equal(v.left, 1); assert.equal(v.perDay, 604);
  });
  test('khatmaView: ما بيتخطّاش يوم عند بداية الصيفي', () => {
    const st = fresh(); st.khatma.start = '2026-04-20';
    at('2026-04-24T21:30:00Z');                                // 25 أبريل 00:30
    assert.equal(m.khatmaView().elapsed, 5);
  });
  test('khatmaView: ما بيقفزش يوم قبل منتصف الليل لما الساعة ترجع (29 أكتوبر)', () => {
    const st = fresh(); st.khatma.start = '2026-10-28';
    at('2026-10-29T21:30:00Z');                                // 23:30 الساعة الثانية (UTC+2)
    assert.equal(m.dayKeyOf(new Date()), '2026-10-29');
    assert.equal(m.khatmaView().elapsed, 1);
    const legacy = Math.floor((Date.now() - new Date('2026-10-28T00:00:00').getTime()) / 864e5);
    assert.equal(legacy, 2, 'الحساب القديم كان بيطلع يوم زيادة');
  });
  test('todayRead بيتصفّر لو اليوم اتغيّر', () => {
    const st = fresh(); at('2026-10-18T09:00:00Z');
    st.khatma.today = { d: '2026-10-17', n: 12 };
    assert.equal(m.khatmaView().todayRead, 0);
    st.khatma.today = { d: '2026-10-18', n: 12 };
    assert.equal(m.khatmaView().todayRead, 12);
  });
});

describe('sanitizeKey', () => {
  test('بيقبل زر صحيح ويحوّل الـ flags لـ boolean ويقصّ الاسم', () => {
    const k = m.sanitizeKey({ code: 57, ctrl: 1, alt: 0, shift: 'x', meta: null, name: 'x'.repeat(100) });
    assert.deepEqual(k, { code: 57, ctrl: true, alt: false, shift: true, meta: false, name: 'x'.repeat(40) });
  });
  test('بيرفض أكواد غير صالحة', () => {
    for (const bad of [null, undefined, 5, {}, { code: 0 }, { code: -1 }, { code: 1.5 }, { code: 0x10000 }, { code: '57' }]) assert.equal(m.sanitizeKey(bad), null, JSON.stringify(bad));
  });
});

describe('sanitizeAlerts', () => {
  test('بيشيل المكرر والفاضي والطويل ويعتبر enabled افتراضي', () => {
    const out = m.sanitizeAlerts([
      { id: 'a', text: '  سبحان   الله ' }, { id: 'a', text: 'مكرر' }, { id: '', text: 'بلا id' },
      { id: 'b', text: '   ' }, { id: 'c', text: 'x'.repeat(m.MAX_ALERT_LEN + 1) },
      { id: 'd', text: 'تمام', enabled: false }, null, 5,
    ]);
    assert.deepEqual(out.map(a => [a.id, a.text, a.enabled]), [['a', 'سبحان الله', true], ['d', 'تمام', false]]);
  });
  test('مش مصفوفة = مصفوفة فاضية، والعدد الأقصى محترم', () => {
    assert.deepEqual(m.sanitizeAlerts(null), []);
    const many = Array.from({ length: m.MAX_ALERTS + 10 }, (_, i) => ({ id: 'i' + i, text: 't' + i }));
    assert.equal(m.sanitizeAlerts(many).length, m.MAX_ALERTS);
  });
});

describe('حالة الـ hook (ميزة جديدة)', () => {
  const uio = m.__uio, okStart = uio.start;
  beforeEach(() => { m.stopHook(); uio.start = okStart; });
  afterEach(() => { uio.start = okStart; m.stopHook(); });

  test('تشغيل ناجح = ok', () => {
    fresh(); m.restartHook(true);                            // لسه ما اشتغلش: manual بيعمل startHook
    assert.equal(m.hookInfo.status, 'ok');
  });
  test('فشل إعادة التشغيل: restarting ثم failed بعد 3 محاولات (3ث، 10ث، 30ث)', () => {
    fresh(); m.restartHook(true); assert.equal(m.hookInfo.status, 'ok');
    mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.now() });
    uio.start = () => { throw new Error('boom'); };
    m.restartHook(true); assert.equal(m.hookInfo.status, 'restarting'); assert.equal(m.hookInfo.error, 'boom');
    mock.timers.tick(3000);  assert.equal(m.hookInfo.status, 'restarting');
    mock.timers.tick(10000); assert.equal(m.hookInfo.status, 'restarting');
    mock.timers.tick(30000); assert.equal(m.hookInfo.status, 'failed');
  });
  test('لو المحاولة التانية نجحت يرجع ok ويتصفّر العدّاد', () => {
    fresh(); m.restartHook(true);
    mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.now() });
    uio.start = () => { throw new Error('boom'); };
    m.restartHook(true); assert.equal(m.hookInfo.status, 'restarting');
    uio.start = okStart; mock.timers.tick(3000);
    assert.equal(m.hookInfo.status, 'ok'); assert.equal(m.hookInfo.error, '');
  });
  test('إعادة التشغيل التلقائي بتتجاهل لو أقل من ثانيتين، واليدوي لأ', () => {
    fresh(); m.restartHook(true);
    mock.timers.enable({ apis: ['Date'], now: Date.now() });
    const n = m.hookInfo.restarts;
    m.restartHook(true); m.restartHook(); m.restartHook();
    assert.equal(m.hookInfo.restarts, n + 1);
  });
  test('منيو الـ Tray فيه زر الإعادة وقت العطل بس', () => {
    fresh(); m.restartHook(true);
    const hasBtn = () => m.buildTrayMenu().some(i => /العدّ بالسكرول متوقف/.test(i.label || ''));
    assert.equal(hasBtn(), false);
    m.setHookStatus('failed', 'x'); assert.equal(hasBtn(), true);
    m.setHookStatus('ok'); assert.equal(hasBtn(), false);
  });
});
