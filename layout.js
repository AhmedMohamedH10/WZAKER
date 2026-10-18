/* ──────────────────────────────────────────────────────────────
   WZAKER — تخصيص المسبحة الكبيرة (مشترك بين المسبحة نفسها ومعاينة الإعدادات)
   كل عنصر ليه علامة data-lx="..." في الصفحة، والتخصيص (dialLayout) بيتخزن في الـ main:
     { k: الحجم الكلي (0.8–1.6), els: { id: { dx, dy, s, hide } }, extras: [ { id, type, dx, dy, s, text? } ] }
   dx/dy بالبكسل (نسبة للمكان الأصلي) و s = تكبير/تصغير للعنصر نفسه.
   بنستخدم خصائص translate و scale المنفصلة علشان ما تتعارضش مع أي transform/أنيميشن موجود.
   ────────────────────────────────────────────────────────────── */
(() => {
  'use strict';
  const ELS = [
    { id: 'logo',  label: 'اللوجو' },
    { id: 'tag',   label: 'الآية تحت اللوجو' },
    { id: 'dial',  label: 'دايرة التسبيح (كلها)' },
    { id: 'num',   label: 'رقم العدّاد' },
    { id: 'of',    label: 'الهدف (/ 100)' },
    { id: 'dhikr', label: 'الذكر' },
    { id: 'total', label: 'الإجمالي' },
    { id: 'snd',   label: 'الصوت' },
    { id: 'btns',  label: 'أزرار الهدف والتصفير' },
    { id: 'az',    label: 'إشعارات الصباح والمساء والورد' },
    { id: 'topL',  label: 'زر التصغير والإعدادات', noHide: true },
    { id: 'topR',  label: 'زر الإغلاق' }
  ];
  const EXTRA_TYPES = [
    { type: 'clock', label: 'الساعة' },
    { type: 'date',  label: 'التاريخ' },
    { type: 'hijri', label: 'التاريخ الهجري' },
    { type: 'today', label: 'تسابيح النهارده' },
    { type: 'pct',   label: 'نسبة التقدم %' },
    { type: 'prayer', label: 'الصلاة القادمة' },
    { type: 'text',  label: 'نص من عندك' }
  ];
  const EXTRAS_MAX = 8;
  const el$ = (root, id) => root.querySelector('[data-lx="' + id + '"]');

  const fmtDate = (loc, o) => { try { return new Intl.DateTimeFormat(loc, o).format(new Date()); } catch (_) { return ''; } };

  // ───── الصلاة القادمة: اسم أقرب صلاة فرض (من الفجر للعشاء) وتوقيتها، وبعد العشاء بترجع لفجر بكرة ─────
  const NEXT_KEYS = ['fj', 'dh', 'as', 'mg', 'is'];
  const NEXT_NAMES = { fj: 'الفجر', dh: 'الظهر', as: 'العصر', mg: 'المغرب', is: 'العشاء' };
  const MOSQUE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h16"/><path d="M6 20v-5a6 6 0 0112 0v5"/><path d="M12 9V5M10.5 6.5h3"/></svg>';
  const fmt12 = m => { const h = Math.floor(m / 60), mi = m % 60; return ((h % 12) || 12) + ':' + String(mi).padStart(2, '0') + ' ' + (h < 12 ? 'ص' : 'م'); };
  function nextPrayer(S) {
    const t = S && S.prayerInfo && S.prayerInfo.times; if (!t) return null;
    const d = new Date(), now = d.getHours() * 60 + d.getMinutes();
    const k = NEXT_KEYS.find(x => Number.isFinite(t[x]) && t[x] > now) || 'fj';
    return Number.isFinite(t[k]) ? { name: NEXT_NAMES[k], min: t[k] } : null;
  }
  function fillPrayer(n, S) {
    const p = nextPrayer(S), sig = p ? p.name + '|' + p.min : '-';
    if (n.dataset.sig === sig) return;
    n.dataset.sig = sig; n.textContent = ''; n.insertAdjacentHTML('afterbegin', MOSQUE_SVG);
    const box = document.createElement('span'), l = document.createElement('small'), v = document.createElement('b');
    box.className = 'xp'; l.textContent = 'الصلاة القادمة'; v.textContent = p ? p.name + ' ' + fmt12(p.min) : '—';
    box.append(l, v); n.appendChild(box);
  }
  function extraText(x, S) {
    S = S || {};
    switch (x.type) {
      case 'clock': return fmtDate('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).replace('AM', 'ص').replace('PM', 'م');
      case 'date':  return fmtDate('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' });
      case 'hijri': return fmtDate('ar-SA-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' });
      case 'today': return 'النهارده ' + (S.todayN || 0);
      case 'pct':   return S.target ? Math.min(100, Math.round(((S.count || 0) / S.target) * 100)) + '%' : '—';
      case 'prayer': { const p = nextPrayer(S); return p ? 'الصلاة القادمة ' + p.name + ' ' + fmt12(p.min) : ''; }
      case 'text':  return x.text || 'نص';
      default: return '';
    }
  }

  // تطبيق مكان/حجم/إخفاء كل عنصر أصلي
  function apply(root, L) {
    L = L || {};
    const els = L.els || {};
    for (const d of ELS) {
      const e = el$(root, d.id);
      if (!e) continue;
      const c = els[d.id];
      if (c && (c.dx || c.dy)) e.style.translate = (c.dx || 0) + 'px ' + (c.dy || 0) + 'px'; else e.style.translate = '';
      if (c && c.s && c.s !== 1) e.style.scale = String(c.s); else e.style.scale = '';
      e.classList.toggle('lx-off', !!(c && c.hide && !d.noHide));
    }
    watchNum(root);
  }

  // ───── رقم العدّاد في منتصف الدايرة بالظبط ─────
  // الخط (KG / Hail) بيسيب مساحة فوق الأرقام أكتر من تحتها، فالتوسيط العادي بيطلّع الرقم لفوق.
  // بنقيس شكل الأرقام الفعلي (ink) بالـ canvas ونحسب التعويض، وبنحطه في --nfy. تخصيص المسبحة (dx/dy) بيتطبّق فوقه
  // بخاصية translate المنفصلة، فأي بكسل بتعدّله بيتحسب من المنتصف الحقيقي ويظهر نفس الشكل في المعاينة والمسبحة.
  const NUM_LIFT = 5;   // الرقم مرفوع 5 بكسل فوق المنتصف الهندسي (كان 10 ونزّلناه 5) — غيّر الرقم ده لو عايزه أعلى أو أقل
  let cvx = null;
  // أقصى عرض للرقم جوه الدايرة حسب الشكل (لو الرقم طويل زي 1000 بيصغّر لوحده بدل ما يخبط في الحبات)
  const NUM_MAXW = { ring: 128, beads: 104, strand: 112 };
  function fixNum(root) {
    const n = el$(root, 'num'); if (!n) return;
    const dial = n.closest('.dial');
    const mode = !dial ? 'ring' : dial.classList.contains('beads') ? 'beads' : dial.classList.contains('strand') ? 'strand' : 'ring';
    n.style.setProperty('--nk', '1'); n.style.setProperty('--nfy', (-NUM_LIFT) + 'px'); n.style.setProperty('--nfx', '0px');
    try {
      cvx = cvx || document.createElement('canvas').getContext('2d');
      const cs = getComputedStyle(n), fs = parseFloat(cs.fontSize) || 60;
      const lh = parseFloat(cs.lineHeight); const LH = isFinite(lh) ? lh : fs;
      cvx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + fs + 'px ' + cs.fontFamily;
      cvx.textBaseline = 'alphabetic'; cvx.textAlign = 'left'; cvx.direction = 'ltr';
      const txt = n.textContent || '0', arabic = /[\u0660-\u0669]/.test(txt);
      // 1) الرقم الطويل يصغر عشان يفضل جوه الدايرة
      const mt = cvx.measureText(txt), inkW = (mt.actualBoundingBoxLeft || 0) + (mt.actualBoundingBoxRight || mt.width);
      const nk = Math.max(.55, Math.min(1, (NUM_MAXW[mode] || 112) / (inkW || 1)));
      n.style.setProperty('--nk', nk.toFixed(3));
      const f2 = fs * nk;
      cvx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + f2 + 'px ' + cs.fontFamily;
      // 2) توسيط رأسي لشكل الأرقام نفسه (مش صندوق الخط)
      const ref = cvx.measureText(arabic ? '\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669' : '0123456789');
      if (ref.fontBoundingBoxAscent == null || ref.actualBoundingBoxAscent == null) return;
      const LH2 = LH * nk;
      const half = (LH2 - (ref.fontBoundingBoxAscent + ref.fontBoundingBoxDescent)) / 2;
      const baseY = half + ref.fontBoundingBoxAscent;                       // مكان خط القاعدة جوه صندوق السطر
      const inkC = baseY - (ref.actualBoundingBoxAscent - ref.actualBoundingBoxDescent) / 2;   // منتصف شكل الأرقام
      const dy = LH2 / 2 - inkC - NUM_LIFT;
      if (isFinite(dy) && Math.abs(dy) < 40) n.style.setProperty('--nfy', dy.toFixed(2) + 'px');
    } catch (_) {}
  }
  const watched = new WeakSet();
  function watchNum(root) {
    const n = el$(root, 'num'), dial = n && n.closest('.dial');
    if (!dial) return;
    if (!watched.has(dial)) {
      watched.add(dial);
      let raf = 0; const again = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => fixNum(root)); };
      new MutationObserver(again).observe(dial, { attributes: true, attributeFilter: ['class'] });   // تغيير شكل المسبحة (دايرة/حبات/خرز)
      new MutationObserver(again).observe(n, { childList: true, characterData: true, subtree: true }); // تغيّر الرقم (عشان الأرقام الطويلة)
      if (document.fonts) { document.fonts.ready.then(again); document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', again); }
    }
    fixNum(root);
  }

  // العناصر المضافة (ساعة/تاريخ/نص...): بتتبني وبتتحدث على container واحد
  function renderExtras(box, L, S, opts) {
    const list = (L && L.extras) || [];
    const have = new Map([...box.children].map(n => [n.dataset.xid, n]));
    for (const x of list) {
      let n = have.get(x.id);
      if (!n) { n = document.createElement('div'); n.className = 'xel'; n.dataset.xid = x.id; box.appendChild(n); }
      have.delete(x.id);
      if (x.type === 'prayer') fillPrayer(n, S);
      else { const t = extraText(x, S); if (n.textContent !== t) n.textContent = t; }
      n.dataset.type = x.type;
      n.style.translate = 'calc(-50% + ' + (x.dx || 0) + 'px) calc(-50% + ' + (x.dy || 0) + 'px)';
      n.style.scale = x.s && x.s !== 1 ? String(x.s) : '';
      n.classList.toggle('lx-off', !!x.hide);
      if (opts && opts.onNode) opts.onNode(n, x);
    }
    for (const n of have.values()) n.remove();
  }

  window.WZLayout = { ELS, EXTRA_TYPES, EXTRAS_MAX, apply, renderExtras, extraText, fixNum };
})();
