'use strict';
// اختبارات حماية ملف الحفظ: كتابة ذرّية + جارد + نسخة خارجية + استرجاع. تشغيل: npm test
const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const m = require('./harness.js');

const dlg = m.__electron.dialog;
let asked;
const answer = n => { asked = []; dlg.showMessageBoxSync = opts => { asked.push(opts); return n; }; };
const bkOf = (total, extra = {}) => ({ app: 'WZAKER', v: 1, ver: '0.0.0-test', at: '2026-10-30T10:00:00.000Z', state: { ...JSON.parse(JSON.stringify(m.DEFAULT_STATE)), total, cycles: 7, ...extra }, quran: null });
const writeExt = o => { fs.mkdirSync(m.extDir(), { recursive: true }); fs.writeFileSync(m.extFile(), JSON.stringify(o)); };
const rd = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const USB = path.join(m.__tmp, 'usb', 'WZAKER-Backup');
const clean = () => {
  try { fs.rmSync(path.join(m.__tmp, 'usb'), { recursive: true, force: true }); } catch (_) {}
  for (const f of [m.stateFile(), m.extFile(), m.extPointer(), m.legacyFile(), m.legacyMarker(), path.join(m.__tmp, 'guard-suspect.json')]) { try { fs.unlinkSync(f); } catch (_) {} }
  for (const f of fs.readdirSync(m.__tmp)) if (/^azkar-state\.bad-/.test(f)) fs.unlinkSync(path.join(m.__tmp, f));
  try { fs.rmSync(path.join(m.extDir(), 'archive'), { recursive: true, force: true }); } catch (_) {}
};
beforeEach(() => { clean(); answer(0); dlg.showMessageBox = () => new Promise(() => {}); });

describe('writeFileAtomic', () => {
  test('بيكتب ويبدّل المحتوى ومبيسيبش ملف مؤقت', () => {
    const f = path.join(m.__tmp, 'x.json');
    m.writeFileAtomic(f, '{"a":1}'); m.writeFileAtomic(f, '{"a":2}');
    assert.equal(fs.readFileSync(f, 'utf8'), '{"a":2}');
    assert.equal(fs.existsSync(f + '.tmp'), false);
  });
  test('بيتعامل مع عربي', () => {
    const f = path.join(m.__tmp, 'ar.json');
    m.writeFileAtomic(f, JSON.stringify({ t: 'سبحان الله' })); assert.equal(rd(f).t, 'سبحان الله');
  });
});

describe('الجارد', () => {
  test('نزول مفاجئ من 5000 إلى 10 مبيكتبش فوق الملف', () => {
    const st = JSON.parse(JSON.stringify(m.DEFAULT_STATE)); st.total = 5000; m.setState(st); m.setLastGood(0);
    m.saveStateNow(); assert.equal(rd(m.stateFile()).total, 5000);
    st.total = 10; m.saveStateNow();
    assert.equal(rd(m.stateFile()).total, 5000);                 // الملف السليم محمي
    assert.equal(m.guardInfo().blocked, true);
    assert.equal(rd(path.join(m.__tmp, 'guard-suspect.json')).now, 10);   // الحالة المشبوهة اتحفظت على جنب
  });
  test('نزول لـ 0 كمان ممنوع', () => {
    const st = JSON.parse(JSON.stringify(m.DEFAULT_STATE)); st.total = 800; m.setState(st); m.setLastGood(0); m.saveStateNow();
    st.total = 0; m.saveStateNow(); assert.equal(rd(m.stateFile()).total, 800);
  });
  test('زيادة عادية وتسبيح عادي بيتحفظوا', () => {
    const st = JSON.parse(JSON.stringify(m.DEFAULT_STATE)); st.total = 800; m.setState(st); m.setLastGood(0); m.saveStateNow();
    st.total = 801; m.saveStateNow(); assert.equal(rd(m.stateFile()).total, 801);
    st.total = 700; m.saveStateNow(); assert.equal(rd(m.stateFile()).total, 700);   // نزول بسيط (أقل من النص) مسموح
  });
  test('أرقام صغيرة (أقل من 100) مبيتدخلش فيها', () => {
    const st = JSON.parse(JSON.stringify(m.DEFAULT_STATE)); st.total = 50; m.setState(st); m.setLastGood(0); m.saveStateNow();
    st.total = 0; m.saveStateNow(); assert.equal(rd(m.stateFile()).total, 0);
  });
});

describe('النسخة الخارجية', () => {
  test('mirrorNow بيكتب نسخة سليمة فيها الإجمالي والإعدادات', () => {
    const st = JSON.parse(JSON.stringify(m.DEFAULT_STATE)); st.total = 321; st.target = 99; m.setState(st); m.setLastGood(0);
    m.mirrorNow();
    const o = rd(m.extFile());
    assert.equal(o.app, 'WZAKER'); assert.equal(o.state.total, 321); assert.equal(o.state.target, 99);
  });
});

describe('الاسترجاع وقت التشغيل', () => {
  test('ملف صفر + نسخة خارجية = يسأل ويستعيد (والتالف بيتحفظ على جنب)', () => {
    fs.writeFileSync(m.stateFile(), ''); writeExt(bkOf(777));
    answer(0); m.preLoadRecovery();
    assert.equal(asked.length, 1);
    assert.match(asked[0].detail, /٧٧٧/);                        // عدد التسابيح ظاهر للمستخدم
    assert.equal(rd(m.stateFile()).total, 777);
    assert.equal(m.stateFileInfo().status, 'ok');
  });
  test('ملف تالف (JSON مقطوع) = نفس الشيء', () => {
    fs.writeFileSync(m.stateFile(), '{"count":5,"tot'); writeExt(bkOf(500));
    answer(0); m.preLoadRecovery(); assert.equal(rd(m.stateFile()).total, 500);
  });
  test('ملف مش موجود + نسخة خارجية = يسأل', () => {
    writeExt(bkOf(1234)); answer(0); m.preLoadRecovery(); assert.equal(rd(m.stateFile()).total, 1234);
  });
  test('لو المستخدم رفض: مفيش استعادة والنسخة بتتأرشف', () => {
    fs.writeFileSync(m.stateFile(), ''); writeExt(bkOf(777));
    answer(1); m.preLoadRecovery();
    assert.equal(fs.readFileSync(m.stateFile(), 'utf8'), '');
    assert.equal(fs.readdirSync(path.join(m.extDir(), 'archive')).length, 1);
  });
  test('ملف سليم لكن إجماليه أقل بكتير من النسخة الخارجية = يسأل', () => {
    fs.writeFileSync(m.stateFile(), JSON.stringify({ ...bkOf(5).state })); writeExt(bkOf(900));
    answer(0); m.preLoadRecovery(); assert.equal(asked.length, 1); assert.equal(rd(m.stateFile()).total, 900);
  });
  test('ملف سليم وطبيعي = مفيش أي سؤال', () => {
    fs.writeFileSync(m.stateFile(), JSON.stringify({ ...bkOf(900).state })); writeExt(bkOf(905));
    answer(0); m.preLoadRecovery(); assert.equal(asked.length, 0);
  });
  test('أول تشغيل من غير أي نسخة = مفيش سؤال', () => {
    answer(0); m.preLoadRecovery(); assert.equal(asked.length, 0); assert.equal(fs.existsSync(m.stateFile()), false);
  });
});

describe('النسخة الإضافية (المكان اللي المستخدم يختاره)', () => {
  const stWith = (total, dir) => { const st = JSON.parse(JSON.stringify(m.DEFAULT_STATE)); st.total = total; st.extBackupDir = dir; m.setState(st); m.setLastGood(0); return st; };
  test('بتتكتب في المكانين: Documents والمكان المختار، وبنفس الصيغة القابلة للاستيراد', () => {
    stWith(250, USB); m.mirrorNow();
    assert.equal(rd(m.extFile()).state.total, 250);
    const o = rd(path.join(USB, 'WZAKER-mirror.json'));
    assert.equal(o.app, 'WZAKER'); assert.equal(o.state.total, 250);
    assert.equal(m.mirrorStatus.custom.ok, true);
  });
  test('مكان مش متاح (فلاشة مفصولة): مفيش كراش، ونسخة Documents شغالة', () => {
    const blocker = path.join(m.__tmp, 'iamafile'); fs.writeFileSync(blocker, 'x');
    stWith(260, path.join(blocker, 'WZAKER-Backup'));          // مسار جوه ملف = مستحيل يتعمل
    assert.doesNotThrow(() => m.mirrorNow(true));
    assert.equal(m.mirrorStatus.custom.ok, false);
    assert.equal(rd(m.extFile()).state.total, 260);
  });
  test('لو مفيش مكان مختار: Documents بس', () => {
    stWith(100, ''); m.mirrorNow(true);
    assert.equal(fs.existsSync(path.join(USB, 'WZAKER-mirror.json')), false);
  });
  test('استرجاع من المكان المختار لما ملف الحفظ صفر ومفيش نسخة Documents (عن طريق الملف الصغير)', () => {
    fs.mkdirSync(USB, { recursive: true }); fs.writeFileSync(path.join(USB, 'WZAKER-mirror.json'), JSON.stringify(bkOf(4321)));
    fs.writeFileSync(m.extPointer(), USB); fs.writeFileSync(m.stateFile(), '');
    answer(0); m.preLoadRecovery();
    assert.equal(asked.length, 1); assert.match(asked[0].detail, /النسخة الإضافية/);
    assert.equal(rd(m.stateFile()).total, 4321);
  });
  test('استرجاع من المكان المختار لما مساره مكتوب جوه نسخة Documents (من غير الملف الصغير)', () => {
    fs.mkdirSync(USB, { recursive: true }); fs.writeFileSync(path.join(USB, 'WZAKER-mirror.json'), JSON.stringify(bkOf(9000)));
    writeExt(bkOf(40, { extBackupDir: USB }));                    // Documents قديمة وإجماليها صغير، بس عارفة المكان
    fs.writeFileSync(m.stateFile(), '');
    answer(0); m.preLoadRecovery(); assert.equal(rd(m.stateFile()).total, 9000);   // بيختار الأكتر تسابيح
  });
});

describe('مستخدمين الإصدار القديم', () => {
  const OLD = { count: 12, total: 4321, dhikrId: 'd2', target: 99, volume: 0.3, customAzkar: [{ id: 'c1', text: 'ذكري' }], stats: { d2: { n: 55, last: 1 } } };   // شكل ملف قديم (من غير الحقول الجديدة)
  test('لقطة الملف القديم بتتاخد مرة واحدة وطبق الأصل ومبتتغيّرش بعد كده', () => {
    fs.writeFileSync(m.stateFile(), JSON.stringify(OLD));
    m.legacySnapshot();
    assert.deepEqual(rd(m.legacyFile()), OLD);
    fs.writeFileSync(m.stateFile(), JSON.stringify({ ...OLD, total: 9999 }));     // الإصدار الجديد غيّر الملف
    m.legacySnapshot();
    assert.equal(rd(m.legacyFile()).total, 4321);                                // اللقطة الأصلية زي ما هي
  });
  test('ملف قديم صفر/تالف: مفيش لقطة (مش هنحفظ تالف)', () => {
    fs.writeFileSync(m.stateFile(), ''); m.legacySnapshot();
    assert.equal(fs.existsSync(m.legacyFile()), false);
  });
  test('ملف قديم سليم: الاسترجاع مبيسألش ومبيلمسش الملف (مفيش نسخ تانية لسه)', () => {
    fs.writeFileSync(m.stateFile(), JSON.stringify(OLD)); answer(0);
    m.preLoadRecovery();
    assert.equal(asked.length, 0); assert.deepEqual(rd(m.stateFile()), OLD);
  });
  test('loadState على ملف قديم: إعداداته وعدّاده وأذكاره كلها بتفضل، والحقول الجديدة بتتملّى افتراضي', () => {
    fs.writeFileSync(m.stateFile(), JSON.stringify(OLD)); answer(0);
    m.loadState();
    const st = m.getState();
    assert.equal(st.total, 4321); assert.equal(st.count, 12); assert.equal(st.dhikrId, 'd2');
    assert.equal(st.target, 99); assert.equal(st.volume, 0.3);
    assert.equal(st.customAzkar.length, 1); assert.equal(st.stats.d2.n, 55);
    assert.equal(st.extBackupDir, '');                          // حقل جديد: افتراضي
    assert.equal(m.guardInfo().lastGoodTotal, 4321);            // الجارد بيبدأ من إجماليه الحقيقي
  });
});
