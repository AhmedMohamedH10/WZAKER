(() => {
  const $ = id => document.getElementById(id);
  let S = null, A = {}, sliding = null, azkarKey = '';

  // ───── التنقل بين الأقسام ─────
  const VIEWS = ['hub', 'pGoal', 'pAlerts', 'pSound', 'pView', 'pLayout', 'pInput', 'pStats', 'pDaily', 'pQuran', 'pTafsir', 'pMin', 'pAbout'];
  const HASH_MAP = { target: 'pGoal', goal: 'pGoal', azkar: 'pGoal', alerts: 'pAlerts', sound: 'pSound', view: 'pView', layout: 'pLayout', input: 'pInput', stats: 'pStats', daily: 'pDaily', quran: 'pQuran', tafsir: 'pTafsir', min: 'pMin', about: 'pAbout' };
  let cur = 'hub', donutIntro = false;
  function go(id) {
    if (!VIEWS.includes(id)) id = 'hub';
    cur = id; qoSet(false);
    document.querySelectorAll('.sov').forEach(o => { o.hidden = true; });
    VIEWS.forEach(v => $(v).classList.toggle('on', v === id));
    if (id === 'pQuran' || id === 'pTafsir') mushafOpen(id);
    if (id !== 'pQuran') qWide(false);
    else if (MS.pQuran && !MS.pQuran.readBox.hidden) qWide(true);
    if (id === 'pStats') { donutIntro = true; renderStats(); }          // ظهور القسم: الدونات تتحرّك من الأول
    document.body.classList.toggle('in-page', id !== 'hub');
    $('ptitle').textContent = id === 'hub' ? 'الإعدادات' : $(id).dataset.title;
    $('scroll').scrollTop = 0;
    if (id === 'pLayout' && S && typeof lxPaintAll === 'function') lxPaintAll();
    if (id !== 'pAlerts' && typeof closeForm === 'function') closeForm();   // مفيش نموذج مفتوح يفضل وراك
  }
  document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
  // بقعة ضوء ناعمة بتتبع الماوس جوه كل قسم في القائمة الرئيسية
  document.querySelectorAll('.tile').forEach(t => {
    let trkT = 0;
    t.addEventListener('pointerenter', () => { t.classList.remove('trk'); clearTimeout(trkT); trkT = setTimeout(() => t.classList.add('trk'), 360); });   // أول لحظة: Pop زنبركي، بعدها تتبّع سريع ناعم للماوس
    t.addEventListener('pointermove', e => {
      const r = t.getBoundingClientRect(), nx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - .5) * 2)), ny = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - .5) * 2));
      t.style.setProperty('--mx', (e.clientX - r.left) + 'px'); t.style.setProperty('--my', (e.clientY - r.top) + 'px');
      t.style.setProperty('--rx', nx.toFixed(3)); t.style.setProperty('--ry', ny.toFixed(3)); t.style.setProperty('--px', nx.toFixed(3)); t.style.setProperty('--py', ny.toFixed(3));
    });
    t.addEventListener('pointerleave', () => { clearTimeout(trkT); t.classList.remove('trk'); for (const v of ['--rx', '--ry', '--px', '--py']) t.style.removeProperty(v); });   // الخروج: يرجع لمكانه بزنبرك ناعم
  });
  // بار خيارات المصحف: بينزل لما تضغط على عنوان «القرآن الكريم» وإنت بتقرا
  const qoBar = () => (MS.pQuran ? MS.pQuran.root.querySelector('.qopts') : null);
  function qoSet(on) {
    const b = qoBar(); if (!b) return;
    if (on) { const h = b.parentElement.querySelector('.mhead'); b.style.top = (h.offsetTop + h.offsetHeight + 2) + 'px'; const f = b.querySelector('.qfr'); if (f) f.value = qFont(); }
    clearTimeout(b._qoT);
    if (on) { b.classList.remove('out'); b.hidden = false; $('ptitle').classList.add('open'); return; }
    $('ptitle').classList.remove('open');
    if (b.hidden) return;
    b.classList.add('out');                                       // حركة إغلاق قصيرة قبل الإخفاء
    b._qoT = setTimeout(() => { b.hidden = true; b.classList.remove('out', 'fs'); const fb = b.querySelector('.qfs'); if (fb) fb.classList.remove('on'); const hi = b.querySelector('.qhi'); if (hi) hi.classList.remove('on'); }, 170);
  }
  $('ptitle').addEventListener('click', e => {
    if (cur !== 'pQuran' || !document.body.classList.contains('qread')) return;
    e.stopPropagation(); const b = qoBar(); if (b) qoSet(b.hidden || b.classList.contains('out'));
  });
  document.addEventListener('click', e => { const b = qoBar(); if (b && !b.hidden && !e.target.closest('.qopts, #ptitle, .manimmenu')) qoSet(false); });
  window.addEventListener('keydown', e => { const b = qoBar(); if (e.key === 'Escape' && b && !b.hidden) { qoSet(false); e.stopImmediatePropagation(); } }, true);


  // مؤشر زجاجي بينزلق لأي أيقونة الماوس يقف عليها + لمعة بتتبع الماوس جواه
  (() => {
    const hiOf = bar => { let h = bar.querySelector('.qhi'); if (!h) { h = document.createElement('span'); h.className = 'qhi'; bar.appendChild(h); } return h; };
    const place = (bar, it, ev) => {
      const h = hiOf(bar), first = !h.classList.contains('on');
      if (first) h.classList.add('snap');
      h.style.width = it.offsetWidth + 'px'; h.style.height = it.offsetHeight + 'px';
      h.style.transform = 'translate(' + it.offsetLeft + 'px,' + it.offsetTop + 'px)';
      if (ev) { const r = it.getBoundingClientRect(); h.style.setProperty('--hx', (ev.clientX - r.left) + 'px'); h.style.setProperty('--hy', (ev.clientY - r.top) + 'px'); }
      if (first) { void h.offsetWidth; h.classList.add('on'); requestAnimationFrame(() => h.classList.remove('snap')); }
    };
    const target = (bar, e) => { const it = e.target.closest && e.target.closest('.qo, .qfs'); if (!it || it.disabled || it.hidden || bar.classList.contains('fs') || it.classList.contains('on')) return null; return it; };
    document.addEventListener('pointermove', e => {
      const bar = e.target.closest && e.target.closest('.qopts'); if (!bar || bar.hidden || bar.classList.contains('out')) return;
      const it = target(bar, e), h = bar.querySelector('.qhi');
      if (it) place(bar, it, e); else if (h) h.classList.remove('on');
    });
    document.addEventListener('pointerout', e => {
      const bar = e.target.closest && e.target.closest('.qopts'); if (!bar) return;
      if (!e.relatedTarget || !bar.contains(e.relatedTarget)) { const h = bar.querySelector('.qhi'); if (h) h.classList.remove('on'); }
    });
  })();

  // ───── زر تواصل مع المطور (فيسبوك / ديسكورد / واتساب / اقتراحات) ─────
  const sugPop = $('sugPop'), sugBtn = $('sugBtn');
  const sugToggle = on => { sugPop.classList.toggle('on', on); sugBtn.setAttribute('aria-expanded', String(on)); };
  sugBtn.addEventListener('click', e => { e.stopPropagation(); sugToggle(!sugPop.classList.contains('on')); });
  $('sgBtn').addEventListener('click', () => { window.azkar.openContact('sg'); sugToggle(false); });
  $('siteBtn').addEventListener('click', () => { window.azkar.openContact('site'); sugToggle(false); });   // موقع وذكر: wzaker.site   // الاقتراحات: فورم منفصل
  sugPop.addEventListener('click', e => {
    const b = e.target.closest('button[data-c]');
    if (b) { window.azkar.openContact(b.dataset.c); sugToggle(false); }
  });
  document.addEventListener('click', e => { if (!sugPop.contains(e.target)) sugToggle(false); });
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && sugPop.classList.contains('on')) { sugToggle(false); e.stopImmediatePropagation(); } }, true);


  // ───── القرآن الكريم + التفسير ─────
  const MS = {}, jsLoaded = {};
  const AR = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  const BISM = 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ';
  const norm = x => String(x).replace(/[ً-ٰٟۖ-ۭـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').trim();
  const loadJs = src => jsLoaded[src] || (jsLoaded[src] = new Promise((ok, no) => {
    const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => { delete jsLoaded[src]; no(new Error(src)); }; document.head.appendChild(s);
  }));
  function mushafInit(id) {
    const root = $(id), kind = root.dataset.mk, q = x => root.querySelector(x);
    const m = MS[id] = { root, kind, ready: false, cur: -1, listBox: q('.mlistbox'), readBox: q('.mreadbox'), list: q('.mlist'), msg: q('.mmsg'), body: q('.mbody') };
    q('.mback').onclick = () => showList(m);
    q('.mprev').onclick = () => openSura(m, m.cur - 1);
    q('.mnext').onclick = () => openSura(m, m.cur + 1);
    if (kind === 'q') qSetup(m, q);
    vSetup(m, q);
    return m;
  }
  // ───── البحث في نص الآيات: كل الآيات اللي فيها نفس الكلام (والمتشابهة)، وإنت بتختار منها ─────
  // تطبيع للبحث: من غير تشكيل ولا همزات، والألف بتتشال (علشان «العالمين» = «العلمين» برسم المصحف)
  const vnorm = x => norm(String(x).replace(/[0-9٠-٩]+/g, ' ')).replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/[اء]/g, '').replace(/\s+/g, ' ').trim();
  let VIDX = null;
  const vIndex = () => VIDX || (VIDX = window.WZ_QURAN.map(s => s.t.map(t => vnorm(t))));
  const V_PAGE = 60;
  const vcnt = n => n === 1 ? 'آية واحدة' : n === 2 ? 'آيتين' : n <= 10 ? AR(n) + ' آيات' : AR(n) + ' آية';
  function vFind(text) {
    const v = vnorm(text); if (v.replace(/ /g, '').length < 2) return null;
    const words = [...new Set(v.split(' ').filter(w => w.length >= 2))], tiers = [[], [], []];
    vIndex().forEach((arr, i) => arr.forEach((h, k) => {
      if (h.includes(v)) { tiers[0].push([i, k]); return; }                 // العبارة نفسها
      if (!words.length) return;
      let hit = 0; for (const w of words) if (h.includes(w)) hit++;
      if (hit === words.length) tiers[1].push([i, k]);                      // كل الكلمات موجودة (متفرقة)
      else if (words.length >= 3 && hit / words.length >= 0.6) tiers[2].push([i, k, hit / words.length]);   // متشابهة
    }));
    tiers[2].sort((a, b) => b[2] - a[2]);
    return { v, words, tiers };
  }
  // يفتح صفحة الآية ويحدّدها (كأنك ضغطت عليها) علشان خيارات الآية (الكاميرا / التفسير…) تظهر على طول
  function vGo(m, i, k) {
    if (m.kind === 't') {   // التفسير: نفتح تفسير السورة وننزل على الآية ونلمّعها
      openSura(m, i);
      const el = m.body.querySelector('.tfa[data-k="' + k + '"]'); if (!el) return;
      setTimeout(() => {
        el.scrollIntoView({ block: 'start', behavior: 'instant' });
        el.classList.remove('found'); void el.offsetWidth; el.classList.add('found'); setTimeout(() => el.classList.remove('found'), 1700);
      }, 60);
      return;
    }
    const s = window.WZ_QURAN[i]; qOpenPage(m, s.pg[k]);
    let tries = 0;
    const pick = () => {
      const el = m.root.querySelector('.ay[data-i="' + i + '"][data-k="' + k + '"]');
      if (!el || m.page !== s.pg[k]) { if (++tries < 25) setTimeout(pick, 80); return; }
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
      setTimeout(() => {   // بعد حدث السكرول (بيفضّي التحديد)
        const r = el.getClientRects()[0] || el.getBoundingClientRect();
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
        el.classList.remove('found'); void el.offsetWidth; el.classList.add('found'); setTimeout(() => el.classList.remove('found'), 1700);
      }, 140);
    };
    setTimeout(pick, 60);
  }
  // زر سورة (بيتستخدم في الفهرس وفي نتايج البحث)
  function surBtn(i, onclick) {
    const s = window.WZ_QURAN[i], b = document.createElement('button'); b.className = 'sur'; b.type = 'button';
    b.innerHTML = '<span class="sn"><i></i></span><span class="sx"><span class="sa"></span><span class="sc"></span></span>';
    b.querySelector('i').textContent = AR(s.n); b.querySelector('.sa').textContent = s.a;
    b.querySelector('.sc').textContent = (s.t.length <= 10 ? AR(s.t.length) + ' آيات' : AR(s.t.length) + ' آية') + ' · ص ' + AR(s.pg[0]);
    b.onclick = onclick; return b;
  }
  const scnt = n => n === 1 ? 'سورة واحدة' : n === 2 ? 'سورتين' : n <= 10 ? AR(n) + ' سور' : AR(n) + ' سورة';
  const VTAG = ['', 'كلمات متفرقة', 'متشابهة'];
  const SEARCH_SVG = '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4L20.5 20.5"/></svg>';
  const toLatinDigits = x => String(x).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  // مكوّن البحث: خانة واحدة (اسم سورة / رقمها / نص آية) + نتايج متجمّعة بالسورة
  function mkSearch(m, o) {
    const Q = () => window.WZ_QURAN;
    const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
    const bar = el('div', 'sbar'), help = el('div', 'shelp', 'اكتب اسم سورة أو رقمها، أو أي جزء من آية — هتظهرلك كل السور اللي فيها الآية وتختار منها.'), res = el('div', 'sres');
    bar.innerHTML = SEARCH_SVG + '<input class="sin" type="text" spellcheck="false" autocomplete="off" aria-label="بحث"><button class="sclr" type="button" hidden aria-label="مسح البحث">✕</button>';
    const inp = bar.querySelector('.sin'), clr = bar.querySelector('.sclr'); inp.placeholder = o.ph;
    let st = null, sm = [], groups = [], total = 0, fS = -1, shown = V_PAGE, allChips = false, timer = 0, lastQ = '';
    const surMatch = t => {
      const nv = norm(toLatinDigits(t)); if (!nv) return [];
      const out = []; Q().forEach((s, i) => { if ((norm(s.a) + ' ' + s.n).includes(nv)) out.push(i); }); return out;
    };
    const build = () => {   // نجمّع الآيات حسب السورة: الأقرب (نفس العبارة) الأول
      const by = new Map();
      st.tiers.forEach((t, ti) => t.forEach(x => { let g = by.get(x[0]); if (!g) by.set(x[0], g = { i: x[0], rows: [], best: 3 }); g.rows.push({ i: x[0], k: x[1], ti }); if (ti < g.best) g.best = ti; }));
      groups = [...by.values()]; groups.forEach(g => g.rows.sort((a, b) => a.ti - b.ti || a.k - b.k));
      groups.sort((a, b) => a.best - b.best || a.i - b.i);
      total = groups.reduce((a, g) => a + g.rows.length, 0);
    };
    const verse = r => {
      const s = Q()[r.i], b = el('button', 'vr'); b.type = 'button';
      const top = el('div', 'vt'), nm = el('b', null, 'آية ' + AR(r.k + 1)), rt = el('span');
      if (r.ti) rt.appendChild(el('em', 'vtag', VTAG[r.ti]));
      rt.appendChild(document.createTextNode(' ص ' + AR(s.pg[r.k]))); top.append(nm, rt);
      const tx = el('div', 'vq');
      s.t[r.k].split(/\s+/).filter(Boolean).forEach(t => {
        const tn = vnorm(t), hit = tn && st.words.some(w => tn.includes(w)), e = document.createElement(hit ? 'mark' : 'span');
        e.textContent = t + ' '; tx.appendChild(e);
      });
      b.append(top, tx); b.onclick = () => o.onVerse(r.i, r.k); return b;
    };
    const group = (g, take) => {
      const s = Q()[g.i], box = el('div', 'sgrp'), h = el('button', 'sgh'); h.type = 'button';
      h.innerHTML = '<span class="sgn"><span class="sn"><i></i></span><span class="sgx"><b class="sgt"></b><span class="sgc"></span></span></span><span class="sgo">فتح السورة ‹</span>';
      h.querySelector('i').textContent = AR(s.n); h.querySelector('.sgt').textContent = 'سورة ' + s.a;
      h.querySelector('.sgc').textContent = vcnt(g.rows.length) + ' مطابقة · الجزء ' + AR(s.j);
      h.onclick = () => o.onSura(g.i); box.appendChild(h);
      g.rows.slice(0, take).forEach(r => box.appendChild(verse(r))); return box;
    };
    const chips = () => {
      if (groups.length < 2) return null;
      const row = el('div', 'sfil'), byS = [...groups].sort((a, b) => a.i - b.i), lim = allChips ? 999 : 14;
      const mk = (txt, n, on, fn) => { const c = el('button', 'chip' + (on ? ' on' : '')); c.type = 'button'; c.append(document.createTextNode(txt + ' '), el('b', null, AR(n))); c.onclick = fn; return c; };
      row.appendChild(mk('الكل', total, fS < 0, () => { fS = -1; shown = V_PAGE; draw(); }));
      byS.slice(0, lim).forEach(g => row.appendChild(mk(Q()[g.i].a, g.rows.length, fS === g.i, () => { fS = fS === g.i ? -1 : g.i; shown = V_PAGE; draw(); })));
      if (byS.length > lim) { const c = el('button', 'chip more', '+ ' + AR(byS.length - lim) + ' سورة'); c.type = 'button'; c.onclick = () => { allChips = true; draw(); }; row.appendChild(c); }
      return row;
    };
    const note = (t, c) => el('div', 'vh' + (c ? ' ' + c : ''), t);
    const draw = () => {
      res.textContent = '';
      if (sm.length) {   // السور اللي اسمها/رقمها مطابق
        res.appendChild(note(sm.length === 1 ? 'سورة' : 'السور'));
        const g = el('div', 'slist'); sm.slice(0, 6).forEach(i => g.appendChild(surBtn(i, () => o.onSura(i)))); res.appendChild(g);
        if (sm.length > 6) res.appendChild(note('+ ' + scnt(sm.length - 6) + ' كمان — اكتب أكتر علشان نحدّد'));
      }
      if (!st) { if (!sm.length) res.appendChild(note(/^[0-9٠-٩\s]+$/.test(inp.value.trim()) ? 'مفيش سورة بالرقم ده.' : 'اكتب حرفين على الأقل من الآية.')); return; }
      if (!total) { if (!sm.length) res.appendChild(note('مفيش آية ولا سورة بالكلام ده — جرّب كلمات أقل أو اكتبها بشكل تاني.')); return; }
      res.appendChild(note('لقيت ' + vcnt(total) + ' في ' + scnt(groups.length) + ' — اختار السورة أو الآية اللي محتاجها', 'vsum'));
      const t0 = st.tiers[0].length; if (t0 && t0 < total) res.appendChild(note('منها ' + vcnt(t0) + ' فيها العبارة نفسها بالظبط', 'vsub'));
      const ch = chips(); if (ch) res.appendChild(ch);
      let left = shown, more = 0;
      (fS >= 0 ? groups.filter(g => g.i === fS) : groups).forEach(g => {
        if (left <= 0) { more += g.rows.length; return; }
        const take = Math.min(g.rows.length, left); left -= take; more += g.rows.length - take; res.appendChild(group(g, take));
      });
      if (more > 0) { const b = el('button', 'mbtn vmore', 'عرض المزيد (' + vcnt(more) + ' متبقية)'); b.type = 'button'; b.onclick = () => { shown += V_PAGE; draw(); }; res.appendChild(b); }
    };
    const run = () => {
      const t = inp.value.trim(); clr.hidden = !t; help.hidden = !!t;
      if (!t) { st = null; sm = []; lastQ = ''; res.textContent = ''; o.onActive(false); return; }
      o.onActive(true);
      if (!m.ready) { res.textContent = 'جارٍ التحميل…'; clearTimeout(timer); timer = setTimeout(run, 400); return; }
      sm = surMatch(t); st = /^[0-9٠-٩\s]+$/.test(t) ? null : vFind(t); if (st) build(); else { groups = []; total = 0; }
      fS = -1; shown = V_PAGE; allChips = false; draw();
      if (t !== lastQ) { lastQ = t; const sc = res.closest('.sovb') || $('scroll'); if (sc) sc.scrollTop = 0; }
    };
    inp.oninput = () => { clr.hidden = !inp.value; clearTimeout(timer); timer = setTimeout(run, 180); };
    clr.onclick = () => { inp.value = ''; run(); inp.focus(); };
    inp.addEventListener('keydown', e => {
      if (e.key === 'Escape' && inp.value && !o.overlay) { inp.value = ''; run(); e.stopPropagation(); }
      else if (e.key === 'Enter') { clearTimeout(timer); run(); if (sm.length === 1) o.onSura(sm[0]); else if (total === 1) o.onVerse(groups[0].rows[0].i, groups[0].rows[0].k); }
    });
    return { bar, help, res, inp, clear() { inp.value = ''; run(); }, focus() { inp.focus(); inp.select(); } };
  }
  function vSetup(m, q) {
    const ph = 'البحث عن سورة أو آية';
    const openSura_ = i => m.kind === 'q' ? qOpenPage(m, window.WZ_QURAN[i].pg[0]) : openSura(m, i);
    // 1) في فهرس السور
    const sx = m.sx = mkSearch(m, { ph, onActive: on => m.listBox.classList.toggle('vact', on), onVerse: (i, k) => vGo(m, i, k), onSura: openSura_ });
    q('.smount').replaceWith(sx.bar, sx.help, sx.res);
    // 2) جوّه صفحة القراءة: أيقونة السيرش بتفتح لوحة بحث فوق الصفحة
    const ov = m.ov = document.createElement('div'); ov.className = 'sov'; ov.hidden = true; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'بحث في الآيات');
    ov.innerHTML = '<div class="sovh"></div><div class="sovb"></div>';
    document.body.appendChild(ov);
    const closeOv = () => { ov.hidden = true; };
    const sy = m.sy = mkSearch(m, { ph, overlay: true, onActive() {}, onVerse: (i, k) => { closeOv(); vGo(m, i, k); }, onSura: i => { closeOv(); openSura_(i); } });
    const x = document.createElement('button'); x.className = 'mbtn'; x.type = 'button'; x.textContent = 'إغلاق'; x.onclick = closeOv;
    ov.querySelector('.sovh').append(sy.bar, x); ov.querySelector('.sovb').append(sy.help, sy.res);
    const sb = q('.msbtn'); if (sb) sb.onclick = e => { e.stopPropagation(); ov.hidden = false; sy.focus(); };
    window.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || ov.hidden) return;
      if (sy.inp.value) sy.clear(); else closeOv(); e.stopImmediatePropagation();
    }, true);
  }
  function showList(m) { m.cur = -1; m.readBox.hidden = true; m.listBox.hidden = false; $('scroll').scrollTop = 0; }
  // ═════ المصحف بالصفحات (604 صفحة) + خيارات الآية العائمة ═════
  const QKEY = 'wz_mushaf_v1';
  try { const pq = window.wzx && window.wzx.takePendingQuran && window.wzx.takePendingQuran(); if (pq) localStorage.setItem(QKEY, pq); } catch (_) {}   // استعادة نسخة احتياطية: بيانات المصحف
  let khT = null;
  const khTrack = p => { clearTimeout(khT); if (p >= 1 && p <= 604) khT = setTimeout(() => { try { window.wzx.khatmaPage(p); } catch (_) {} }, 8000); };   // الصفحة بتتحسب مقروءة بعد 8 ثواني
  let qbT = null;
  const qbSend = () => { clearTimeout(qbT); qbT = setTimeout(() => { try { window.wzx.backupQuran(localStorage.getItem(QKEY) || ''); } catch (_) {} }, 4000); };
  let QS = { hl: {}, hw: {}, notes: {}, saved: {}, last: 0 };
  try { const r = JSON.parse(localStorage.getItem(QKEY) || 'null'); if (r && typeof r === 'object') QS = Object.assign(QS, r); } catch (_) {}
  const qsSave = () => { try { localStorage.setItem(QKEY, JSON.stringify(QS)); } catch (_) {} qbSend(); };
  if (QS.animV !== 2) { QS.animV = 2; QS.anim = 'slide'; qsSave(); }   // الشكل الافتراضي الجديد: الصفحتين جنب بعض بيتحركوا كشريط واحد
  let PAGES = null;
  const buildPages = () => { if (PAGES) return; PAGES = Array.from({ length: 605 }, () => []); window.WZ_QURAN.forEach((s, i) => s.t.forEach((t, k) => PAGES[s.pg[k]].push([i, k]))); };
  const ayKey = (i, k) => (i + 1) + ':' + (k + 1);
  const QLH = 1.9;
  let wideOn = false;
  function qWide(on) {   // وضع القراءة: الهوامش بتقل والمصحف ياخد المساحة كلها (من غير ما النافذة نفسها تتغيّر)
    document.body.classList.toggle('qread', on);
    wideOn = on;
  }

  function ayState(el, i, k) {
    const key = ayKey(i, k);
    el.querySelectorAll('.nm,.bm').forEach(x => x.remove());
    if (QS.saved[key]) { const b = document.createElement('i'); b.className = 'bm'; el.appendChild(b); }
    if (QS.notes[key]) { const n = document.createElement('i'); n.className = 'nm'; el.appendChild(n); }
  }
  function drawPage(m, p, plain) {
    const Q = window.WZ_QURAN, list = PAGES[p], inner = m.root.querySelector('.mpi'), frag = document.createDocumentFragment();
    inner.textContent = ''; inner.classList.remove('fit'); inner.style.textAlign = ''; inner.style.textAlignLast = '';
    list.forEach(([i, k]) => {
      const s = Q[i];
      if (k === 0) {
        const h = document.createElement('div'); h.className = 'msn'; h.textContent = 'سورة ' + s.a; frag.appendChild(h);
        if (s.n !== 1 && s.n !== 9) { const b = document.createElement('div'); b.className = 'mbi'; b.textContent = BISM; frag.appendChild(b); }
      }
      const el = document.createElement('span'); el.className = 'ay'; el.dataset.i = i; el.dataset.k = k;
      if (plain) el.appendChild(document.createTextNode(s.t[k]));
      else {
        const ws = s.t[k].split(/\s+/).filter(Boolean);
        ws.forEach((t, j) => { const w = document.createElement('span'); w.className = 'w'; w.dataset.j = j; w.textContent = t + ' '; el.appendChild(w); });
        ayState(el, i, k);
      }
      frag.appendChild(el); if (plain) frag.appendChild(document.createTextNode(' '));
    });
    inner.appendChild(frag);
    return list;
  }
  const QFS_MIN = 18, QFS_MAX = 40, QFS_DEF = 25;
  function qFont() { const z = Number(QS.fs); return z >= QFS_MIN && z <= QFS_MAX ? z : QFS_DEF; }
  function fitFont(m) {   // صفحة المصحف بعرض النافذة كلها وخط كبير مقروء (والصفحة بتتسكرول لو أطول من النافذة)
    const wrap = m.root.querySelector('.mpw'), body = m.root.querySelector('.mpb'), z = qFont();
    const zz = (m.page || 0) <= 2 ? Math.round(z * 1.28) : z;   // أول صفحتين في المصحف بخط أكبر
    body.style.setProperty('--qf', zz + 'px'); wrap.style.setProperty('--qf', zz + 'px');
  }
  // لو الصفحة قصيرة (أول صفحتين / آخر السورة): نوزّع السطور على ارتفاع الصفحة زي المصحف بدل ما تبقى فيها فراغ كبير
  function spreadPage(m, p, endsSura) {
    const wrap = m.root.querySelector('.mpw'), body = m.root.querySelector('.mpb'), inner = body.querySelector('.mpi');
    wrap.style.setProperty('--lh', QLH); wrap.style.setProperty('--lhf', QLH);
    const h0 = inner.getBoundingClientRect().height, room = body.clientHeight;
    if (!h0 || room <= h0 * 1.02) return;
    let fixed = 0; inner.querySelectorAll('.msn,.mbi').forEach(x => { fixed += x.getBoundingClientRect().height; });   // العنوان والبسملة بيفضلوا بحجمهم
    const k = (room - fixed) / Math.max(1, h0 - fixed), cap = p <= 2 ? 1.9 : endsSura ? 1.35 : 1.6;
    wrap.style.setProperty('--lh', (QLH * Math.min(cap, k * 0.985)).toFixed(3));
    wrap.style.setProperty('--lhf', QLH);
  }
  // ضبط سطور الصفحة زي المصحف: كل سطر بيتملي بمسافات متقاربة + تكبير بسيط للخط (بدل كلمات متبعثرة بفراغات كبيرة)
  function fitLines(m, p) {
    const inner = m.root.querySelector('.mpi'), body = m.root.querySelector('.mpb');
    inner.classList.remove('fit');
    if (p <= 2) return;
    const Q = window.WZ_QURAN, ws = [...inner.querySelectorAll('.w')], W = inner.clientWidth;
    if (!ws.length || W < 160) return;
    const fs = parseFloat(getComputedStyle(body).fontSize) || 24;
    inner.style.textAlign = 'start'; inner.style.textAlignLast = 'start';   // قياس العرض الطبيعي من غير مطّ
    const lines = []; let cur = null;
    ws.forEach(w => {
      const r = w.getClientRects()[0]; if (!r) return;
      if (!cur || Math.abs(r.top - cur.top) > r.height * 0.6) { cur = { top: r.top, ws: [], l: r.left, r: r.right }; lines.push(cur); }
      cur.ws.push(w); cur.l = Math.min(cur.l, r.left); cur.r = Math.max(cur.r, r.right);
    });
    const plan = lines.map(L => {
      const last = L.ws[L.ws.length - 1], ay = last.parentElement, nx = ay.nextElementSibling;
      const lastInAy = !last.nextElementSibling || !last.nextElementSibling.classList.contains('w');
      const suraEnd = lastInAy && +ay.dataset.k === Q[+ay.dataset.i].t.length - 1 && (!nx || nx.classList.contains('msn'));
      let E = 0;   // علامات (الملاحظة / الحفظ) بعرض ثابت جوه السطر
      L.ws.forEach(w => {
        if (w.nextElementSibling && w.nextElementSibling.classList.contains('w')) return;
        for (let e = w.nextElementSibling; e && e.tagName === 'I'; e = e.nextElementSibling) {
          const mr = e.getBoundingClientRect(); if (Math.abs(mr.top - L.top) > fs) continue;
          E += mr.width + 4; L.l = Math.min(L.l, mr.left); L.r = Math.max(L.r, mr.right);
        }
      });
      return { L, E, nat: L.r - L.l, suraEnd };
    });
    const W0 = W - 0.8;
    plan.forEach(({ L, E, nat, suraEnd }) => {
      if (suraEnd) return;   // آخر سطر في السورة بيفضل بحجمه الطبيعي (متوسّط)
      const slack = W0 - nat; if (slack < 0.6) return;
      const g = L.ws.length - 1, Lw = Math.max(1, nat - E);
      let f = 1, sp = 0;
      if (g > 0) {
        const sp1 = Math.min(slack, g * fs * 0.13);               // الأول: نوسّع المسافات بحدّ مريح (صغير)
        f = 1 + Math.min((slack - sp1) / Lw, 0.14);                // بعدين نكبّر الخط (حتى ١٤٪)
        sp = Math.min((slack - (f - 1) * Lw) / g, fs * 0.42);      // والباقي مسافات — بسقف: السطر القصير (آخر الصفحة مثلاً) بيفضل متوسّط بدل ما يتبعثر
      } else f = 1 + Math.min(slack / Lw, 0.3);
      L.ws.forEach(w => { if (f > 1.0005) w.style.fontSize = f.toFixed(4) + 'em'; if (sp > 0.05) w.style.wordSpacing = sp.toFixed(2) + 'px'; });
    });
    lines.forEach((L, idx) => {   // فواصل صريحة بين السطور علشان الضبط ما يتبوّظش بإعادة التفاف
      if (!idx) return; const w0 = L.ws[0], br = document.createElement('br'); br.className = 'lb'; w0.parentNode.insertBefore(br, w0);
    });
    inner.style.textAlign = ''; inner.style.textAlignLast = '';
    inner.classList.add('fit');
  }
  function qClearSel(m) {
    if (m.selEl) m.selEl.classList.remove('picked');
    m.selEl = null; if (!m.pen) m.tool.classList.remove('on');
  }
  function qOpenPage(m, p, noAnim, drag) {
    buildPages(); p = Math.max(1, Math.min(604, p | 0));
    if (!m.fontOk) {   // نستنى خط المصحف يتحمّل قبل قياس السطور
      const go = () => { m.fontOk = true; qOpenPage(m, p, noAnim); };
      try { document.fonts.load('20px UthmanicHafs', 'ٱللَّه').then(go, go); } catch (_) { go(); }
      return;
    }
    qClearSel(m); closeSheet(m);
    const wasHidden = m.readBox.hidden;
    m.listBox.hidden = true; m.readBox.hidden = false;
    qWide(true);
    const wrap = m.root.querySelector('.mpw'), scr = m.root.querySelector('.mscr'), pg = m.root.querySelector('.mpage');
    // قلب الصفحة: نصوّر الصفحة القديمة قبل ما نرسم الجديدة
    const dir = !wasHidden && !noAnim && m.page && p !== m.page && !matchMedia('(prefers-reduced-motion: reduce)').matches ? (p > m.page ? 'n' : 'p') : '';
    let ghost = null;
    const an = QS.anim === 'slide' || QS.anim === 'rise' ? QS.anim : 'flip';
    if (dir) {
      flipEnd(m);
      const wr = wrap.getBoundingClientRect(), pr = pg.getBoundingClientRect();
      const dx = drag ? drag.dx || 0 : 0, dy = drag ? drag.dy || 0 : 0, o0 = drag && drag.o != null ? drag.o : 1;
      ghost = pg.cloneNode(true); ghost.classList.add('leaf'); ghost.classList.remove('turning', 'dragging', 'back', 'in-sl');
      ghost.querySelectorAll('.hlayer').forEach(x => x.remove());
      ghost.style.cssText = 'left:' + (pr.left - wr.left) + 'px;top:' + (pr.top - wr.top) + 'px;width:' + pr.width + 'px;height:' + pr.height + 'px;margin:0;';
      if (an === 'flip') ghost.classList.add(dir === 'n' ? 'n' : 'under');
      else {   // سحب جانبي (التالية بتخرج لليمين زي الكتاب العربي) أو طلوع/نزول
        const R = wr.width, Hh = wr.height, nx = dir === 'n';
        const GAP = 14, S = (R + GAP) * (nx ? 1 : -1);   // المسافة الكاملة بين الصفحتين (عرض الصفحة + فاصل صغير)
        const tx = an === 'slide' ? S : 0, ty = an === 'rise' ? (nx ? -Hh * 0.1 : Hh * 0.1) : 0;
        ghost.classList.add('sl'); if (an === 'slide') ghost.classList.add('st');
        ghost.style.setProperty('--tx', (tx - dx) + 'px'); ghost.style.setProperty('--ty', (ty - dy) + 'px'); ghost.style.setProperty('--o0', o0);
        pg.style.setProperty('--ix', (an === 'slide' ? dx - S : 0) + 'px');   // الجديدة بتبدأ ملاصقة للقديمة من الناحية التانية
        pg.style.setProperty('--iy', (an === 'rise' ? (nx ? Hh * 0.08 : -Hh * 0.08) : 0) + 'px');
      }
    }
    pg.classList.remove('dragging', 'back'); pg.style.transform = ''; pg.style.opacity = '';
    const list = drawPage(m, p); m.page = p; QS.last = p; qsSave(); khTrack(p); m.wcache = null; m.hsegs = m.hsegs || [];
    const Q = window.WZ_QURAN, first = Q[list[0][0]], lastS = Q[list[list.length - 1][0]];
    const body = m.root.querySelector('.mpb');
    const endsSura = list[list.length - 1][1] === lastS.t.length - 1;
    body.classList.toggle('full', p > 2 && !endsSura);
    body.classList.toggle('endc', p > 2 && endsSura);
    body.classList.toggle('mid', p <= 2);
    body.classList.toggle('top', p === 2);
    m.root.querySelector('.mphr').textContent = 'سورة ' + first.a;
    m.root.querySelector('.mphl').textContent = 'الجزء ' + AR(window.WZ_QPJ ? window.WZ_QPJ[p] : first.j);
    m.root.querySelector('.mpf').textContent = AR(p);
    m.readBox.querySelector('.mtt').textContent = 'سورة ' + first.a;
    m.readBox.querySelector('.mts').textContent = 'صفحة ' + AR(p) + ' من ٦٠٤';
    m.readBox.querySelector('.mprev').disabled = p === 1;
    m.readBox.querySelector('.mnext').disabled = p === 604;
    m.pin.value = p;
    fitFont(m); scr.scrollTop = 0;
    spreadPage(m, p, endsSura);
    fitLines(m, p);
    renderHL(m, true);
    if (ghost) flipStart(m, dir, ghost, pg, an);
  }
  function flipEnd(m) {
    const wrap = m.root.querySelector('.mpw'), pg = m.root.querySelector('.mpage');
    wrap.querySelectorAll(':scope > .leaf').forEach(x => x.remove());
    pg.classList.remove('turning', 'in-sl', 'st'); wrap.classList.remove('flip'); delete wrap.dataset.fd; clearTimeout(m.flipT);
  }
  function flipStart(m, dir, ghost, pg, an) {
    const wrap = m.root.querySelector('.mpw');
    wrap.classList.add('flip'); wrap.dataset.fd = dir; wrap.appendChild(ghost);
    if (an === 'slide' || an === 'rise') { void pg.offsetWidth; pg.classList.add('in-sl'); if (an === 'slide') pg.classList.add('st'); m.flipT = setTimeout(() => flipEnd(m), an === 'slide' ? 860 : 800); return; }
    if (dir === 'p') { void pg.offsetWidth; pg.classList.add('turning'); }   // السابقة: الصفحة الجديدة هي اللي بتتقلب فوق القديمة
    m.flipT = setTimeout(() => flipEnd(m), 980);
  }
  function closeSheet(m) { m.sheet.hidden = true; }
  function openSheet(m, title, node, small) {
    m.sheet.classList.toggle('sm', !!small);
    m.sheet.querySelector('.qst').textContent = title;
    const b = m.sheet.querySelector('.qsb'); b.textContent = ''; b.appendChild(node); m.sheet.hidden = false;
  }
  async function qTafsir(m, i, k) {
    const s = window.WZ_QURAN[i], box = document.createElement('div'); box.style.cssText = 'display:flex;flex-direction:column;gap:8px';
    box.textContent = 'جارٍ التحميل…'; openSheet(m, 'تفسير ' + s.a + ' · آية ' + AR(k + 1), box);
    try { await loadJs('tafsir-data.js'); } catch (_) { box.textContent = 'تعذّر تحميل التفسير'; return; }
    box.textContent = '';
    const q = document.createElement('div'); q.className = 'tfq'; q.textContent = s.t[k];
    const t = document.createElement('div'); t.className = 'tft'; t.textContent = window.WZ_TAFSIR[i][k] || '';
    box.append(q, t);
  }
  function qNote(m, i, k) {
    const key = ayKey(i, k), s = window.WZ_QURAN[i], box = document.createElement('div'); box.style.cssText = 'display:flex;flex-direction:column;gap:8px';
    const ta = document.createElement('textarea'); ta.className = 'num-in txt ta'; ta.maxLength = 600; ta.rows = 3; ta.placeholder = 'اكتب ملاحظتك على هذه الآية'; ta.value = QS.notes[key] || '';
    const row = document.createElement('div'); row.className = 'row';
    const ok = document.createElement('button'); ok.className = 'mbtn'; ok.textContent = 'حفظ الملاحظة';
    const del = document.createElement('button'); del.className = 'mbtn'; del.textContent = 'حذف'; del.hidden = !QS.notes[key];
    const done = v => { if (v) QS.notes[key] = v; else delete QS.notes[key]; qsSave(); const el = m.root.querySelector('.ay[data-i="' + i + '"][data-k="' + k + '"]'); if (el) ayState(el, i, k); closeSheet(m); };
    ok.onclick = () => done(ta.value.trim()); del.onclick = () => done('');
    row.append(ok, del); box.append(ta, row);
    openSheet(m, 'ملاحظة على ' + s.a + ' · آية ' + AR(k + 1), box, true); setTimeout(() => ta.focus(), 50);
  }
  function qMine(m) {
    buildPages(); const Q = window.WZ_QURAN, box = document.createElement('div');
    const keys = [...new Set([...Object.keys(QS.saved), ...Object.keys(QS.notes), ...Object.keys(QS.hl), ...Object.keys(QS.hw)])].map(x => x.split(':').map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (!keys.length) box.textContent = 'لسه ما حفظتش أو مَيّزت أو كتبت ملاحظة على أي آية.';
    keys.forEach(([n, a]) => {
      const s = Q[n - 1]; if (!s || !s.t[a - 1]) return; const key = n + ':' + a;
      const r = document.createElement('div'); r.className = 'mi';
      const b = document.createElement('b'); b.textContent = (QS.saved[key] ? '🔖 ' : '') + (QS.notes[key] ? '✎ ' : '') + ((QS.hl[key] || QS.hw[key]) ? '▮ ' : '') + s.a + ' ' + AR(a);
      const t = document.createElement('span'); t.textContent = QS.notes[key] || s.t[a - 1].slice(0, 70) + '…';
      r.append(b, t); r.onclick = () => { qOpenPage(m, s.pg[a - 1]); }; box.appendChild(r);
    });
    openSheet(m, 'علاماتي', box);
  }
  const PEN_COL = { m: '#3dffa3', y: '#ffd60a', p: '#ff7ab8', b: '#4cc9ff' };
  function penCursor(c) {
    const col = PEN_COL[c], ink = '%230b120d';
    const svg = c
      ? "<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><path d='M3 29l1.5-6 14-14 4.5 4.5-14 14z' fill='" + col.replace('#', '%23') + "' stroke='" + ink + "' stroke-width='1.6' stroke-linejoin='round'/><path d='M19.5 7.5l3-3 4.5 4.5-3 3z' fill='%23e8efe9' stroke='" + ink + "' stroke-width='1.6' stroke-linejoin='round'/></svg>"
      : "<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><path d='M4 24l12-12 8 8-6 6H8z' fill='%23f3b6c5' stroke='" + ink + "' stroke-width='1.6' stroke-linejoin='round'/><path d='M10 18l8 8' stroke='" + ink + "' stroke-width='1.4'/></svg>";
    return 'url("data:image/svg+xml,' + svg.replace(/</g, '%3C').replace(/>/g, '%3E') + '") ' + (c ? '3 29' : '6 24') + ', crosshair';
  }
  function qPenColor(m, c) {
    m.penC = c; QS.penC = c; qsSave();
    m.tsw.querySelectorAll('.sw[data-c]').forEach(b => b.classList.toggle('on', b.dataset.c === c));
    if (m.pen) m.root.querySelector('.mpi').style.cursor = penCursor(c);
  }
  function qPen(m, on) {
    m.pen = !!on;
    const wrap = m.root.querySelector('.mpw'), inner = m.root.querySelector('.mpi');
    wrap.classList.toggle('pen', m.pen);
    m.tool.classList.toggle('penmode', m.pen); m.tool.classList.toggle('dock', m.pen);
    m.tsw.hidden = !m.pen;
    m.tool.querySelector('[data-act=pen]').classList.toggle('act', m.pen);
    const pb = m.root.querySelector('.mpenb'); if (pb) pb.classList.toggle('act', m.pen);
    m.tool.classList.remove('on');
    if (m.pen) {
      if (m.selEl) { m.selEl.classList.remove('picked'); m.selEl = null; }
      closeSheet(m); m.tool.style.left = ''; m.tool.style.top = '';
      void m.tool.offsetWidth; m.tool.classList.add('on');
      qPenColor(m, m.penC);
    } else inner.style.cursor = '';
  }
  // تلوين كلمة (أو إزالة اللون). بيرجع true لو حصل تغيير (الرسم نفسه في renderHL)
  function wordSet(w, c) {
    const ay = w.closest('.ay'), key = ayKey(+ay.dataset.i, +ay.dataset.k), j = w.dataset.j;
    if (QS.hl[key]) {   // تمييز قديم على الآية كلها: نحوّله لكلمات علشان نعدّل جزء منه
      const old = QS.hl[key], h0 = QS.hw[key] = {}; delete QS.hl[key];
      ay.querySelectorAll('.w').forEach(x => { h0[x.dataset.j] = old; });
    }
    const hw = QS.hw[key] || (QS.hw[key] = {});
    if ((hw[j] || '') === c) { if (!Object.keys(hw).length) delete QS.hw[key]; return false; }
    if (c) hw[j] = c; else delete hw[j];
    if (!Object.keys(hw).length) delete QS.hw[key];
    return true;
  }
  function penAyah(m, ay) {   // ضغطة واحدة بالقلم = الآية كلها (ولو كلها بنفس اللون بتتشال)
    const ws = [...ay.querySelectorAll('.w')], c = m.penC, key = ayKey(+ay.dataset.i, +ay.dataset.k);
    const cur = (j) => (QS.hw[key] || {})[j] || QS.hl[key] || '';
    const all = c && ws.every(w => cur(w.dataset.j) === c);
    ws.forEach(w => wordSet(w, all ? '' : c));
    qsSave(); renderHL(m);
  }
  // ───── رسم التمييز: شرائط ناعمة مدمجة تحت النص (كلمات متتالية على نفس السطر = شريط واحد) ─────
  function hlMeasure(m) {
    const inner = m.root.querySelector('.mpi'), ir = inner.getBoundingClientRect(), out = [];
    const sx = (inner.offsetWidth && ir.width / inner.offsetWidth) || 1, sy = (inner.offsetHeight && ir.height / inner.offsetHeight) || 1;   // لو أي أب عليه تكبير/تصغير (أنيميشن) نرجّع القياس لمقاس الصفحة الحقيقي
    inner.querySelectorAll('.w').forEach(w => {
      const r = w.getClientRects()[0]; if (!r) return;
      const ay = w.parentElement;
      out.push({ i: +ay.dataset.i, k: +ay.dataset.k, j: +w.dataset.j, l: (r.left - ir.left) / sx, r: (r.right - ir.left) / sx, t: (r.top - ir.top) / sy, h: r.height / sy });
    });
    return out;
  }
  function renderHL(m, fresh) {
    const inner = m.root.querySelector('.mpi'); if (!inner) return;
    let layer = inner.querySelector('.hlayer');
    if (!layer || fresh) { if (layer) layer.remove(); layer = document.createElement('div'); layer.className = 'hlayer'; inner.prepend(layer); m.hsegs = []; }
    const words = m.wcache || (m.wcache = hlMeasure(m)), segs = [];
    let cur = null;
    for (const w of words) {
      const key = ayKey(w.i, w.k), c = (QS.hw[key] || {})[w.j] || QS.hl[key] || '';
      if (c && cur && cur.c === c && Math.abs(cur.t - w.t) < 4) { cur.l = Math.min(cur.l, w.l); cur.r = Math.max(cur.r, w.r); }
      else { cur = c ? { c, t: w.t, h: w.h, l: w.l, r: w.r } : null; if (cur) segs.push(cur); }
    }
    const old = m.hsegs, used = new Set(), next = [];
    for (const g of segs) {
      let hit = null;
      for (const o of old) if (!used.has(o) && o.c === g.c && Math.abs(o.t - g.t) < 4 && o.r >= g.l - 1 && o.l <= g.r + 1) { hit = o; break; }
      const band = g.h * 0.80, top = g.t + g.h * 0.12;
      let el;
      if (hit) { used.add(hit); el = hit.el; }
      else { el = document.createElement('div'); el.className = 'hs c-' + g.c; layer.appendChild(el); el.style.left = g.l - 2 + 'px'; el.style.width = (g.r - g.l + 4) + 'px'; }
      el.style.top = top + 'px'; el.style.height = band + 'px';
      el.style.left = g.l - 2 + 'px'; el.style.width = (g.r - g.l + 4) + 'px';
      next.push({ el, c: g.c, t: g.t, l: g.l, r: g.r });
    }
    for (const o of old) if (!used.has(o)) { o.el.classList.add('out'); const e = o.el; setTimeout(() => e.remove(), 200); }
    m.hsegs = next;
  }
  // ═════ لقطة الآية/الآيات: صورة بتتحفظ على جهازك (إطار + اسم السورة + النص + اللوجو و«بواسطة تطبيق WZAKER» بس) ═════
  const SHOT_MAX_WORDS = 260;   // أقصى عدد كلمات في الصورة الواحدة (علشان الصورة ما تطولش قوي)
  function shotDiamond(c, x, y, r) { c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r, y); c.lineTo(x, y + r); c.lineTo(x - r, y); c.closePath(); }
  const shotWords = (s, k1, k2) => { let n = 0; for (let v = k1; v <= k2; v++) n += s.t[v].split(/\s+/).filter(Boolean).length; return n; };
  // k1..k2 = أرقام الآيات (من صفر) — آية واحدة لو k1 === k2
  function shotCanvas(s, k1, k2, logo, banner) {
    const W = 1080, SC = 1.5, PX = 120, AC = '54,226,172', ACC = '#38E2AC', TXT = '#f1f7f3', DIM = '#7fb5a0', BG = '#07140e';
    const PAN = [10, 34, 25], MID = [24, 128, 98], MINT = [64, 236, 180];   // ألوان لافتة الزخرفة: الفاتح بيبقى غامق (لون الخلفية) والخطوط بتبقى أخضر التطبيق
    const A = a => 'rgba(' + AC + ',' + a + ')';
    const n0 = shotWords(s, k1, k2);
    const FS = n0 <= 14 ? 76 : n0 <= 30 ? 60 : n0 <= 60 ? 50 : n0 <= 110 ? 42 : 35, LH = FS * 2;
    const HF = n => n + 'px UthmanicHafs', AF = n => n + "px 'Hail Elastic Plain',sans-serif", LF = n => '600 ' + n + "px 'Segoe UI','Inter','Helvetica Neue',Arial,sans-serif";
    const mc = document.createElement('canvas').getContext('2d'); mc.direction = 'rtl'; mc.font = HF(FS);
    const sp = Math.max(mc.measureText(' ').width, FS * 0.26), MD = FS * 0.95;   // MD = قطر ميدالية رقم الآية
    const units = [];
    for (let v = k1; v <= k2; v++) {
      const us = s.t[v].split(/\s+/).filter(Boolean).map(a => ({ a, w: mc.measureText(a).width }));
      if (us.length > 1 && /^[\d٠-٩]+$/.test(us[us.length - 1].a)) {   // رقم الآية ملزوق بآخر كلمة
        const nb = us.pop(), pa = us.pop(), gap = sp * 0.5;
        us.push({ a: pa.a, b: nb.a, wa: pa.w, gap, w: pa.w + gap + MD });
      }
      units.push(...us);
    }
    const MAXW = W - PX * 2;
    const wrapAt = lim => {
      const out = []; let cur = [], cw = 0;
      units.forEach(u => { if (cur.length && cw + sp + u.w > lim) { out.push({ us: cur, w: cw }); cur = []; cw = 0; } cw += (cur.length ? sp : 0) + u.w; cur.push(u); });
      if (cur.length) out.push({ us: cur, w: cw }); return out;
    };
    let lines = wrapAt(MAXW), TW = MAXW;
    if (lines.length > 1) {   // سطور متوازنة: أضيق عرض يدّي نفس عدد السطور (من غير فراغات كبيرة)
      let lo = Math.max(...units.map(u => u.w)), hi = MAXW; const target = lines.length;
      while (hi - lo > 3) { const mid = (lo + hi) / 2; if (wrapAt(mid).length <= target) hi = mid; else lo = mid; }
      lines = wrapAt(hi); TW = hi;
    } else TW = lines[0].w;
    const bism = k1 === 0 && s.n !== 1 && s.n !== 9, cx = W / 2;
    // ── المقاسات: لافتة الزخرفة فوق، النص في النص، والفوتر (معلومات + لوجو + «بواسطة تطبيق WZAKER») تحت
    const hasB = !!(banner && banner.naturalWidth), BW = W - 80, BH = hasB ? Math.round(BW * banner.naturalHeight / banner.naturalWidth) : 110, BX = (W - BW) / 2, BY = 56;
    const infoY = BY + BH + 62, BODY_Y = infoY + 58, bodyH = lines.length * LH + (bism ? LH * 0.95 : 0);
    const LOGO_H = 84, logoTop = BODY_Y + bodyH + 54, wzY = logoTop + LOGO_H + 52, botY = wzY + 62, H = Math.round(botY + 58);
    const cv = document.createElement('canvas'); cv.width = Math.round(W * SC); cv.height = Math.round(H * SC);
    const c = cv.getContext('2d'); c.scale(SC, SC); c.direction = 'rtl'; c.textBaseline = 'alphabetic';
    // ── الخلفية: أخضر التطبيق الغامق + إضاءة ناعمة من ورا اللافتة + ظل خفيف على الأطراف + حبيبات ورق خفيفة جدًا
    let g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0a1d14'); g.addColorStop(0.55, BG); g.addColorStop(1, '#050d08'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    g = c.createRadialGradient(cx, BY + BH / 2, 20, cx, BY + BH / 2, W * 0.8); g.addColorStop(0, A(.13)); g.addColorStop(1, A(0)); c.fillStyle = g; c.fillRect(0, 0, W, H);
    g = c.createRadialGradient(cx, H, 10, cx, H, Math.min(H * 0.5, 620)); g.addColorStop(0, A(.07)); g.addColorStop(1, A(0)); c.fillStyle = g; c.fillRect(0, 0, W, H);
    g = c.createRadialGradient(cx, H / 2, Math.min(W, H) * 0.35, cx, H / 2, Math.max(W, H) * 0.72); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.38)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    try {
      const gc = document.createElement('canvas'); gc.width = gc.height = 160; const gx = gc.getContext('2d'), gi = gx.createImageData(160, 160);
      for (let i = 0; i < gi.data.length; i += 4) { const v = 200 + Math.random() * 55; gi.data[i] = v; gi.data[i + 1] = 255; gi.data[i + 2] = v; gi.data[i + 3] = Math.random() * 9; }
      gx.putImageData(gi, 0, 0); c.fillStyle = c.createPattern(gc, 'repeat'); c.fillRect(0, 0, W, H);
    } catch (_) {}
    // ── لافتة الزخرفة (صورة الشريط) بألوان التطبيق: بنحوّل درجات الصورة لتدرّج بين لون الخلفية وأخضر التطبيق
    if (hasB) {
      const o = document.createElement('canvas'); o.width = Math.round(BW * SC); o.height = Math.round(BH * SC);
      const ox = o.getContext('2d'); ox.drawImage(banner, 0, 0, o.width, o.height);
      const id = ox.getImageData(0, 0, o.width, o.height), d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) continue;
        let t = (0.95 - (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255) / 0.78; t = t < 0 ? 0 : t > 1 ? 1 : Math.pow(t, 0.85);
        const u = t < 0.5 ? t * 2 : (t - 0.5) * 2, a0 = t < 0.5 ? PAN : MID, a1 = t < 0.5 ? MID : MINT;
        d[i] = a0[0] + (a1[0] - a0[0]) * u; d[i + 1] = a0[1] + (a1[1] - a0[1]) * u; d[i + 2] = a0[2] + (a1[2] - a0[2]) * u;
      }
      ox.putImageData(id, 0, 0);
      c.save(); c.shadowColor = A(.24); c.shadowBlur = 22; c.drawImage(o, BX, BY, BW, BH); c.restore();
    }
    // اسم السورة جوه اللافتة (الجزء الفاضي في النص)
    const title = 'سورة ' + s.a, panW = BW * 0.41 - 56; let tfs = 56; c.font = HF(tfs);
    while (c.measureText(title).width > panW && tfs > 26) { tfs -= 2; c.font = HF(tfs); }
    c.textAlign = 'center'; c.fillStyle = ACC; c.shadowColor = A(.5); c.shadowBlur = 16; c.fillText(title, cx, BY + BH / 2 + tfs * 0.3); c.shadowBlur = 0;
    // ── نص الآية/الآيات (رقم الآية جوه ميدالية مزخرفة)
    let y = BODY_Y;
    if (bism) { c.textAlign = 'center'; c.fillStyle = ACC; c.font = HF(FS * 0.9); c.fillText(BISM, cx, y + LH * 0.66); y += LH * 0.95; }
    c.font = HF(FS); c.textAlign = 'right';
    const medal = (mx, my, R, txt) => {
      c.beginPath(); for (let a = 0; a <= 360; a += 3) { const t = a * Math.PI / 180, r = R * (1 + 0.075 * Math.cos(t * 12)); a ? c.lineTo(mx + r * Math.cos(t), my + r * Math.sin(t)) : c.moveTo(mx + r, my); }
      c.closePath(); c.strokeStyle = A(.9); c.lineWidth = 2; c.stroke();
      c.beginPath(); c.arc(mx, my, R * 0.8, 0, Math.PI * 2); c.strokeStyle = A(.4); c.lineWidth = 1.2; c.stroke();
      c.save(); c.textAlign = 'center'; c.fillStyle = ACC; c.font = HF(Math.round(R * (txt.length > 2 ? 0.95 : 1.3))); c.fillText(txt, mx, my + R * 0.36); c.restore();
    };
    lines.forEach((L, li) => {
      const n = L.us.length, sum = L.us.reduce((a, u) => a + u.w, 0), base = y + li * LH + LH * 0.66;
      let gap = sp, x;
      if (li < lines.length - 1 && n > 1 && (TW - sum) / (n - 1) <= sp * 1.9) { gap = (TW - sum) / (n - 1); x = cx + TW / 2; }
      else x = cx + (sum + (n - 1) * sp) / 2;
      L.us.forEach(u => {
        c.font = HF(FS); c.textAlign = 'right';
        c.fillStyle = TXT; c.shadowColor = A(.16); c.shadowBlur = 10; c.fillText(u.a, x, base); c.shadowBlur = 0;
        if (u.b) medal(x - u.wa - u.gap - MD / 2, base - FS * 0.3, MD / 2 * 0.92, u.b);
        x -= u.w + gap;
      });
    });
    // ── سطر المعلومات الهادي: الآيات · الجزء · الصفحة (أرقام لاتينية)
    const pg1 = s.pg[k1], pg2 = s.pg[k2], j1 = window.WZ_QPJ ? window.WZ_QPJ[pg1] : s.j, j2 = window.WZ_QPJ ? window.WZ_QPJ[pg2] : s.j;
    const info = [
      k1 === k2 ? ['الآية', String(k1 + 1)] : ['الآيات', (k1 + 1) + ' – ' + (k2 + 1)],
      ['الجزء', j1 + (j2 !== j1 ? ' – ' + j2 : '')],
      pg1 === pg2 ? ['صفحة', String(pg1)] : ['الصفحات', pg1 + ' – ' + pg2]
    ];
    const NF = "500 26px 'Segoe UI','Inter','Helvetica Neue',Arial,sans-serif", NG = 10;
    const iw = info.map(([t, v]) => { c.font = AF(27); const a1 = c.measureText(t).width; c.font = NF; return { a1, a2: c.measureText(v).width }; });
    const IG = 50, itot = iw.reduce((a, o) => a + o.a1 + NG + o.a2, 0) + IG * (info.length - 1);
    let ix = cx + itot / 2; c.textAlign = 'right';
    info.forEach(([t, v], n) => {
      c.fillStyle = DIM; c.font = AF(27); c.fillText(t, ix, infoY); ix -= iw[n].a1 + NG;
      c.font = NF; c.fillStyle = '#d4ece1'; c.direction = 'ltr'; c.textAlign = 'left'; c.fillText(v, ix - iw[n].a2, infoY); c.direction = 'rtl'; c.textAlign = 'right'; ix -= iw[n].a2;
      if (n < info.length - 1) { shotDiamond(c, ix - IG / 2, infoY - 9, 4); c.fillStyle = A(.8); c.fill(); ix -= IG; }
    });
    // ── الفوتر: اللوجو + «بواسطة تطبيق WZAKER» + ماسة صغيرة بخطين بيتلاشوا
    if (logo && logo.naturalWidth) { const lw = LOGO_H * logo.naturalWidth / logo.naturalHeight; c.drawImage(logo, (W - lw) / 2, logoTop, lw, LOGO_H); }
    const tb = 'WZAKER', ta = 'بواسطة تطبيق', GP = 16, LS = 5;
    c.font = AF(28); c.direction = 'rtl'; const wa = c.measureText(ta).width;
    c.font = LF(30); c.letterSpacing = LS + 'px'; const wl = c.measureText(tb).width - LS; c.letterSpacing = '0px';
    const tot = wa + GP + wl, xr = cx + tot / 2;
    c.textAlign = 'right'; c.fillStyle = DIM; c.font = AF(28); c.fillText(ta, xr, wzY);
    c.fillStyle = ACC; c.font = LF(30); c.letterSpacing = LS + 'px'; c.direction = 'ltr'; c.textAlign = 'left'; c.fillText(tb, xr - wa - GP - wl, wzY); c.letterSpacing = '0px'; c.direction = 'rtl';
    [-1, 1].forEach(sg => {
      const lg = c.createLinearGradient(cx + sg * 22, 0, cx + sg * 200, 0); lg.addColorStop(0, A(.55)); lg.addColorStop(1, A(0));
      c.strokeStyle = lg; c.lineWidth = 1.5; c.beginPath(); c.moveTo(cx + sg * 22, botY); c.lineTo(cx + sg * 200, botY); c.stroke();
    });
    shotDiamond(c, cx, botY, 7); c.fillStyle = BG; c.fill(); c.strokeStyle = A(.9); c.lineWidth = 1.8; c.stroke(); shotDiamond(c, cx, botY, 2.6); c.fillStyle = ACC; c.fill();
    return cv;
  }
  let SHOT_BANNER = null;
  async function shotBanner() {
    if (SHOT_BANNER) return SHOT_BANNER;
    try { const d = await window.azkar.getBannerData(); if (d) { const img = new Image(); img.src = d; await img.decode(); SHOT_BANNER = img; } } catch (_) {}
    return SHOT_BANNER;
  }
  let SHOT_LOGO = null;
  async function shotLogo() {
    if (SHOT_LOGO) return SHOT_LOGO;
    try { const d = await window.azkar.getLogoData(); if (d) { const img = new Image(); img.src = d; await img.decode(); SHOT_LOGO = img; } } catch (_) {}
    return SHOT_LOGO;
  }
  function qToast(m, text, path) {
    const t = m.root.querySelector('.qtoast'), b = t.querySelector('.qtb');
    t.querySelector('.qtt').textContent = text; b.hidden = !path; b.onclick = () => { try { window.azkar.showInFolder(path); } catch (_) {} t.hidden = true; };
    t.hidden = false; clearTimeout(m.toastT); m.toastT = setTimeout(() => { t.hidden = true; }, 5500);
  }
  // اختيار النطاق: «من سورة … / من آية … إلى آية …» (الافتراضي = الآية المختارة بس) ثم حفظ الصورة
  function qShotPick(m, i0, k0) {
    const Q = window.WZ_QURAN, box = document.createElement('div');
    let cur = i0;
    box.style.cssText = 'display:flex;flex-direction:column;gap:10px';
    const mk = v => { const e = document.createElement('input'); e.type = 'number'; e.className = 'num-in'; e.min = 1; e.value = v; return e; };
    const lab = t => { const x = document.createElement('span'); x.textContent = t; return x; };
    const sel = document.createElement('select'); sel.className = 'num-in sel shsel'; sel.setAttribute('aria-label', 'السورة');
    Q.forEach((q, n) => { const o = document.createElement('option'); o.value = n; o.textContent = AR(q.n) + ' · ' + q.a + ' (' + AR(q.t.length) + ' آية)'; sel.appendChild(o); });
    sel.value = cur;
    const r0 = document.createElement('div'); r0.className = 'shrow'; r0.append(lab('من سورة'), sel);
    const a = mk(k0 + 1), b = mk(k0 + 1), row = document.createElement('div'); row.className = 'shrow'; row.append(lab('من آية'), a, lab('إلى آية'), b);
    const info = document.createElement('div'); info.className = 'shinfo';
    const act = document.createElement('div'); act.className = 'row';
    const ok = document.createElement('button'); ok.className = 'mbtn'; ok.textContent = 'حفظ الصورة';
    const one = document.createElement('button'); one.className = 'mbtn'; one.textContent = 'الآية المحددة فقط';
    act.append(ok, one); box.append(r0, row, info, act);
    const lim = () => { const N = Q[cur].t.length; a.max = b.max = N; return N; };
    const read = () => {
      const N = lim(); let x = Math.round(+a.value) || 1, z = Math.round(+b.value) || x;
      x = Math.min(N, Math.max(1, x)); z = Math.min(N, Math.max(1, z)); if (z < x) [x, z] = [z, x];
      return [x - 1, z - 1];
    };
    const cnt = n => n === 1 ? 'آية واحدة' : n === 2 ? 'آيتان' : n <= 10 ? AR(n) + ' آيات' : AR(n) + ' آية';
    const upd = () => {
      const [x, z] = read(), s = Q[cur], w = shotWords(s, x, z), over = w > SHOT_MAX_WORDS;
      info.textContent = over ? 'النطاق كبير على صورة واحدة (الحد الأقصى حوالي ' + AR(SHOT_MAX_WORDS) + ' كلمة) — قلّل عدد الآيات.' : 'سورة ' + s.a + ' · ' + cnt(z - x + 1) + ' · ' + AR(w) + ' كلمة';
      info.classList.toggle('warn', over); ok.disabled = over;
    };
    const fix = () => { const [x, z] = read(); a.value = x + 1; b.value = z + 1; upd(); };
    sel.onchange = () => { cur = +sel.value; a.value = b.value = 1; fix(); a.focus(); a.select(); };   // سورة جديدة: نبدأ من أول آية
    a.oninput = b.oninput = upd; a.onchange = b.onchange = fix;
    one.onclick = () => { cur = i0; sel.value = i0; lim(); a.value = b.value = k0 + 1; upd(); };
    ok.onclick = () => { fix(); if (ok.disabled) return; const [x, z] = read(); closeSheet(m); qShot(m, cur, x, z); };
    [a, b].forEach(e => e.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.stopPropagation(); ok.click(); } }));
    openSheet(m, 'لقطة آيات', box, true); upd(); setTimeout(() => { b.focus(); b.select(); }, 50);
  }
  async function qShot(m, i, k1, k2) {
    if (m.shooting) return;
    if (k2 == null) k2 = k1;
    const s = window.WZ_QURAN[i], tb = m.tool.querySelector('[data-act=shot]'), el = m.selEl;
    m.shooting = true; tb.classList.add('act');
    if (el) { el.classList.remove('shotflash'); void el.offsetWidth; el.classList.add('shotflash'); setTimeout(() => el.classList.remove('shotflash'), 760); }
    try {
      await Promise.all([document.fonts.load('40px UthmanicHafs', s.t.slice(k1, k2 + 1).join(' ')), document.fonts.load("26px 'Hail Elastic Plain'", 'الآية')].map(pr => pr.catch(() => {})));
      const [logo, banner] = await Promise.all([shotLogo(), shotBanner()]);
      const cv = shotCanvas(s, k1, k2, logo, banner);
      const d = new Date(), z = n => String(n).padStart(2, '0');
      const name = 'WZAKER_' + z(s.n) + '_' + (k1 + 1) + (k2 > k1 ? '-' + (k2 + 1) : '') + '_' + d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate()) + '_' + z(d.getHours()) + z(d.getMinutes()) + z(d.getSeconds());
      const r = await window.azkar.saveAyahImage(cv.toDataURL('image/png'), name);
      if (r && r.ok) qToast(m, (k2 > k1 ? 'اتحفظت صورة الآيات ' + AR(k1 + 1) + ' – ' + AR(k2 + 1) : 'اتحفظت صورة الآية') + ' في مجلد الصور (WZAKER)', r.path); else qToast(m, 'تعذّر حفظ الصورة');
    } catch (_) { qToast(m, 'تعذّر حفظ الصورة'); }
    m.shooting = false; tb.classList.remove('act');
  }
  function qSetup(m, q) {
    m.page = 0; m.selEl = null; m.pen = false; m.penC = PEN_COL[QS.penC] ? QS.penC : 'y';
    m.tool = q('.mtool'); m.tsw = q('.tsw'); m.sheet = q('.qsheet'); m.pin = q('.mpin'); m.tip = q('.ntip');
    const goTo = p => qOpenPage(m, p);
    q('.mprev').onclick = () => goTo(m.page - 1); q('.mnext').onclick = () => goTo(m.page + 1);
    m.pin.onchange = () => goTo(Number(m.pin.value) || m.page);
    m.pin.onkeydown = e => { if (e.key === 'Enter') { e.stopPropagation(); goTo(Number(m.pin.value) || m.page); m.pin.blur(); } };
    const wb = q('.mwird'); if (wb) wb.onclick = () => { wb.hidden = true; window.azkar.patch({ wirdDone: true }); };   // الورد خلص: الأيقونة في المسبحة بتختفي لحد بكرة
    q('.mback').onclick = () => { qPen(m, false); qClearSel(m); closeSheet(m); showList(m); qContinue(m); qWide(false); };
    q('.mmine').onclick = () => qMine(m);
    ['.mback', '.mmine', '.msbtn'].forEach(sel => { const b = q(sel); if (b) b.addEventListener('click', () => qoSet(false)); });
    { const pb = q('.mpenb'); if (pb) pb.onclick = e => { e.stopPropagation(); qPen(m, !m.pen); }; }
    q('.qsx').onclick = () => closeSheet(m);
    window.addEventListener('keydown', e => {
      if (!m.root.classList.contains('on') || m.readBox.hidden) return;
      if (e.key === 'Escape' && m.pen) { qPen(m, false); e.stopImmediatePropagation(); return; }
      if (/INPUT|TEXTAREA/.test((e.target || {}).tagName || '')) return;
      if (e.key === 'ArrowLeft') goTo(m.page + 1); else if (e.key === 'ArrowRight') goTo(m.page - 1);
    }, true);
    const inner = q('.mpi'), wrap = q('.mpw');
    // عجلة الماوس: بتسكرول الصفحة، ولما توصل لآخرها (أو أولها) وتكمّل بتقلّب الصفحة
    const scr = q('.mscr');
    wrap.addEventListener('wheel', e => {
      if (Math.abs(e.deltaY) < 8) return;
      const now = Date.now(), fits = scr.scrollHeight <= scr.clientHeight + 4;
      const edge = fits || (e.deltaY > 0 ? scr.scrollTop + scr.clientHeight >= scr.scrollHeight - 2 : scr.scrollTop <= 1);
      if (!edge) { m.wm = now; return; }
      if (!fits && now - (m.wm || 0) < 380) return;          // لسه واصل للحافة بزخم السكرول: ما نقلّبش على طول
      if (now - (m.wt || 0) < 750) return; m.wt = now;
      goTo(m.page + (e.deltaY > 0 ? 1 : -1));
    }, { passive: true });
    scr.addEventListener('scroll', () => { if (!m.pen) qClearSel(m); }, { passive: true });
    const fr = q('.qfr'); let frRaf = 0;
    const fsApply = v => {
      QS.fs = Math.max(QFS_MIN, Math.min(QFS_MAX, Math.round(v))); qsSave(); fr.value = QS.fs;
      cancelAnimationFrame(frRaf); frRaf = requestAnimationFrame(() => { if (m.page) qOpenPage(m, m.page, true); });
    };
    fr.min = QFS_MIN; fr.max = QFS_MAX; fr.value = qFont();
    fr.oninput = () => fsApply(+fr.value);
    fr.onclick = e => e.stopPropagation();
    const fsBox = q('.qfs'), fsBar = q('.qopts');
    const fsOpen = on => { fsBox.classList.toggle('on', on); fsBar.classList.toggle('fs', on); q('.qft').setAttribute('aria-expanded', String(on)); if (on) fr.value = qFont(); };
    q('.qft').onclick = e => { e.stopPropagation(); fsOpen(true); };
    q('.fsx').onclick = e => { e.stopPropagation(); fsOpen(false); };
    q('.mhr').querySelectorAll('.mfs').forEach(b => b.onclick = e => { e.stopPropagation(); fsApply(qFont() + Number(b.dataset.d) * 2); });
    // ───── حركة الصفحة: اختيار الشكل (جنب أزرار الخط) + سحب بالماوس/اللمس ─────
    const amb = q('.manim'), amenu = q('.manimmenu');
    const animSync = () => {
      const cur = QS.anim === 'slide' || QS.anim === 'rise' ? QS.anim : 'flip';
      amenu.querySelectorAll('.mopt').forEach(b => { const on = b.dataset.a === cur; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); });
      scr.style.touchAction = cur === 'rise' ? '' : 'pan-y';
    };
    const animClose = () => { amenu.hidden = true; amb.classList.remove('act'); };
    amb.onclick = e => {
      e.stopPropagation();
      if (!amenu.hidden) return animClose();
      animSync(); amenu.hidden = false; amb.classList.add('act');
      const r = amb.getBoundingClientRect(), mw = amenu.offsetWidth;
      amenu.style.top = (r.bottom + 6) + 'px';
      amenu.style.left = Math.max(8, Math.min(window.innerWidth - mw - 8, r.left + r.width / 2 - mw / 2)) + 'px';
    };
    amenu.onclick = e => { const o = e.target.closest('.mopt'); if (!o) return; QS.anim = o.dataset.a; qsSave(); animSync(); animClose(); };
    document.addEventListener('click', e => { if (!amenu.hidden && !e.target.closest('.manimmenu, .manim')) animClose(); });
    window.addEventListener('keydown', e => { if (e.key === 'Escape' && !amenu.hidden) { animClose(); e.stopImmediatePropagation(); } }, true);
    animSync();
    const follow = () => QS.anim === 'slide' || QS.anim === 'rise', axisOf = () => (QS.anim === 'rise' ? 'y' : 'x');
    let sw = null;
    scr.addEventListener('pointerdown', e => {
      if (m.pen || e.button !== 0 || wrap.classList.contains('flip') || (axisOf() === 'y' && e.pointerType === 'touch')) return;
      sw = { id: e.pointerId, ax: axisOf(), x: e.clientX, y: e.clientY, on: false, d: 0, sign: 1, ok: true, vel: 0, lastP: 0, lastT: performance.now(), o: 1 };
    });
    scr.addEventListener('pointermove', e => {
      if (!sw || e.pointerId !== sw.id) return;
      const dx = e.clientX - sw.x, dy = e.clientY - sw.y, v = sw.ax === 'x' ? dx : dy, cr = sw.ax === 'x' ? dy : dx;
      const sign = sw.ax === 'x' ? (v > 0 ? 1 : -1) : (v < 0 ? 1 : -1);   // يمين = التالية (زي الكتاب العربي) / لفوق = التالية
      if (!sw.on) {
        if (Math.abs(v) < 10) return;
        if (Math.abs(v) < Math.abs(cr) * 1.3) { sw = null; return; }          // حركة عكس الاتجاه (تحديد / سكرول): ما نسحبش
        if (sw.ax === 'y') {   // لفوق/تحت: ما نسحبش إلا لو الصفحة وصلت للحافة (غير كده بتسكرول)
          const fits = scr.scrollHeight <= scr.clientHeight + 4, atEnd = scr.scrollTop + scr.clientHeight >= scr.scrollHeight - 2, atTop = scr.scrollTop <= 1;
          if (!fits && !(sign > 0 ? atEnd : atTop)) { sw = null; return; }
        }
        sw.on = true; sw.pg = m.root.querySelector('.mpage');
        try { scr.setPointerCapture(e.pointerId); } catch (_) {}
        scr.classList.add('drag'); qClearSel(m);
        try { getSelection().removeAllRanges(); } catch (_) {}
        if (follow()) { sw.pg.classList.remove('back'); sw.pg.classList.add('dragging'); }
      }
      sw.sign = sign; sw.ok = sign > 0 ? m.page < 604 : m.page > 1; sw.d = v * (sw.ok ? 0.92 : 0.2);
      const now = performance.now(); if (now > sw.lastT) sw.vel = (v - sw.lastP) / (now - sw.lastT); sw.lastP = v; sw.lastT = now;
      if (follow()) {
        const size = sw.ax === 'x' ? wrap.clientWidth : wrap.clientHeight;
        const pr = Math.min(1, Math.abs(sw.d) / size);
        if (QS.anim === 'slide') { sw.o = 1; sw.pg.style.transform = 'translate3d(' + sw.d + 'px, 0, 0)'; sw.pg.style.opacity = ''; }
        else {
        sw.o = 1 - Math.min(0.3, pr * 0.45);
        sw.pg.style.transform = (sw.ax === 'x' ? 'translateX(' : 'translateY(') + sw.d + 'px) scale(' + (1 - pr * 0.03).toFixed(4) + ')'; sw.pg.style.opacity = sw.o; }
      }
    });
    const swEnd = e => {
      if (!sw || (e && e.pointerId !== sw.id)) return;
      const s = sw; sw = null; if (!s.on) return;
      try { scr.releasePointerCapture(s.id); } catch (_) {}
      scr.classList.remove('drag'); m.noClick = Date.now();
      const size = s.ax === 'x' ? wrap.clientWidth : wrap.clientHeight, pg = s.pg || m.root.querySelector('.mpage');
      const fast = Math.abs(s.vel) > 0.55 && Math.sign(s.vel) === Math.sign(s.lastP);
      const go = e.type !== 'pointercancel' && s.ok && (Math.abs(s.d) > size * 0.18 || fast || (!follow() && Math.abs(s.lastP) > 70));
      if (go) qOpenPage(m, m.page + s.sign, false, follow() ? { dx: s.ax === 'x' ? s.d : 0, dy: s.ax === 'y' ? s.d : 0, o: s.o } : null);
      else if (follow()) { pg.classList.add('back'); pg.classList.remove('dragging'); pg.style.transform = ''; pg.style.opacity = ''; setTimeout(() => pg.classList.remove('back'), 420); }
    };
    scr.addEventListener('pointerup', swEnd); scr.addEventListener('pointercancel', swEnd);
    wrap.addEventListener('click', e => { if (Date.now() - (m.noClick || 0) < 120) { e.stopPropagation(); e.preventDefault(); } }, true);
    // الخيارات العائمة: بتظهر فوق السطر اللي ضغطت عليه
    inner.addEventListener('click', e => {
      if (m.pen) return;
      const el = e.target.closest('.ay'); if (!el) return;
      e.stopPropagation();
      if (m.selEl === el) { qClearSel(m); return; }
      qClearSel(m); m.selEl = el; el.classList.add('picked');
      const i = +el.dataset.i, k = +el.dataset.k, key = ayKey(i, k);
      m.tool.querySelector('[data-act=save]').classList.toggle('act', !!QS.saved[key]);
      m.tool.classList.remove('dock', 'penmode'); m.tsw.hidden = true;
      void m.tool.offsetWidth; m.tool.classList.add('on');
      const wr = wrap.getBoundingClientRect(), tw = m.tool.offsetWidth, th = m.tool.offsetHeight;
      const rects = [...el.getClientRects()], er = rects.find(r => e.clientY >= r.top && e.clientY <= r.bottom) || rects[0] || el.getBoundingClientRect();
      let top = er.top - wr.top - th - 6; if (top < 2) top = er.bottom - wr.top + 6;
      const left = Math.max(2, Math.min(wr.width - tw - 2, e.clientX - wr.left - tw / 2));
      m.tool.style.left = left + 'px'; m.tool.style.top = Math.max(2, Math.min(wr.height - th - 2, top)) + 'px';
    });
    m.root.addEventListener('click', e => { if (!m.pen && !e.target.closest('.ay, .mtool, .qsheet, .mbtn, .manimmenu, .qtoast, input')) qClearSel(m); });
    m.tool.addEventListener('click', e => {
      e.stopPropagation();
      const sw = e.target.closest('.sw'), tb = e.target.closest('.tb');
      if (sw) { if (sw.dataset.done) qPen(m, false); else qPenColor(m, sw.dataset.c); return; }
      if (!tb) return;
      const act = tb.dataset.act;
      if (act === 'pen') { qPen(m, !m.pen); return; }
      const el = m.selEl; if (!el) return;
      const i = +el.dataset.i, k = +el.dataset.k, key = ayKey(i, k);
      if (act === 'save') { if (QS.saved[key]) delete QS.saved[key]; else QS.saved[key] = 1; qsSave(); ayState(el, i, k); tb.classList.toggle('act', !!QS.saved[key]); }
      else if (act === 'tafsir') qTafsir(m, i, k);
      else if (act === 'note') qNote(m, i, k);
      else if (act === 'shot') qShotPick(m, i, k);
    });
    // القلم الفسفوري: اسحب فوق الكلمات لتمييزها، أو اضغط على الآية لتمييزها كلها
    let drag = null;
    inner.addEventListener('pointerdown', e => {
      if (!m.pen || e.button !== 0) return;
      const w = e.target.closest && e.target.closest('.w');
      drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, w, dirty: false };
      try { inner.setPointerCapture(e.pointerId); } catch (_) {}
      e.preventDefault();
    });
    inner.addEventListener('pointermove', e => {
      if (!drag) return;
      if (!drag.moved) {
        if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 4) return;
        drag.moved = true; if (drag.w && wordSet(drag.w, m.penC)) drag.dirty = true;
      }
      const dx = e.clientX - drag.lx, dy = e.clientY - drag.ly, n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 5));
      for (let s = 1; s <= n; s++) {   // نملا الفراغ بين حركتين سريعتين علشان ما نفوّتش كلمات
        const el = document.elementFromPoint(drag.lx + dx * s / n, drag.ly + dy * s / n), w = el && el.closest && el.closest('.w');
        if (w && inner.contains(w) && wordSet(w, m.penC)) drag.dirty = true;
      }
      drag.lx = e.clientX; drag.ly = e.clientY;
      if (drag.dirty) renderHL(m);
    });
    const endDrag = e => {
      if (!drag) return; const d = drag; drag = null;
      try { inner.releasePointerCapture(e.pointerId); } catch (_) {}
      if (!d.moved) { const ay = d.w && d.w.closest('.ay'); if (ay) penAyah(m, ay); }
      else if (d.dirty) { qsSave(); renderHL(m); }
    };
    inner.addEventListener('pointerup', endDrag); inner.addEventListener('pointercancel', endDrag);
    // وقوف الماوس على آية عليها ملاحظة: بتظهر الملاحظة
    inner.addEventListener('mouseover', e => {
      const el = e.target.closest('.ay'); if (!el) return;
      const n = QS.notes[ayKey(+el.dataset.i, +el.dataset.k)];
      if (!n || m.pen) { m.tip.hidden = true; return; }
      m.tip.textContent = n; m.tip.hidden = false; placeTip(m, e);
    });
    inner.addEventListener('mousemove', e => { if (!m.tip.hidden) placeTip(m, e); });
    inner.addEventListener('mouseout', e => { if (!e.relatedTarget || !e.relatedTarget.closest || !e.relatedTarget.closest('.ay')) m.tip.hidden = true; });
    window.addEventListener('resize', () => { m.fitW = ''; if (m.page && !m.readBox.hidden && m.root.classList.contains('on')) qOpenPage(m, m.page, true); });
  }
  function placeTip(m, e) {
    const t = m.tip, w = t.offsetWidth, h = t.offsetHeight;
    let x = e.clientX - w / 2, y = e.clientY - h - 14;
    x = Math.max(8, Math.min(window.innerWidth - w - 8, x)); if (y < 8) y = e.clientY + 18;
    t.style.left = x + 'px'; t.style.top = y + 'px';
  }
  function qContinue(m) {
    const b = m.root.querySelector('.mcont');
    if (QS.last > 0) { b.hidden = false; b.textContent = 'متابعة القراءة من صفحة ' + AR(QS.last); b.onclick = () => qOpenPage(m, QS.last); } else b.hidden = true;
  }
  function openSura(m, i) {
    const Q = window.WZ_QURAN; if (!Q || i < 0 || i >= Q.length) return;
    if (m.kind === 'q') return qOpenPage(m, Q[i].pg[0]);
    m.cur = i; const s = Q[i];
    m.listBox.hidden = true; m.readBox.hidden = false;
    m.readBox.querySelector('.mtt').textContent = 'سورة ' + s.a;
    m.readBox.querySelector('.mts').textContent = 'رقمها ' + AR(s.n) + ' · عدد آياتها ' + AR(s.t.length) + ' · الجزء ' + AR(s.j);
    m.readBox.querySelector('.mprev').disabled = i === 0;
    m.readBox.querySelector('.mnext').disabled = i === Q.length - 1;
    const body = m.body, frag = document.createDocumentFragment(); body.textContent = '';
    if (s.n !== 1 && s.n !== 9) { const b = document.createElement('div'); b.className = 'bism'; b.textContent = BISM; frag.appendChild(b); }
    if (m.kind === 'q') {
      const box = document.createElement('div'); box.className = 'qtext'; let last = 0;
      s.t.forEach((t, k) => {
        if (s.pg[k] !== last) { last = s.pg[k]; const c = document.createElement('span'); c.className = 'qpg'; c.textContent = 'ص ' + AR(last); box.appendChild(c); box.appendChild(document.createTextNode(' ')); }
        box.appendChild(document.createTextNode(t + ' '));
      });
      frag.appendChild(box);
    } else {
      const T = window.WZ_TAFSIR[i];
      s.t.forEach((t, k) => {
        const a = document.createElement('div'); a.className = 'tfa'; a.dataset.k = k;
        const x = document.createElement('div'); x.className = 'tfq'; x.textContent = t;
        const y = document.createElement('div'); y.className = 'tft'; y.textContent = T[k] || '';
        a.append(x, y); frag.appendChild(a);
      });
    }
    body.appendChild(frag); $('scroll').scrollTop = 0;
  }
  let qResumeWanted = false;
  function qResume() {   // افتح المصحف عند آخر صفحة اتقرت (لو القارئ مفتوح أصلًا سيبه زي ما هو)
    const m = MS.pQuran; qResumeWanted = true;
    if (!m || !m.ready) return;                       // لسه بيتحمّل: mushafOpen هيكمّل
    qResumeWanted = false;
    if (m.readBox.hidden) { qOpenPage(m, QS.last > 0 ? QS.last : 1); qWide(true); }   // لسه ما قريتش: من الفاتحة
  }
  async function mushafOpen(id) {
    const m = MS[id] || mushafInit(id);
    if (m.ready) return;
    m.msg.hidden = false; m.msg.textContent = 'جارٍ التحميل…';
    try {
      await loadJs('quran-data.js'); if (m.kind === 't') await loadJs('tafsir-data.js');
    } catch (_) { m.msg.textContent = 'تعذّر تحميل البيانات'; return; }
    m.ready = true; m.msg.hidden = true; if (m.kind === 'q') qContinue(m);
    window.WZ_QURAN.forEach((s, i) => m.list.appendChild(surBtn(i, () => openSura(m, i))));
    if (m.kind === 'q' && qResumeWanted) qResume();
  }

  // ───── أذكار الصباح والمساء ─────
  let dSel = null;
  const DNAME = { m: 'أذكار الصباح', e: 'أذكار المساء', sl: 'أذكار النوم', wk: 'أذكار الاستيقاظ', mq: 'دخول وخروج المسجد', pr: 'قبل الصلاة وبعدها', wu: 'الوضوء' };
  function renderDaily(s) {
    const d = s.dailyAz || {}, Z = window.WZ_AZKAR;
    if (!Z) return;
    let allDone = 0;
    document.querySelectorAll('.dcard').forEach(c => {
      const k = c.dataset.k, n = (Z[k] || []).length, got = (d[k] || []).filter(i => i < n).length, done = n > 0 && got >= n;
      if (k === 'm' || k === 'e') allDone += done ? 1 : 0;      // الشعار في القائمة بيتعلّم على الصباح والمساء بس
      c.classList.toggle('done', done);
      c.classList.toggle('sel', dSel === k);
      c.querySelector('.dp').textContent = got + ' / ' + n;
    });
    $('dailyTag').textContent = allDone === 2 ? 'قد أتممت قراءة أذكارك، دُمت في حفظ الله' : 'اقرأ أذكارك وسجّل ما أتممته';
    $('dList').hidden = !dSel;
    if (!dSel) return;
    const read = new Set(d[dSel] || []);
    $('dListT').textContent = DNAME[dSel];
    $('dFin').hidden = read.size < Z[dSel].length;
    const box = $('dItems'); box.textContent = '';
    Z[dSel].forEach((a, i) => {
      const r = document.createElement('div'); r.className = 'ditem' + (read.has(i) ? ' on' : '');
      const x = document.createElement('span'); x.className = 'dx'; x.textContent = '✓';
      const t = document.createElement('div'); t.className = 'dt';
      if (a.h && (i === 0 || Z[dSel][i - 1].h !== a.h)) { const h = document.createElement('span'); h.className = 'dhd'; h.textContent = a.h; t.appendChild(h); }
      t.appendChild(document.createTextNode(a.t));
      const c = document.createElement('span'); c.className = 'dn2'; c.textContent = a.n > 1 ? '× ' + a.n : 'مرة';
      r.append(x, t, c);
      r.onclick = () => { uiClick(); window.azkar.patch({ azMark: { t: dSel, i, on: !read.has(i) } }); };
      box.appendChild(r);
    });
  }
  document.querySelectorAll('.dcard').forEach(b => b.onclick = () => { dSel = dSel === b.dataset.k ? null : b.dataset.k; renderDaily(S || {}); });
    $('sbChk').onchange = () => window.azkar.patch({ sabahAlert: $('sbChk').checked });
  $('msChk').onchange = () => window.azkar.patch({ masaaAlert: $('msChk').checked });
  $('sbAt').onchange = () => { if ($('sbAt').value) window.azkar.patch({ sabahAt: $('sbAt').value }); };
  $('msAt').onchange = () => { if ($('msAt').value) window.azkar.patch({ masaaAt: $('msAt').value }); };
  $('sbEnd').onchange = () => { if ($('sbEnd').value) window.azkar.patch({ sabahEnd: $('sbEnd').value }); };
  $('msEnd').onchange = () => { if ($('msEnd').value) window.azkar.patch({ masaaEnd: $('msEnd').value }); };
  // أذكار النوم والاستيقاظ
  $('slChk').onchange = () => window.azkar.patch({ sleepAlert: $('slChk').checked });
  $('wkChk').onchange = () => window.azkar.patch({ wakeAlert: $('wkChk').checked });
  $('slAt').onchange = () => { if ($('slAt').value) window.azkar.patch({ sleepAt: $('slAt').value }); };
  $('slEnd').onchange = () => { if ($('slEnd').value) window.azkar.patch({ sleepEnd: $('slEnd').value }); };
  $('wkAt').onchange = () => { if ($('wkAt').value) window.azkar.patch({ wakeAt: $('wkAt').value }); };
  $('wkEnd').onchange = () => { if ($('wkEnd').value) window.azkar.patch({ wakeEnd: $('wkEnd').value }); };
  let minT = null;
  const copyMin = () => {
    window.wzx.copyMin(); $('minCp').textContent = 'تم النسخ ✓';
    clearTimeout(minT); minT = setTimeout(() => { $('minCp').textContent = 'اضغط للنسخ'; }, 1600);
  };
  $('minBox').onclick = copyMin;
  $('minBox').onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copyMin(); } };
  const goBack = () => (cur === 'hub' ? window.azkar.closeSettings() : go('hub'));

  // معاينة صوت عند ترك السلايدر (بدون تغيير أي حالة): معاينة واحدة في كل مرة، علشان الأصوات ما تتكدّسش
  // صوت الضغط على علامة ✓ في أذكار الصباح والمساء (UI_Click): بمستوى وتفعيل صوت الكليك
  let uiAudio = null;
  function uiClick() {
    if (!S || !S.sound || !A.uiclick || !(S.volume > 0)) return;
    try {
      const a = uiAudio || (uiAudio = new Audio(A.uiclick));
      a.pause(); a.currentTime = 0; a.volume = Math.min(1, S.volume);
      const p = a.play(); if (p && p.catch) p.catch(() => {});
    } catch (_) {}
  }
  const previewAudio = {};
  let previewNow = null;
  let previewStop = null;
  function preview(kind, vol, maxSec) {
    const src = A[kind]; if (!src || vol <= 0) return;
    clearTimeout(previewStop);
    if (previewNow && previewNow !== previewAudio[kind]) { try { previewNow.pause(); } catch (_) {} }
    const a = previewAudio[kind] || (previewAudio[kind] = new Audio(src));
    previewNow = a;
    try { a.pause(); a.currentTime = 0; a.volume = Math.min(1, vol); } catch (_) {}
    const p = a.play();
    if (p && p.catch) p.catch(() => { try { a.load(); } catch (_) {} });
    if (maxSec) previewStop = setTimeout(() => { try { a.pause(); } catch (_) {} }, maxSec * 1000);   // الأذان طويل: المعاينة بتقف بعد كام ثانية
  }

  const setRange = (el, v) => { if (sliding !== el) el.value = Math.round(v * 100); };
  const chk = (el, v) => { if (document.activeElement !== el) el.checked = !!v; };
  const pct = (id, v) => { $(id).textContent = Math.round(v * 100) + '%'; };

  function renderAzkar(s) {
    const key = JSON.stringify([s.azkar, s.dhikrId]);
    if (key === azkarKey) return;
    azkarKey = key;
    const box = $('azkar'); box.textContent = '';
    for (const a of s.azkar) {
      const row = document.createElement('div');
      row.className = 'item' + (a.id === s.dhikrId ? ' cur' : '');
      const b = document.createElement('button');
      b.className = 'pick'; b.textContent = a.text;
      b.onclick = () => window.azkar.patch({ dhikrId: a.id });
      row.appendChild(b);
      if (a.custom) {
        const d = document.createElement('button');
        d.className = 'ibtn'; d.setAttribute('aria-label', 'حذف الذكر');
        d.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
        d.onclick = () => window.azkar.deleteDhikr(a.id);
        row.appendChild(d);
      }
      box.appendChild(row);
    }
  }

  function setTag(el, on, txtOn, txtOff) { el.textContent = on ? txtOn : txtOff; el.classList.toggle('on', !!on); }

  function render(s) {
    S = s;
    document.querySelectorAll('.mwird').forEach(b => { b.hidden = !s.wirdDue; });   // زر "تم الورد" في المصحف: بيظهر طول ما الورد لسه مطلوب النهاردة
    if (curTarget !== (s.target || 0)) { curTarget = s.target || 0; renderStats(); }
    renderLayout(s);
    if (document.activeElement !== $('target')) $('target').value = s.target ?? '';
    chk($('autoChk'), s.autoAdvance);
    renderAzkar(s);
    renderDaily(s);
    chk($('sbChk'), s.sabahAlert); chk($('msChk'), s.masaaAlert);
    if (document.activeElement !== $('sbAt')) $('sbAt').value = s.sabahAt || '06:00';
    if (document.activeElement !== $('msAt')) $('msAt').value = s.masaaAt || '16:00';
    if (document.activeElement !== $('sbEnd')) $('sbEnd').value = s.sabahEnd || '12:00';
    if (document.activeElement !== $('msEnd')) $('msEnd').value = s.masaaEnd || '20:00';
    chk($('slChk'), s.sleepAlert); chk($('wkChk'), s.wakeAlert);
    if (document.activeElement !== $('slAt')) $('slAt').value = s.sleepAt || '22:00';
    if (document.activeElement !== $('slEnd')) $('slEnd').value = s.sleepEnd || '23:59';
    if (document.activeElement !== $('wkAt')) $('wkAt').value = s.wakeAt || '04:00';
    if (document.activeElement !== $('wkEnd')) $('wkEnd').value = s.wakeEnd || '11:00';
    chk($('soundChk'), s.sound);
    setRange($('clickVol'), s.volume);           pct('clickPct', s.volume);
    chk($('doneChk'), s.completionSound);
    setRange($('doneVol'), s.completionVolume);  pct('donePct', s.completionVolume);
    chk($('exitChk'), s.exitSound);
    setRange($('exitVol'), s.exitVolume);        pct('exitPct', s.exitVolume);
    chk($('startChk'), s.startupSound);
    setRange($('startVol'), s.startupVolume);    pct('startPct', s.startupVolume);
    $('miniChk').checked = !!s.miniMode;          // الحالة من الـ main هي الحقيقة (حتى لو المفتاح عليه فوكس وتغيّر من زر التكبير/الـ Tray)
    setRange($('miniOp'), s.miniOpacity);        pct('miniPct', s.miniOpacity);
    setRange($('idleOp'), s.idleOpacity ?? 1);   pct('idlePct', s.idleOpacity ?? 1);
    setRange($('ppSize'), s.popupScale ?? 1);    pct('ppSizePct', s.popupScale ?? 1);
    document.querySelectorAll('#cpSeg .pill').forEach(b => b.classList.toggle('on', b.dataset.k === s.cardsPos));
    for (const k of ['cp']) { const on = document.querySelector('#' + k + 'Seg .pill.on'); $(k + 'DdV').textContent = on ? on.textContent : ''; }
    $('cpSaved').disabled = !s.cardsSaved;
    setRange($('cpSize'), s.cardsScale ?? 1);    pct('cpSizePct', s.cardsScale ?? 1);
    document.querySelectorAll('#dsSeg .pill').forEach(b => b.classList.toggle('on', b.dataset.k === (s.dialStyle || 'ring')));
    { const on = document.querySelector('#dsSeg .pill.on'); $('dsDdV').textContent = on ? on.textContent : ''; }
    $('glowRow').style.display = (s.dialStyle === 'beads' || s.dialStyle === 'strand') ? 'block' : 'none';   // إعداد التوهّج بيظهر لما يتختار شكل حبات/خرز
    chk($('glowChk'), s.beadGlow !== false);
    setRange($('beadLt'), s.beadLight ?? .3); pct('beadLtPct', s.beadLight ?? .3);
    chk($('spaceChk'), s.spaceKey);
    chk($('ckChk'), s.customKeyOn); $('ckChk').disabled = !s.customKeyName;
    $('ckClear').disabled = !s.customKeyName;
    if (!$('ckBtn').classList.contains('listen')) $('ckBtn').textContent = s.customKeyName || 'اضغط هنا ثم اضغط الزر اللي عاوزه';
    for (const a of ['quit', 'mini', 'show', 'settings']) {
      const nm = (s.hotkeyNames && s.hotkeyNames[a]) || '';
      if (!$('hk_' + a).classList.contains('listen')) $('hk_' + a).textContent = nm || 'اضغط للتسجيل';
      $('hkx_' + a).disabled = !nm;
    }
    chk($('lockChk'), s.dialLocked);
    chk($('scrollChk'), s.scrollOn);
    chk($('clickChk'), s.clickOn);
    chk($('launchChk'), s.autoLaunch);
    // التنبيهات
    chk($('remChk'), s.reminderOn);
    chk($('dndChk'), s.dndFullscreen);
    $('dndLive').hidden = !(s.dndFullscreen && s.dndNow);
    $('remFold').classList.toggle('open', !!s.reminderOn);
    setIv($('remVal'), $('remUnit'), s.reminderEvery);
    chk($('remSndChk'), s.reminderSound);
    chk($('remSndChk2'), s.reminderSound);
    chk($('azSndChk'), s.azSound);
    chk($('prChk'), s.prayerAlert); chk($('prSndChk'), s.prayerSound);
    if (window.updAcc) requestAnimationFrame(window.updAcc);
    chk($('upAuto'), s.autoUpdateOn); chk($('bkAuto'), s.autoBackup); renderUpd(s);
    setRange($('prVol'), s.prayerVolume); pct('prPct', s.prayerVolume);
    if (document.activeElement !== $('prCity')) $('prCity').value = s.prayerCity || 'auto';
    renderPrBar(s.prayerInfo);
    { const pi = s.prayerInfo || {}, K = ['fj', 'du', 'dh', 'as', 'mg', 'is'];
      const f12 = mn => { const h = Math.floor(mn / 60), mi = mn % 60; return ((h % 12) || 12) + ':' + String(mi).padStart(2, '0') + '<small>' + (h < 12 ? 'ص' : 'م') + '</small>'; };
      for (const k of K) {
        const on = !s.prayerOn || s.prayerOn[k] !== false;
        chk($('pr_' + k), on); $('prc_' + k).classList.toggle('off', !on);
        $('prt_' + k).innerHTML = pi.times ? f12(pi.times[k]) : '--:--';
      }
      $('prInfo').textContent = pi.locating ? 'جاري تحديد موقعك...' : pi.times ? ('المواعيد لـ ' + pi.place + ' — بتوقيت جهازك') : 'تعذّر تحديد موقعك تلقائيًا، اختر دولتك من القائمة'; }
    chk($('wdSndChk'), s.wirdSound); chk($('wdChk'), s.wirdAlert);
    setRange($('wdVol'), s.wirdVolume);          pct('wdPct', s.wirdVolume);
    if (document.activeElement !== $('wdAt')) $('wdAt').value = s.wirdAt || '20:00';
    setRange($('azVol'), s.azVolume);            pct('azPct', s.azVolume);       // نفس الإعداد معروض في صفحتين (التنبيهات + مستوى الصوت)
    setRange($('remVol'), s.reminderVolume);     pct('remPct', s.reminderVolume);
    setRange($('popVol'), s.popupVolume);        pct('popPct', s.popupVolume);
    chk($('builtinChk'), s.builtinVerses);
    renderAlertsNote();
    chk($('chalChk'), s.challengeOn);
    $('chalFold').classList.toggle('open', !!s.challengeOn);
    setIv($('chalVal'), $('chalUnit'), s.challengeEvery);
    // حالة الأقسام في القائمة الرئيسية
    setTag($('tagAlerts'), s.reminderOn, 'مفعّل', 'متوقف');
    setTag($('tagMini'), s.miniMode, 'مصغّر', 'عادي');
  }

  let statsData = [], statsTab = 'd', curTarget = 33, streakData = null;
  const STAT_EMPTY = { d: 'لا توجد أذكار اليوم بعد', w: 'لا توجد أذكار في آخر 7 أيام', n: 'لا توجد إحصائيات بعد' };
  const STAT_LBL = { d: 'اليوم', w: 'آخر 7 أيام', n: 'الإجمالي' };
  const DAYS_AR = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
  const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  const NS = 'http://www.w3.org/2000/svg';

  // ───── الدونات: حلقة كبيرة ناعمة بأقواس بتدرّج خفيف وظل ناعم (SVG خفيف من غير مكتبات) ─────
  // رسم تدريجي هادي حوالين الدايرة + النسبة الأساسية في النص + تسميات ونسب برّه الحلقة بخطوط رفيعة + إبراز القسم بالماوس/الضغط.
  const DPAL = ['#5eeab0', '#19b98a', '#7be3d0', '#0f9a73', '#bff5dc', '#4d7f6b'];   // نعناعي / زمردي / تيل فاتح / زمردي غامق / نعناعي باهت / (أخرى)
  const DN = (() => {
    const VW = 560, VH = 240, CX = 280, CY = 120, R = 80, W = 18, GAP = 3.5, CIR = 2 * Math.PI * R, HCIR = 2 * Math.PI * (R - W / 2 - 9), MAXP = 6, RM = matchMedia('(prefers-reduced-motion: reduce)');
    const circles = [], labels = [], grads = [], blank = () => ({ s: Array(MAXP).fill(1), e: Array(MAXP).fill(1), pc: Array(MAXP).fill(0), t: 0 });
    let svg = null, ringG = null, hovC = null, bound = false, lastKey = '', parts = [], ems = [], rows = [], label = '', lastTot = 0, lastPc0 = 0;
    let cur = blank(), from = blank(), tgt = blank(), raf = 0, t0 = 0, dur = 1, kind = 'morph', hov = -1, pin = -1;
    const lerp = (a, b, q) => a + (b - a) * q, ease = q => 1 - Math.pow(1 - q, 3), easeIO = q => q < .5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2;
    const easeCalm = q => q * q * q * (q * (6 * q - 15) + 10);     // smootherstep: بداية ونهاية هادية جدًا
    const sel = () => hov >= 0 ? hov : pin;
    const E = (tag, at, par) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); if (par) par.appendChild(e); return e; };
    const mix = (hex, to, a) => { const n = parseInt(hex.slice(1), 16), m = parseInt(to.slice(1), 16); const c = s => Math.round(((n >> s) & 255) * (1 - a) + ((m >> s) & 255) * a); return '#' + [16, 8, 0].map(s => c(s).toString(16).padStart(2, '0')).join(''); };
    const short = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1).trim() + '…' : s; };

    function ensure() {
      if (svg) return;
      svg = $('stDonut');
      const defs = E('defs', {}, svg);
      for (let i = 0; i < MAXP; i++) {                                // تدرّج خفيف لكل قسم (أفتح ← أغمق)
        const g = E('linearGradient', { id: 'dg' + i, x1: '0', y1: '0', x2: '1', y2: '1' }, defs);
        grads.push([E('stop', { offset: '0' }, g), E('stop', { offset: '1' }, g)]);
      }
      ringG = E('g', {}, svg);                                          // مجموعة الحلقة (بتكبر بنعومة مع الرسم)
      E('circle', { class: 'dhl', cx: CX, cy: CY, r: R - W / 2 - 9 }, ringG);   // خط داخلي رفيع للأناقة
      E('circle', { class: 'dtr', cx: CX, cy: CY, r: R }, ringG);
      for (let i = 0; i < MAXP; i++) {
        const c = E('circle', { class: 'dseg', cx: CX, cy: CY, r: R, transform: 'rotate(-90 ' + CX + ' ' + CY + ')' }, ringG);
        circles.push(c);
      }
      hovC = E('circle', { class: 'dhov', cx: CX, cy: CY, r: R - W / 2 - 9, transform: 'rotate(-90 ' + CX + ' ' + CY + ')' }, ringG);   // قوس رفيع بيترسم جوّه الحلقة تحت القسم المختار (فوق الخط الداخلي)
      hovC.style.strokeDasharray = '0 ' + HCIR;
      for (let i = 0; i < MAXP; i++) {                                // تسمية برّه الحلقة: خط رفيع + نقطة + الاسم + النسبة
        const g = E('g', { class: 'dl' }, svg), ttl = E('title', {}, g);
        const line = E('polyline', {}, g), dot = E('circle', { r: 2 }, g);
        const nm = E('text', { class: 'dn' }, g), pc = E('text', { class: 'dp' }, g);
        labels.push({ g, ttl, line, dot, nm, pc });
      }
    }
    function bind() {
      if (bound) return; bound = true;
      const el = svg.parentNode;
      const hit = ev => {                                            // القسم تحت المؤشر (بالزاوية، فمفيش وميض عند الحواف)
        const r = svg.getBoundingClientRect(), k = r.width / VW;
        const dx = ev.clientX - (r.left + CX * k), dy = ev.clientY - (r.top + CY * k), d = Math.hypot(dx, dy);
        if (d < (R - W / 2 - 5) * k || d > (R + W / 2 + 9) * k) return -1;
        const f = (((Math.atan2(dy, dx) + Math.PI / 2) / (2 * Math.PI)) % 1 + 1) % 1;
        for (let i = 0; i < parts.length; i++) if (f >= tgt.s[i] && f < tgt.e[i]) return i;
        return -1;
      };
      el.addEventListener('pointermove', e => { const i = hit(e); el.style.cursor = i >= 0 ? 'pointer' : ''; if (i !== hov) { hov = i; applySel(); } });
      el.addEventListener('pointerleave', () => { if (hov !== -1) { hov = -1; applySel(); } });
      el.addEventListener('click', e => { const i = hit(e); pin = (i === pin) ? -1 : i; applySel(); });
    }

    function paintCenter() {
      const i = sel(), dc = $('stDc');
      if (!parts.length) return;
      const key = i >= 0 ? 'p' + i : 'top';
      if (key !== lastKey) { lastKey = key; dc.classList.remove('swp'); void dc.offsetWidth; dc.classList.add('swp'); }
      if (i >= 0 && parts[i]) {                                      // تفاصيل القسم المختار
        dc.classList.add('act');
        $('stTot').textContent = Math.round(tgt.pc[i]) + '%'; $('stTotL').textContent = parts[i].name; $('stTotV').textContent = parts[i].v + ' تسبيحة';
      } else {                                                       // النسبة الأساسية = أعلى ذكر
        dc.classList.remove('act');
        $('stTot').textContent = Math.round(lastPc0) + '%'; $('stTotL').textContent = parts[0].name; $('stTotV').textContent = label + ' · ' + lastTot;
      }
    }
    function applySel() {
      const i = sel();
      circles.forEach((c, k) => {
        const on = k === i && !!parts[k];
        c.classList.toggle('act', on); c.classList.toggle('dim', i >= 0 && !on);
        labels[k].g.classList.toggle('act', on); labels[k].g.classList.toggle('dim', i >= 0 && !on && !!parts[k]);
      });
      if (i >= 0 && parts[i]) {                                      // القوس الرفيع: بيتحرّك بنعومة من قسم للتاني
        const s = tgt.s[i], e = tgt.e[i], pad = parts.length === 1 ? 0 : 3.5;
        hovC.style.stroke = mix(parts[i].col, '#ffffff', .2);
        hovC.style.strokeDasharray = Math.max(.01, (e - s) * HCIR - pad) + ' ' + HCIR;
        hovC.style.strokeDashoffset = String(-(s * HCIR + pad / 2));
        hovC.classList.add('on');
      } else hovC.classList.remove('on');
      rows.forEach((r, k) => r.classList.toggle('act', k === i));
      $('stHero').classList.toggle('hasSel', i >= 0);
      paintCenter();
    }

    // التسميات: بتتوزّع على الجانبين وبتتباعد عن بعض علشان ماتتداخلش
    function paintLabels(v) {
      const L = [];
      for (let i = 0; i < MAXP; i++) {
        if (!parts[i]) { labels[i].g.style.opacity = 0; continue; }
        const s = kind === 'intro' ? tgt.s[i] : v.s[i], e = kind === 'intro' ? tgt.e[i] : v.e[i];
        const a = parts.length === 1 ? Math.PI / 2 : (s + e) / 2 * 2 * Math.PI, sx = Math.sin(a), sy = -Math.cos(a), rr = R + W / 2 + 5;
        const fin = tgt.e[i] - tgt.s[i] || 1, grown = kind === 'intro' ? Math.max(0, Math.min(1, ((v.e[i] - v.s[i]) / fin - .85) / .15)) : 1;
        L.push({ i, sx, dir: sx >= 0 ? 1 : -1, x0: CX + sx * rr, y0: CY + sy * rr, x1: CX + sx * (rr + 12), y: CY + sy * (rr + 12), op: grown });
      }
      for (const dir of [1, -1]) {                                   // تباعد رأسي لكل جانب
        const side = L.filter(l => l.dir === dir).sort((p, q) => p.y - q.y), SP = 30;
        for (let k = 1; k < side.length; k++) if (side[k].y - side[k - 1].y < SP) side[k].y = side[k - 1].y + SP;
        const over = side.length ? side[side.length - 1].y - (VH - 16) : 0;
        if (over > 0) side.forEach(l => { l.y -= over; });
        if (side.length && side[0].y < 14) { const up = 14 - side[0].y; side.forEach(l => { l.y += up; }); }
      }
      for (const l of L) {
        const lb = labels[l.i], xl = CX + l.dir * (R + W / 2 + 30), p = parts[l.i];
        lb.line.setAttribute('points', l.x0.toFixed(1) + ',' + l.y0.toFixed(1) + ' ' + l.x1.toFixed(1) + ',' + l.y.toFixed(1) + ' ' + xl.toFixed(1) + ',' + l.y.toFixed(1));
        lb.dot.setAttribute('cx', l.x0.toFixed(1)); lb.dot.setAttribute('cy', l.y0.toFixed(1)); lb.dot.setAttribute('fill', p.col);
        const tx = (xl + l.dir * 5).toFixed(1), an = l.dir > 0 ? 'end' : 'start';   // الصفحة RTL: 'end' = النص بيمتد يمين بعيد عن الحلقة، و'start' = بيمتد شمال
        lb.nm.setAttribute('x', tx); lb.nm.setAttribute('y', (l.y - 2).toFixed(1)); lb.nm.setAttribute('text-anchor', an);
        lb.pc.setAttribute('x', tx); lb.pc.setAttribute('y', (l.y + 11).toFixed(1)); lb.pc.setAttribute('text-anchor', an);
        const nt = short(p.name, 22); if (lb.nm.textContent !== nt) { lb.nm.textContent = nt; lb.ttl.textContent = p.name; }
        lb.pc.textContent = Math.round(v.pc[l.i]) + '%';
        lb.g.style.opacity = l.op; lb.g.style.transform = 'translateX(' + (l.dir * (1 - l.op) * -10).toFixed(1) + 'px)';
      }
    }

    function paint(v) {
      const single = parts.length === 1;
      for (let i = 0; i < MAXP; i++) {
        const c = circles[i], arc = (v.e[i] - v.s[i]) * CIR;
        if (!parts[i] || arc < .3) c.style.opacity = 0;
        else {
          c.style.strokeDasharray = (single ? arc : Math.max(.01, arc - GAP)) + ' ' + CIR;
          c.style.strokeDashoffset = String(-(single ? 0 : v.s[i] * CIR + GAP / 2));
          c.style.opacity = single ? 1 : Math.min(1, arc / (GAP + 5));        // القوس بيظهر تدريجيًا بدل ما يبان كنقطة
        }
        if (ems[i] && parts[i]) ems[i].textContent = String(Math.max(0, Math.round(parts[i].v * (v.pc[i] / (tgt.pc[i] || 1)))));
      }
      lastTot = Math.round(v.t); lastPc0 = v.pc[0]; paintCenter(); paintLabels(v);
      // حركة الدخول: الحلقة بتكبر من 94% لـ 100% والنص بيظهر بنعومة
      const ip = kind === 'intro' ? Math.min(1, tgt.t ? v.t / tgt.t : 1) : 1, sc = .94 + .06 * ip;
      ringG.setAttribute('transform', 'translate(' + CX + ' ' + CY + ') scale(' + sc.toFixed(4) + ') translate(' + (-CX) + ' ' + (-CY) + ')');
      $('stDc').style.opacity = kind === 'intro' ? Math.min(1, ip * 2.2).toFixed(3) : 1;
    }
    const introVals = p => ({ s: tgt.s.slice(), e: tgt.e.map((e, i) => Math.min(e, Math.max(tgt.s[i], p))), pc: tgt.pc.map(x => x * p), t: tgt.t * p });   // الرسم يلف حوالين الدايرة + العدّ يطلع
    const morphVals = q => ({ s: from.s.map((x, i) => lerp(x, tgt.s[i], q)), e: from.e.map((x, i) => lerp(x, tgt.e[i], q)), pc: from.pc.map((x, i) => lerp(x, tgt.pc[i], q)), t: lerp(from.t, tgt.t, q) });
    function step(now) {
      const q = Math.min(1, (now - t0) / dur);
      cur = kind === 'intro' ? introVals(easeCalm(q)) : morphVals(easeIO(q));
      paint(cur);
      raf = q < 1 ? requestAnimationFrame(step) : 0;
    }
    function run(k, ms) { cancelAnimationFrame(raf); kind = k; dur = ms; t0 = performance.now(); raf = requestAnimationFrame(step); }
    const same = (a, b) => Math.abs(a.t - b.t) < .5 && a.s.every((x, i) => Math.abs(x - b.s[i]) < 1e-4 && Math.abs(a.e[i] - b.e[i]) < 1e-4);

    // list: [{ name, v, col }] | mode: 'intro' (أول ظهور) | 'morph' (تغيّر بيانات) | 'snap' (من غير حركة)
    function set(list, total, lbl, mode, lg) {
      ensure(); bind();
      parts = list; label = lbl; ems = []; rows = []; lg.textContent = '';
      if (hov >= list.length) hov = -1; if (pin >= list.length) pin = -1;
      const t = blank(); let cum = 0;
      list.forEach((p, i) => { const sh = p.v / total; t.s[i] = cum; cum += sh; t.e[i] = cum; t.pc[i] = sh * 100; });
      t.t = total; tgt = t;
      list.forEach((p, i) => {
        const l = mk('div', 'lg'), d = mk('i'), em = mk('em', '', '0');
        d.style.background = 'linear-gradient(135deg, ' + mix(p.col, '#ffffff', .18) + ', ' + mix(p.col, '#000000', .22) + ')';
        l.append(d, mk('span', '', p.name), em); l.title = p.name;
        l.onmouseenter = () => { hov = i; applySel(); }; l.onmouseleave = () => { hov = -1; applySel(); };
        l.onclick = () => { pin = pin === i ? -1 : i; applySel(); };
        lg.appendChild(l); ems.push(em); rows.push(l);
      });
      circles.forEach((c, i) => {
        const p = list[i];
        if (p) { grads[i][0].setAttribute('stop-color', mix(p.col, '#ffffff', .2)); grads[i][1].setAttribute('stop-color', mix(p.col, '#000000', .24)); }
        c.style.stroke = p ? 'url(#dg' + i + ')' : 'transparent'; c.style.strokeLinecap = 'butt';
        c.setAttribute('aria-label', p ? p.name + ' ' + Math.round(t.pc[i]) + '%' : '');
      });
      cancelAnimationFrame(raf); raf = 0;
      if (mode === 'snap' || RM.matches) { kind = 'morph'; cur = t; paint(cur); }      // تقليل الحركة / القسم مش ظاهر: النتيجة النهائية على طول
      else if (mode === 'intro') { kind = 'intro'; cur = introVals(0); paint(cur); run('intro', 2000); }
      else if (same(cur, t)) { kind = 'morph'; paint(cur); }
      else { from = cur; kind = 'morph'; paint(cur); run('morph', 850); }
      applySel();
    }
    function clear() { cancelAnimationFrame(raf); raf = 0; cur = blank(); hov = pin = -1; parts = []; }
    return { set, clear };
  })();
  // ───── بار مواقيت الصلاة في القائمة الرئيسية ─────
  const PR5 = ['fj', 'dh', 'as', 'mg', 'is'];
  const f12h = mn => { const h = Math.floor(mn / 60), mi = mn % 60; return ((h % 12) || 12) + ':' + String(mi).padStart(2, '0') + '<small>' + (h < 12 ? 'ص' : 'م') + '</small>'; };
  function renderPrBar(pi) {
    const bar = $('prBar'), t = pi && pi.times;
    bar.classList.toggle('empty', !t);
    $('prEmpty').textContent = pi && pi.locating ? 'جاري تحديد موقعك...' : 'اختر مدينتك لعرض مواقيت الصلاة';
    if (!t) return;
    const d = new Date(), now = d.getHours() * 60 + d.getMinutes(), nxt = PR5.find(k => t[k] > now) || 'fj';   // بعد العشاء: الفجر (بكرة)
    PR5.forEach(k => {
      $('prb_' + k).innerHTML = f12h(t[k]);
      const c = bar.querySelector('[data-k="' + k + '"]');
      c.classList.toggle('next', k === nxt); c.classList.toggle('past', t[k] <= now && k !== nxt);
    });
  }
  setInterval(() => { if (S) renderPrBar(S.prayerInfo); }, 30000);
  // السلاسل: السلسلة الحالية + أطول سلسلة + إجمالي الأيام + آخر 14 يوم (نقاط)
  const dayUnit = n => (n === 2 ? 'يومين متتاليين' : n >= 3 && n <= 10 ? 'أيام متتالية' : n >= 11 ? 'يومًا متتاليًا' : 'يوم');
  function renderStreak() {
    const st = streakData, box = $('stStreak');
    if (!st) { box.hidden = true; return; }
    box.hidden = false; box.classList.toggle('live', st.cur > 0);
    $('stkCur').textContent = String(st.cur); $('stkCurL').textContent = dayUnit(st.cur);
    $('stkBest').textContent = String(st.best); $('stkDays').textContent = String(st.days);
    { const dd = st.dots || []; $('stkRec').textContent = dd.filter(Boolean).length + ' من ' + (dd.length || 14); }
    const msg = $('stkMsg');
    msg.classList.toggle('ok', !!st.doneToday);
    msg.textContent = st.cur === 0 ? 'سبّح اليوم لتبدأ سلسلة جديدة'
      : st.doneToday ? (st.cur >= 3 && st.cur >= st.best ? '✓ سلسلتك محفوظة اليوم · أطول سلسلة لك!' : '✓ سلسلتك محفوظة اليوم')
      : 'سبّح اليوم لتحافظ على سلسلتك';
    const dots = $('stkDots'); dots.textContent = '';
    (st.dots || []).forEach((on, i, a) => dots.appendChild(mk('i', (on ? 'on' : '') + (i === a.length - 1 ? ' today' : ''))));
  }
  // ───── ملخص الأسبوع + الشارات + الختمة + التحديثات + النسخ الاحتياطي ─────
  const IC = {
    bead: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/>',
    flame: '<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/>',
    sun: '<path d="M3 18h18"/><path d="M6 18a6 6 0 0112 0"/><path d="M12 5v3M4.5 9l2 2M19.5 9l-2 2"/>',
    cards: '<rect x="3" y="6" width="14" height="14" rx="2"/><path d="M7 3h12a2 2 0 012 2v12"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/>',
    chart: '<path d="M5 20V11M12 20V5M19 20v-7"/>',
    book: '<path d="M4 5a2 2 0 012-2h5v17H6a2 2 0 00-2 2V5z"/><path d="M20 5a2 2 0 00-2-2h-5v17h5a2 2 0 012 2V5z"/>',
    mosque: '<path d="M4 20h16"/><path d="M6 20v-5a6 6 0 0112 0v5"/><path d="M12 9V5M10.5 6.5h3"/>'
  };
  const DOW = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const n3 = n => Number(n || 0).toLocaleString('en-US');
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  function renderWeek(w) {
    if (!w || !Array.isArray(w.days)) return;
    const box = $('wsBars'), mx = Math.max(1, ...w.days.map(d => d.n)); box.textContent = '';
    w.days.forEach((d, i) => {
      const c = el('div', 'wsc' + (i === 6 ? ' today' : '') + (d.n ? '' : ' zero'));
      const bar = el('i'); bar.style.height = Math.max(3, Math.round(d.n / mx * 78)) + 'px';
      c.append(el('small', '', d.n ? n3(d.n) : ''), bar, el('span', '', DOW[d.dow]));
      box.appendChild(c);
    });
    $('wsTot').textContent = n3(w.total); $('wsAct').textContent = w.active + ' من 7';
    $('wsBest').textContent = w.best ? DOW[w.best.dow] : '-';
    $('wsBadge').textContent = n3(w.total);
    const bits = [];
    if (w.prev > 0) { const df = w.total - w.prev; bits.push(df >= 0 ? 'أكتر من الأسبوع اللي فات بـ ' + n3(df) : 'أقل من الأسبوع اللي فات بـ ' + n3(-df)); }
    else if (w.total > 0) bits.push('ده أول أسبوع ليه تسجيل');
    if (w.top) bits.push('أكتر ذكر: «' + w.top.text + '» (' + n3(w.top.n) + ')');
    $('wsNote').textContent = bits.join(' • ') || 'ابدأ بالتسبيح وهيظهر ملخصك هنا';
  }
  // الشارات متقسّمة لأقسام (كل قسم سلّم تدريجي) + كارت "الشارة الجاية" فوق: أقرب شارة لسه ما اتفتحتش
  const ACH_GROUPS = [
    ['التسبيح', ['t1', 't100', 't1k', 't10k', 't100k', 'c10', 'c100', 'v5', 'v15', 'u1']],
    ['المداومة', ['s3', 's7', 's30', 's100']],
    ['الأيام والأسابيع', ['d100', 'd500', 'd1k', 'w1k', 'w5k']],
    ['القرآن الكريم', ['k50', 'k1', 'k3']]
  ];
  const achIco = a => { const ic = el('span', 'acc-ico'); ic.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (IC[a.ico] || IC.bead) + '</svg>'; return ic; };
  function achCardEl(a) {
    const c = el('div', 'ach' + (a.got ? ' got' : '')), t = el('div', 'at');
    t.append(el('b', '', a.name), el('span', '', a.desc));
    if (!a.got) {
      t.append(el('span', 'cnt', n3(a.cur) + ' / ' + n3(a.need)));
      const pb = el('div', 'pb'), i = el('i'); i.style.width = Math.round(a.cur / a.need * 100) + '%'; pb.appendChild(i); t.appendChild(pb);
    }
    c.append(achIco(a), t); return c;
  }
  function renderAch(list) {
    if (!Array.isArray(list)) return;
    const g = $('achGrid'); g.textContent = '';
    const by = new Map(list.map(a => [a.id, a])), used = new Set(), groups = [];
    for (const [name, ids] of ACH_GROUPS) { const arr = ids.map(i => by.get(i)).filter(Boolean); arr.forEach(a => used.add(a.id)); if (arr.length) groups.push([name, arr]); }
    const rest = list.filter(a => !used.has(a.id)); if (rest.length) groups.push(['أخرى', rest]);   // أي شارة جديدة تتضاف في الـ main من غير تعديل هنا
    for (const [name, arr] of groups) {
      const sec = el('div', 'achg'), got = arr.filter(a => a.got).length, h = el('div', 'achg-h'), gr = el('div', 'achgrid');
      h.append(el('span', 'gn', name), el('span', 'gc' + (got === arr.length ? ' full' : ''), got + ' من ' + arr.length));
      arr.forEach(a => gr.appendChild(achCardEl(a)));
      sec.append(h, gr); g.appendChild(sec);
    }
    const lock = list.filter(a => !a.got).sort((a, b) => b.cur / b.need - a.cur / a.need)[0], nx = $('achNext');
    nx.hidden = !lock; nx.textContent = '';
    if (lock) {
      const t = el('div', 'at'), pb = el('div', 'pb'), i = el('i'); i.style.width = Math.round(lock.cur / lock.need * 100) + '%'; pb.appendChild(i);
      t.append(el('small', '', 'الشارة الجاية'), el('b', '', lock.name), el('span', '', lock.desc), pb);
      nx.append(achIco(lock), t, el('span', 'cnt', n3(lock.cur) + ' / ' + n3(lock.need)));
    }
    $('achBadge').textContent = list.filter(a => a.got).length + ' من ' + list.length;
  }
  let khDirty = false;
  function renderKhatma(k) {
    if (!k || !$('khCard')) return;
    const pct = Math.round(k.read / k.total * 100); khRead = k.read;
    $('khFill').style.width = pct + '%';
    $('khCnt').textContent = k.count ? 'ختمات: ' + k.count : 'الختمة الأولى';
    const day = Math.min(k.days, k.elapsed + 1);
    let t = 'قرأت ' + n3(k.read) + ' من ' + k.total + ' صفحة (' + pct + '%) — اليوم ' + day + ' من ' + k.days;
    if (k.read < k.total) t += ' — وردك النهارده ' + k.perDay + ' صفحة' + (k.todayRead >= k.perDay ? ' ✓ (خلّصته)' : ' (قرأت ' + k.todayRead + ')');
    $('khInfo').textContent = t;
    const sel = $('khDays');
    if (!khDirty && document.activeElement !== sel) { if (![...sel.options].some(o => +o.value === k.days)) sel.add(new Option(k.days + ' يوم', k.days)); sel.value = String(k.days); }
  }
  function renderUpd(s) {
    const u = s.upd || {}; $('upVer').textContent = 'v' + (s.appVersion || '');
    const M = { idle: 'لسه ما اتفحصش', checking: 'جاري الفحص…', none: 'إنت على أحدث إصدار', downloading: 'جاري تنزيل التحديث ' + (u.version ? 'v' + u.version : '') + ' (' + (u.percent || 0) + '%)', ready: 'التحديث ' + (u.version ? 'v' + u.version : '') + ' جاهز للتثبيت', error: u.error || 'حصل خطأ', unsupported: 'التحديث التلقائي متاح في النسخة المثبّتة فقط' };
    $('upMsg').textContent = M[u.status] || ''; $('upMsg').dataset.st = u.status || '';
    $('upBar').hidden = u.status !== 'downloading'; $('upFill').style.width = (u.percent || 0) + '%';
    $('upInstall').hidden = u.status !== 'ready';
    $('upCheck').disabled = ['checking', 'downloading', 'ready', 'unsupported'].includes(u.status);
    const B = { ready: 'تحديث جاهز', downloading: 'جاري التنزيل', checking: 'جاري الفحص' };
    const b = $('upBadge'); b.textContent = B[u.status] || ''; b.classList.toggle('on', u.status === 'ready'); b.hidden = !B[u.status];
  }
  async function bkRefresh() {
    let list = []; try { list = await window.wzx.backupList(); } catch (_) {}
    const box = $('bkList'); box.textContent = '';
    if (!list.length) { box.appendChild(el('div', 'hint', 'مفيش نسخ محفوظة لسه، هتتعمل أول نسخة تلقائيًا بعد دقيقة من فتح البرنامج.')); return; }
    for (const b of list) {
      const row = el('div', 'bkrow'), d = b.at ? new Date(b.at) : null;
      const sp = el('span', '', (d ? d.toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }) : b.name) + ' — ' + n3(b.total) + ' تسبيحة');
      const when = d ? d.toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }) : b.name;
      const btn = el('button', 'pill sm', 'استعادة'); btn.onclick = () => bkAsk('هتتبدّل إعداداتك وإحصائياتك الحالية بنسخة ' + when + '. هنحتفظ بنسخة من وضعك الحالي، والبرنامج هيتقفل ويفتح تاني. متأكد؟', { run: async () => { const ok = await window.wzx.backupRestore(b.name); if (!ok) bkMsg('تعذّرت الاستعادة'); } });
      row.append(sp, btn); box.appendChild(row);
    }
  }
  let bkT = null; const bkMsg = t => { $('bkMsg').textContent = t; clearTimeout(bkT); bkT = setTimeout(() => { $('bkMsg').textContent = ''; }, 5000); };
  $('upAuto').onchange = () => window.azkar.patch({ autoUpdateOn: $('upAuto').checked });
  $('upCheck').onclick = () => window.azkar.patch({ updCheck: true });
  $('upInstall').onclick = () => window.azkar.patch({ updInstall: true });
  $('bkAuto').onchange = () => window.azkar.patch({ autoBackup: $('bkAuto').checked });
  $('bkNow').onclick = async () => { await window.wzx.backupNow(); await bkRefresh(); bkMsg('تم حفظ نسخة احتياطية'); };
  $('bkExport').onclick = async () => { const ok = await window.wzx.backupExport(); bkMsg(ok ? 'تم تصدير النسخة' : 'تم الإلغاء'); };
  $('bkImport').onclick = async () => {
    const r = await window.wzx.backupImport();
    if (!r || !r.ok) { if (!r || !r.canceled) bkMsg('الملف مش نسخة WZAKER صالحة'); return; }
    const when = r.at ? new Date(r.at).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }) : 'قديمة';
    bkAsk('النسخة المختارة بتاريخ ' + when + ' (' + n3(r.total) + ' تسبيحة). هتتبدّل إعداداتك وإحصائياتك الحالية بيها، والبرنامج هيتقفل ويفتح تاني. متأكد؟',
      { run: async () => { const ok = await window.wzx.backupImportApply(); if (!ok) bkMsg('تعذّر الاستيراد'); }, cancel: () => window.wzx.backupImportCancel() });
  };
  $('bkCard').addEventListener('toggle', () => { if ($('bkCard').open) bkRefresh(); });
  // ───── مكان النسخ الاحتياطي: أيقونة التعجب (نسخ المسار / فتح المجلد) ─────
  async function bkLoadPath() {
    let pth = ''; try { pth = await window.wzx.backupPath(); } catch (_) {}
    $('bkPathTxt').textContent = pth || 'غير متاح'; $('bkPathOpen').title = pth || '';
  }
  $('bkInfo').onclick = () => {
    const on = !$('bkPath').classList.contains('on');
    $('bkPath').classList.toggle('on', on); $('bkPath').setAttribute('aria-hidden', String(!on)); $('bkInfo').setAttribute('aria-expanded', String(on));
    if (on) bkLoadPath();
  };
  const bkOpenDir = async () => { let ok = false; try { ok = await window.wzx.backupOpenDir(); } catch (_) {} if (!ok) bkMsg('تعذّر فتح المجلد'); };
  $('bkPathOpen').onclick = bkOpenDir; $('bkPathGo').onclick = bkOpenDir;
  $('bkPathCopy').onclick = async () => {
    let ok = false; try { ok = await window.wzx.backupCopyPath(); } catch (_) {}
    bkMsg(ok ? 'تم نسخ المسار' : 'تعذّر النسخ');
    if (ok) { const b = $('bkPathCopy'); b.classList.add('ok'); setTimeout(() => b.classList.remove('ok'), 1400); }
  };
  $('khDays').onchange = () => { khDirty = true; };
  let khRead = 0;
  const khAsk = on => { $('khCfm').hidden = !on; $('khAct').hidden = on; };
  $('khNew').onclick = () => { $('khCfmT').textContent = 'هتبدأ ختمة جديدة لمدة ' + $('khDays').value + ' يوم، وصفحاتك المقروءة' + (khRead ? ' (' + khRead + ' صفحة)' : '') + ' هتتصفّر. متأكد؟'; khAsk(true); };
  $('khNo').onclick = () => khAsk(false);
  $('khYes').onclick = () => { khDirty = false; khAsk(false); window.wzx.khatmaNew(parseInt($('khDays').value, 10)); };
  // تأكيد استعادة النسخ جوه البرنامج (من غير مربع نظام)
  let bkAct = null;
  const bkAsk = (text, act) => { bkAct = act; $('bkCfmT').textContent = text; $('bkCfm').hidden = false; };
  const bkClose = () => { bkAct = null; $('bkCfm').hidden = true; };
  $('bkNo').onclick = () => { if (bkAct && bkAct.cancel) bkAct.cancel(); bkClose(); };
  $('bkYes').onclick = async () => { const a = bkAct; bkClose(); if (a) await a.run(); };
  bkRefresh();

  function renderStats(list) {
    if (list && !Array.isArray(list)) { renderWeek(list.week); renderAch(list.ach); renderKhatma(list.khatma); }
    if (list && !Array.isArray(list) && Array.isArray(list.list)) { streakData = list.streak || null; list = list.list; renderStreak(); }
    if (Array.isArray(list)) statsData = list;
    document.querySelectorAll('#stSeg .pill').forEach(b => b.classList.toggle('on', b.dataset.k === statsTab));
    const box = $('stats'), hero = $('stHero'), wk = $('stWeek'); box.textContent = '';
    const k = statsTab, T = curTarget > 0 ? curTarget : 0;
    const rows = statsData.filter(x => (x[k] || 0) > 0).sort((a, b) => (b[k] - a[k]) || ((b.last || 0) - (a.last || 0)));   // من الأعلى للأقل
    hero.hidden = wk.hidden = true;
    if (!rows.length) { DN.clear(); box.appendChild(mk('div', 'empty', STAT_EMPTY[k])); return; }
    const total = rows.reduce((s, x) => s + x[k], 0), anim = [];

    // ── الدونات: نسبة كل ذكر من الإجمالي ──
    hero.hidden = false;
    const vis = $('pStats').classList.contains('on'), mode = !vis ? 'snap' : donutIntro ? 'intro' : 'morph';
    if (vis) donutIntro = false;
    const top = rows.slice(0, 5), rest = total - top.reduce((s, x) => s + x[k], 0);
    const parts = top.map((x, i) => ({ name: x.text, v: x[k], col: DPAL[i] }));
    if (rest > 0) parts.push({ name: 'أخرى', v: rest, col: DPAL[5] });
    DN.set(parts, total, STAT_LBL[k], mode, $('stLg'));

    // ── حالة الهدف ──
    const gb = $('stGoal'); gb.className = 'goalbox';
    if (!T) gb.textContent = 'لم تحدّد هدفًا للتسبيح بعد';
    else if (k === 'd') {
      const r = rows.reduce((s, x) => s + Math.floor(x.d / T), 0);
      if (r > 0) { gb.classList.add('ok'); gb.textContent = '✓ وصلت لهدفك' + (r > 1 ? ' ' + r + ' مرات' : '') + ' اليوم'; }
      else gb.textContent = 'باقي ' + (T - rows[0].d) + ' على هدفك (' + T + ') في «' + rows[0].text + '»';
    } else if (k === 'w') {
      let days = 0; for (let i = 0; i < 7; i++) if (rows.some(x => (x.dd || [])[i] >= T)) days++;
      if (days > 0) { gb.classList.add('ok'); gb.textContent = '✓ وصلت لهدفك في ' + days + ' من 7 أيام'; }
      else gb.textContent = 'لم تصل لهدفك (' + T + ') هذا الأسبوع بعد';
    } else {
      const r = rows.reduce((s, x) => s + Math.floor(x.n / T), 0);
      if (r > 0) { gb.classList.add('ok'); gb.textContent = '✓ أتممت ' + r + ' دورة من هدفك (' + T + ')'; }
      else gb.textContent = 'لم تُتمّ دورة كاملة من هدفك (' + T + ') بعد';
    }

    // ── أعمدة آخر 7 أيام ──
    if (k === 'w') {
      wk.hidden = false;
      const pl = $('wPlot'), lb = $('wLab'); pl.textContent = ''; lb.textContent = '';
      const day = i => rows.reduce((s, x) => s + ((x.dd || [])[i] || 0), 0);
      const vals = [0, 1, 2, 3, 4, 5, 6].map(day), mx = Math.max(1, ...vals);
      const scale = T && T <= mx * 3 ? Math.max(mx, T) : mx;
      for (let i = 0; i < 7; i++) {
        const hit = !!T && rows.some(x => (x.dd || [])[i] >= T), today = i === 6;
        const b = mk('div', 'wb' + (hit ? ' hit' : '') + (today ? ' today' : '')); b.title = vals[i] + ' تسبيحة';
        if (vals[i] > 0) b.appendChild(mk('em', '', String(vals[i])));
        pl.appendChild(b); anim.push(() => { b.style.height = Math.max(vals[i] > 0 ? 4 : 0, (vals[i] / scale) * 100) + '%'; });
        const dt = new Date(Date.now() - (6 - i) * 864e5);
        lb.appendChild(mk('span', today ? 'today' : '', today ? 'اليوم' : DAYS_AR[dt.getDay()]));
      }
      $('wNote').hidden = true;
      if (T && T <= mx * 3) { const g = mk('div', 'gl'); g.style.bottom = (T / scale) * 100 + '%'; pl.appendChild(g); $('wNote').hidden = false; }
    }

    // ── صفوف الأذكار: دايرة تقدّم الهدف + شريط تحميل + حالة ──
    const topV = rows[0][k], R = 2 * Math.PI * 18;
    for (const x of rows) {
      const n = x[k], rounds = T ? Math.floor(n / T) : 0, rem = T ? n % T : 0;
      const p = T ? (rounds > 0 ? 1 : rem / T) : n / topV, done = !!T && rounds > 0;
      const r = mk('div', 'skrow'), ring = mk('div', 'skring' + (done ? ' done' : ''));
      ring.innerHTML = '<svg viewBox="0 0 44 44"><circle class="mt" cx="22" cy="22" r="18"/><circle class="mp" cx="22" cy="22" r="18"/></svg>';
      ring.appendChild(mk('b', '', done ? '✓' : Math.round(p * 100) + '%'));
      const mp = ring.querySelector('.mp'); anim.push(() => { mp.style.strokeDashoffset = String(R * (1 - p)); });
      const body = mk('div', 'skbody'), h = mk('div', 'skh'), ld = mk('div', 'skld'), bar = mk('i');
      h.append(mk('span', '', x.text), mk('b', '', String(n)));
      ld.appendChild(bar); anim.push(() => { bar.style.width = (n / topV) * 100 + '%'; });
      body.append(h, ld);
      if (T) body.appendChild(mk('div', 'skchip' + (done ? ' ok' : ''), done ? '✓ وصلت لهدفك' + (rounds > 1 ? ' ×' + rounds : '') : 'باقي ' + (T - n) + ' للهدف'));
      r.append(ring, body); box.appendChild(r);
    }
    requestAnimationFrame(() => requestAnimationFrame(() => anim.forEach(f => f())));
  }
  document.querySelectorAll('#stSeg .pill').forEach(b => { b.onclick = () => { statsTab = b.dataset.k; renderStats(); }; });

  // ───── الهدف ─────
  let flash = null;
  function saveTarget() {
    const raw = $('target').value.trim(), btn = $('saveTarget');
    clearTimeout(flash);
    if (raw === '') { window.azkar.patch({ target: null }); btn.textContent = 'تم ✓'; }
    else {
      const n = Math.floor(Number(raw));
      if (!(n >= 1)) btn.textContent = 'رقم موجب';
      else { window.azkar.patch({ target: Math.min(n, 1e9) }); btn.textContent = 'تم ✓'; }
    }
    flash = setTimeout(() => { btn.textContent = 'حفظ'; }, 1400);
  }
  $('saveTarget').onclick = saveTarget;
  $('target').addEventListener('keydown', e => { if (e.key === 'Enter') saveTarget(); });
  $('autoChk').onchange = e => window.azkar.patch({ autoAdvance: e.target.checked });

  // ───── الأذكار المخصصة ─────
  async function addDhikr() {
    const r = await window.azkar.addDhikr($('newDhikr').value);
    $('err').textContent = r.ok ? '' : (r.error || '');
    if (r.ok) { $('newDhikr').value = ''; window.azkar.patch({ dhikrId: r.id }); }
  }
  $('addDhikr').onclick = addDhikr;
  $('newDhikr').addEventListener('keydown', e => { if (e.key === 'Enter') addDhikr(); });

  // ───── الأصوات + Mini Mode ─────
  const bindVol = (id, key, pctId, previewKind) => {
    $(id).oninput = e => { const v = Number(e.target.value) / 100; $(pctId).textContent = Math.round(v * 100) + '%'; window.azkar.patch({ [key]: v }); };
    if (previewKind) $(id).onchange = e => preview(previewKind, Number(e.target.value) / 100, previewKind === 'athan' ? 4 : 0);
  };
  bindVol('clickVol', 'volume', 'clickPct', 'click');
  bindVol('doneVol', 'completionVolume', 'donePct', 'done');
  bindVol('exitVol', 'exitVolume', 'exitPct', 'exit');
  bindVol('startVol', 'startupVolume', 'startPct', 'startup');
  bindVol('miniOp', 'miniOpacity', 'miniPct', null);
  bindVol('idleOp', 'idleOpacity', 'idlePct', null);
  bindVol('ppSize', 'popupScale', 'ppSizePct', null);
  $('soundChk').onchange = e => window.azkar.patch({ sound: e.target.checked });
  $('doneChk').onchange  = e => window.azkar.patch({ completionSound: e.target.checked });
  $('exitChk').onchange  = e => window.azkar.patch({ exitSound: e.target.checked });
  $('startChk').onchange = e => window.azkar.patch({ startupSound: e.target.checked });
  $('miniChk').onchange  = e => window.azkar.patch({ miniMode: e.target.checked });
  document.querySelectorAll('#dsSeg .pill').forEach(b => { b.onclick = () => { window.azkar.patch({ dialStyle: b.dataset.k }); ddClose('ds'); }; });
  $('glowChk').onchange = e => window.azkar.patch({ beadGlow: e.target.checked });
  bindVol('beadLt', 'beadLight', 'beadLtPct', null);
  for (const k of ['cp', 'ds']) $(k + 'Dd').onclick = () => { const o = $(k + 'Fold').classList.toggle('open'); $(k + 'Dd').setAttribute('aria-expanded', String(o)); };
  const ddClose = k => { $(k + 'Fold').classList.remove('open'); $(k + 'Dd').setAttribute('aria-expanded', 'false'); };
  document.querySelectorAll('#cpSeg .pill').forEach(b => { b.onclick = () => { window.azkar.patch({ cardsPos: b.dataset.k }); ddClose('cp'); }; });
  $('cpTest').onclick = () => window.azkar.popupTest('cards');
  $('azSndChk').onchange = e => window.azkar.patch({ azSound: e.target.checked });
  $('prChk').onchange = () => window.azkar.patch({ prayerAlert: $('prChk').checked });
  $('prCity').onchange = () => window.azkar.patch({ prayerCity: $('prCity').value });
  ['fj', 'du', 'dh', 'as', 'mg', 'is'].forEach(k => { $('pr_' + k).onchange = () => window.azkar.patch({ prayerOn: { [k]: $('pr_' + k).checked } }); });
  $('prSndChk').onchange = e => window.azkar.patch({ prayerSound: e.target.checked });
  $('azTestP').onclick = () => window.azkar.popupTest('athan');
  const updAcc = window.updAcc = () => document.querySelectorAll('.acc-st[data-sw]').forEach(el => {
    const on = el.dataset.sw.split(',').some(id => { const c = document.getElementById(id); return c && c.checked; });
    el.textContent = on ? 'مفعّل' : 'متوقف'; el.classList.toggle('on', on);
  });
  document.addEventListener('change', updAcc);
  $('ppTest').onclick = () => window.azkar.popupTest('verse');
  $('spaceChk').onchange = e => window.azkar.patch({ spaceKey: e.target.checked });
  $('ckChk').onchange = e => window.azkar.patch({ customKeyOn: e.target.checked });
  $('ckClear').onclick = () => window.azkar.patch({ customKeyClear: true });
  $('lockChk').onchange = e => window.azkar.patch({ dialLocked: e.target.checked });

  let ckSwallow = 0;                                          // أثناء التسجيل (وبعده بلحظة) نبلع ضغطات الكيبورد علشان Esc/Space/Enter ما يعملوش حاجة في الصفحة
  const ckStop = () => { $('ckBtn').classList.remove('listen'); ckSwallow = Date.now() + 400; $('ckBtn').blur(); if (S) render(S); };
  ['keydown', 'keyup'].forEach(t => window.addEventListener(t, e => {
    if ($('ckBtn').classList.contains('listen') || hkListen || Date.now() < ckSwallow) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true));
  $('ckBtn').onclick = () => {
    if ($('ckBtn').classList.contains('listen')) { window.azkar.cancelCaptureKey(); return; }
    $('ckBtn').classList.add('listen'); $('ckBtn').textContent = 'اضغط الزر أو الاختصار الآن… (Esc للإلغاء)';
    $('ckBtn').blur();
    window.azkar.captureKey();
  };
  const HK = ['quit', 'mini', 'show', 'settings'], HK_HINT = $('hkHint').textContent; let hkListen = null, hkTimer = null;
  const hkStop = () => { if (hkListen) $('hk_' + hkListen).classList.remove('listen'); hkListen = null; ckSwallow = Date.now() + 400; if (S) render(S); };
  HK.forEach(a => {
    $('hkx_' + a).onclick = () => window.azkar.patch({ hotkeyClear: a });
    $('hk_' + a).onclick = () => {
      if (hkListen || $('ckBtn').classList.contains('listen')) { window.azkar.cancelCaptureKey(); return; }
      hkListen = a; $('hk_' + a).classList.add('listen'); $('hk_' + a).textContent = 'اضغط الاختصار الآن… (Esc للإلغاء)';
      $('hk_' + a).blur(); window.azkar.captureKey(a);
    };
  });
  window.azkar.onKeyCaptured(d => {
    ckStop(); hkStop();
    clearTimeout(hkTimer); $('hkHint').textContent = (d && d.error) ? d.error : HK_HINT; $('hkHint').style.color = (d && d.error) ? '#ff8a80' : '';
    if (d && d.error) hkTimer = setTimeout(() => { $('hkHint').textContent = HK_HINT; $('hkHint').style.color = ''; }, 4500);
  });
  $('scrollChk').onchange = e => window.azkar.patch({ scrollOn: e.target.checked });
  $('clickChk').onchange  = e => window.azkar.patch({ clickOn: e.target.checked });
  $('launchChk').onchange = e => window.azkar.patch({ autoLaunch: e.target.checked });

  document.querySelectorAll('.rng').forEach(el => el.addEventListener('pointerdown', () => { sliding = el; }));
  window.addEventListener('pointerup', () => { if (sliding) { sliding = null; if (S) render(S); } });

  // ───── التنبيهات ─────
  const UNIT_SEC = { s: 1, m: 60, h: 3600 };
  const IV_MIN = 10, IV_MAX = 86400;                          // نفس حدود الـ main (10 ثواني .. 24 ساعة)
  const splitSec = sec => (sec % 3600 === 0 ? { v: sec / 3600, u: 'h' } : sec % 60 === 0 ? { v: sec / 60, u: 'm' } : { v: sec, u: 's' });
  function setIv(valEl, unitEl, sec) {
    if (document.activeElement === valEl || document.activeElement === unitEl) return;   // ما نقاطعش المستخدم وهو بيكتب
    const { v, u } = splitSec(sec); valEl.value = v; unitEl.value = u;
  }
  const setErr = m => { $('remErr').textContent = m || ''; };
  function commitIv(valEl, unitEl, key) {
    const n = Number(valEl.value);
    if (!(n > 0)) return setErr('اكتب رقمًا أكبر من صفر');
    const sec = Math.round(n * UNIT_SEC[unitEl.value]);
    if (sec < IV_MIN) return setErr('أقل فاصل ' + IV_MIN + ' ثواني');
    if (sec > IV_MAX) return setErr('أقصى فاصل 24 ساعة');
    setErr(''); window.azkar.patch({ [key]: sec });
  }
  function bindIv(valId, unitId, key) {
    const v = $(valId), u = $(unitId);
    let t = null;
    v.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => commitIv(v, u, key), 900); });   // يتحفظ تلقائيًا بعد ما يوقف كتابة
    v.addEventListener('change', () => { clearTimeout(t); commitIv(v, u, key); });
    v.addEventListener('keydown', e => { if (e.key === 'Enter') { clearTimeout(t); commitIv(v, u, key); v.blur(); } });
    u.addEventListener('change', () => commitIv(v, u, key));
  }
  bindIv('remVal', 'remUnit', 'reminderEvery');
  bindIv('chalVal', 'chalUnit', 'challengeEvery');
  $('remChk').onchange = e => {
    window.azkar.patch({ reminderOn: e.target.checked });
    if (e.target.checked) setTimeout(() => $('remFold').scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 140);
  };
  $('chalChk').onchange = e => window.azkar.patch({ challengeOn: e.target.checked });
  $('dndChk').onchange = e => window.azkar.patch({ dndFullscreen: e.target.checked });
  bindVol('remVol', 'reminderVolume', 'remPct', 'reminder');
  bindVol('cpSize', 'cardsScale', 'cpSizePct', null);
  bindVol('azVol', 'azVolume', 'azPct', 'owl');
  bindVol('prVol', 'prayerVolume', 'prPct', 'athan');
  bindVol('wdVol', 'wirdVolume', 'wdPct', 'wird');
  $('wdSndChk').onchange = e => window.azkar.patch({ wirdSound: e.target.checked });
  $('wdChk').onchange = () => window.azkar.patch({ wirdAlert: $('wdChk').checked });
  $('wdAt').onchange = () => { if ($('wdAt').value) window.azkar.patch({ wirdAt: $('wdAt').value }); };
  $('azTestM').onclick = () => window.wzx.testAz('m'); $('azTestE').onclick = () => window.wzx.testAz('e'); $('azTestW').onclick = () => window.wzx.testAz('w');
  $('azTestSl').onclick = () => window.wzx.testAz('sl'); $('azTestWk').onclick = () => window.wzx.testAz('wk');
  $('remSndChk').onchange  = e => window.azkar.patch({ reminderSound: e.target.checked });
  $('remSndChk2').onchange = e => window.azkar.patch({ reminderSound: e.target.checked });
  bindVol('popVol', 'popupVolume', 'popPct', 'challenge');    // معاينة بصوت الإنجاز عند ترك السلايدر
  $('testVerse').onclick = () => window.azkar.popupTest('verse');
  $('testCards').onclick = () => window.azkar.popupTest('cards');

  // ───── التنبيهات المخصصة ─────
  const X = window.wzx || null;                                 // من preload-ext.js
  let alertsData = [], form = null, tAudio = null, tTimer = null, delTimer = null;
  const SPEAKER = '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 010 7"/></svg>';
  const ICON_EDIT = '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>';
  const ICON_DEL = '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V4.5h4V7M7 7l1 12.5h8L17 7M10.5 11v5M13.5 11v5"/></svg>';
  const MAX_TXT = 140;

  function renderAlertsNote() {
    const el = $('alertsNote'); if (!el || !S) return;
    const on = alertsData.filter(a => a.enabled).length;
    let m = '';
    if (!S.reminderOn) m = 'تنبيه الأذكار متوقف حاليًا، فعّله من الأعلى لتظهر التنبيهات.';
    else if (!on && !S.builtinVerses) m = 'مفيش تنبيه مخصص مفعّل، فهتظهر آيات التطبيق الافتراضية.';
    el.textContent = m; el.style.display = m ? '' : 'none';
  }

  function renderAlerts(list) {
    alertsData = Array.isArray(list) ? list : [];
    const box = $('alerts'); box.textContent = '';
    clearTimeout(delTimer);
    if (!alertsData.length) {
      const e = document.createElement('div'); e.className = 'empty';
      e.textContent = 'لا توجد تنبيهات مخصصة بعد. اضغط «تنبيه جديد» لإضافة أول تنبيه.';
      box.appendChild(e);
    }
    for (const a of alertsData) {
      const row = document.createElement('div');
      row.className = 'arow' + (a.enabled ? '' : ' off') + (form && form.id === a.id ? ' editing' : '');
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!a.enabled;
      cb.setAttribute('aria-label', 'تفعيل التنبيه'); cb.title = a.enabled ? 'مفعّل' : 'متوقف';
      cb.onchange = () => X && X.toggleAlert(a.id, cb.checked);
      const tx = document.createElement('button'); tx.className = 'atx'; tx.type = 'button'; tx.title = 'تعديل';
      const at = document.createElement('div'); at.className = 'at'; at.textContent = a.text;
      tx.appendChild(at);
      if (a.sound) {
        const as = document.createElement('div'); as.className = 'as';
        as.insertAdjacentHTML('afterbegin', SPEAKER);
        const nm = document.createElement('span'); nm.textContent = a.sound.name; as.appendChild(nm);
        tx.appendChild(as);
      }
      tx.onclick = () => openForm(a);
      const acts = document.createElement('div'); acts.className = 'acts';
      const ed = document.createElement('button'); ed.className = 'ibtn'; ed.type = 'button'; ed.setAttribute('aria-label', 'تعديل'); ed.title = 'تعديل';
      ed.innerHTML = ICON_EDIT; ed.onclick = () => openForm(a);
      const del = document.createElement('button'); del.className = 'ibtn del'; del.type = 'button'; del.setAttribute('aria-label', 'حذف'); del.title = 'حذف';
      del.innerHTML = ICON_DEL;
      del.onclick = () => {                                          // حذف بخطوتين علشان ما يحصلش بالغلط
        if (del.classList.contains('confirm')) {
          clearTimeout(delTimer);
          if (form && form.id === a.id) closeForm();
          return X && X.deleteAlert(a.id);
        }
        clearTimeout(delTimer);
        box.querySelectorAll('.del.confirm').forEach(b => { b.className = 'ibtn del'; b.innerHTML = ICON_DEL; });
        del.className = 'pill sm del confirm'; del.textContent = 'تأكيد الحذف؟';
        delTimer = setTimeout(() => { del.className = 'ibtn del'; del.innerHTML = ICON_DEL; }, 2400);
      };
      acts.append(ed, del);
      row.append(cb, tx, acts);
      box.appendChild(row);
    }
    renderAlertsNote();
  }

  const aErr = m => { $('aErr').textContent = m || ''; };
  function setCount() {
    const n = [...$('aText').value].length, c = $('aCount');
    c.textContent = n + '/' + MAX_TXT; c.classList.toggle('max', n >= MAX_TXT);
  }
  function stopTest() {
    clearTimeout(tTimer);
    if (tAudio) { try { tAudio.pause(); } catch (_) {} tAudio.onended = tAudio.onerror = tAudio.onplaying = null; tAudio = null; }
    const b = $('aTest'); if (b) b.classList.remove('on');
  }
  const tMsg = (m, c) => { const el = $('aTestMsg'); el.textContent = m || ''; el.className = 'tmsg' + (c ? ' ' + c : ''); };
  function currentSrc() {
    if (!form) return null;
    if (form.kind === 'file') return form.fileUrl || null;
    if (form.kind === 'url') { const u = $('aUrl').value.trim(); return u || null; }
    return null;
  }
  function syncKind() {
    document.querySelectorAll('#aSeg .pill').forEach(b => b.classList.toggle('on', b.dataset.k === form.kind));
    $('aFileRow').hidden = form.kind !== 'file';
    $('aUrlRow').hidden = form.kind !== 'url';
    $('aTestRow').hidden = form.kind === 'none';
    const fn = $('aFileName');
    fn.textContent = form.file ? form.fileName : 'لم يتم اختيار ملف'; fn.classList.toggle('has', !!form.file);
    $('aPick').textContent = form.file ? 'تغيير الملف…' : 'اختيار ملف…';
  }
  function setKind(k) { form.kind = k; stopTest(); tMsg(''); aErr(''); syncKind(); if (k === 'url') setTimeout(() => $('aUrl').focus(), 30); }

  function openForm(a) {
    if (!X) return;
    stopTest(); tMsg(''); aErr('');
    form = { id: a ? a.id : null, kind: 'none', file: null, fileName: '', fileUrl: '' };
    $('aTitle').textContent = a ? 'تعديل التنبيه' : 'تنبيه جديد';
    $('aText').value = a ? a.text : ''; $('aUrl').value = '';
    if (a && a.sound) {
      form.kind = a.sound.kind;
      if (a.sound.kind === 'file') { form.file = a.sound.file; form.fileName = a.sound.name; form.fileUrl = a.sound.url; }
      else $('aUrl').value = a.sound.url;
    }
    $('aform').hidden = false; $('newAlert').disabled = true;
    setCount(); syncKind(); renderAlerts(alertsData);
    setTimeout(() => { $('aform').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); $('aText').focus(); }, 60);
  }
  function closeForm() {
    if (!form) return;
    stopTest(); form = null;
    $('aform').hidden = true; $('newAlert').disabled = false; aErr(''); tMsg('');
    renderAlerts(alertsData);
  }

  function draft() {
    const d = { text: $('aText').value, sound: { kind: 'none' } };
    if (form.id) d.id = form.id;
    if (form.kind === 'file' && form.file) d.sound = { kind: 'file', file: form.file, name: form.fileName };
    else if (form.kind === 'url') d.sound = { kind: 'url', url: $('aUrl').value.trim() };
    return d;
  }
  function validate() {
    if (!$('aText').value.trim()) { aErr('اكتب نص التنبيه الأول'); $('aText').focus(); return false; }
    if (form.kind === 'file' && !form.file) { aErr('اختر ملف الصوت، أو اختر «بدون صوت»'); return false; }
    if (form.kind === 'url' && !$('aUrl').value.trim()) { aErr('اكتب رابط الصوت، أو اختر «بدون صوت»'); $('aUrl').focus(); return false; }
    aErr(''); return true;
  }
  async function saveAlert() {
    if (!X || !form || !validate()) return;
    const btn = $('aSave'); btn.disabled = true;
    try {
      const r = await X.saveAlert(draft());
      if (r && r.ok) { closeForm(); } else aErr((r && r.error) || 'تعذّر الحفظ');
    } catch (_) { aErr('تعذّر الحفظ'); }
    btn.disabled = false;
  }

  async function pickFile() {
    if (!X || !form) return;
    const btn = $('aPick'); btn.disabled = true; aErr('');
    try {
      const r = await X.pickSound();
      if (r && r.ok) { form.file = r.file; form.fileName = r.name; form.fileUrl = r.url; stopTest(); tMsg(''); syncKind(); }
      else if (r && !r.canceled) aErr(r.error || 'تعذّر اختيار الملف');
    } catch (_) { aErr('تعذّر اختيار الملف'); }
    btn.disabled = false;
  }

  // تجربة الصوت (قبل الحفظ): نفس الصوت اللي هيتشغّل مع التنبيه
  function testSound() {
    if (!form) return;
    if (tAudio) { stopTest(); tMsg(''); return; }                // الضغطة التانية = إيقاف
    const src = currentSrc();
    if (!src) return tMsg(form.kind === 'file' ? 'اختر ملفًا أولًا' : 'اكتب الرابط أولًا', 'bad');
    if (form.kind === 'url' && !/^https?:\/\//i.test(src)) return tMsg('الرابط لازم يبدأ بـ http:// أو https://', 'bad');
    const a = tAudio = new Audio(); a.preload = 'auto';
    const vol = S && Number.isFinite(S.reminderVolume) ? S.reminderVolume : 0.5;
    a.volume = Math.min(1, Math.max(0.05, vol));
    $('aTest').classList.add('on'); tMsg('جاري التحميل…');
    const fail = () => { if (tAudio !== a) return; stopTest(); tMsg('تعذّر تشغيل هذا الصوت، تأكد من الملف أو الرابط', 'bad'); };
    a.onplaying = () => { clearTimeout(tTimer); if (tAudio === a) tMsg('الصوت شغّال ✓', 'ok'); };
    a.onended = () => { if (tAudio === a) { stopTest(); tMsg('الصوت شغّال ✓', 'ok'); } };
    a.onerror = fail;
    tTimer = setTimeout(fail, 12000);                             // الرابط بطيء/مش بيرد
    a.src = src;
    const p = a.play(); if (p && p.catch) p.catch(fail);
  }

  if (X) {
    $('newAlert').onclick = () => openForm(null);
    $('aCancel').onclick = closeForm;
    $('aSave').onclick = saveAlert;
    $('aPick').onclick = pickFile;
    $('aTest').onclick = testSound;
    $('aPreview').onclick = () => { if (form && validate()) X.previewAlert(draft()); };
    document.querySelectorAll('#aSeg .pill').forEach(b => { b.onclick = () => setKind(b.dataset.k); });
    $('aText').addEventListener('input', () => { setCount(); aErr(''); });
    $('aText').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveAlert(); } });
    $('aUrl').addEventListener('input', () => { stopTest(); tMsg(''); aErr(''); });
    $('aUrl').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveAlert(); } });
    X.onAlerts(renderAlerts);
    X.getAlerts().then(renderAlerts).catch(() => {});
  } else {                                                        // preload-ext.js ما اتحمّلش: نوضّح بدل ما الأزرار تبان ميتة
    $('newAlert').disabled = true;
    $('alerts').innerHTML = '<div class="empty">ميزة التنبيهات المخصصة محتاجة إعادة تشغيل التطبيق بعد التحديث.</div>';
  }
  $('builtinChk').onchange = e => window.azkar.patch({ builtinVerses: e.target.checked });

  // ───── إغلاق / رجوع ─────
  const close = () => window.azkar.closeSettings();
  $('x').onclick = close;
  $('backTop').onclick = () => go('hub');
  window.addEventListener('keydown', e => { if (e.key === 'Escape') { if (form) closeForm(); else goBack(); } });

  const focusTarget = f => {
    if (f === 'quranread') { go('pQuran'); qResume(); return; }   // من إشعار الورد: القرآن عند آخر صفحة
    if (f === 'target') { go('pGoal'); setTimeout(() => { $('target').focus(); $('target').select(); }, 80); }
    else if (/^daily:(m|e|sl|wk)$/.test(f)) { dSel = f.slice(6); renderDaily(S || {}); go('pDaily'); setTimeout(() => { const l = $('dList'); if (l && l.scrollIntoView) l.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 120); }   // من إشعار/أيقونة النوم أو الاستيقاظ: يفتح الذكر مباشرة
    else if (HASH_MAP[f]) { if (f === 'daily' && S && S.azDue) { dSel = S.azDue; renderDaily(S); } go(HASH_MAP[f]); }
  };

  // ───── تخصيص المسبحة: معاينة + سحب + حجم + عناصر مضافة ─────
  const LX = window.WZLayout;
  let LAY = { k: 1, els: {}, extras: [] }, lxSel = null, lxBusy = 0, lxSendT = 0, lxDrag = null;
  const lxClone = o => JSON.parse(JSON.stringify(o || { k: 1, els: {}, extras: [] }));
  const lxCard = () => $('pvCard');
  const lxGet = id => {                                             // بيانات عنصر (أصلي أو مضاف) للتعديل
    if (!id) return null;
    if (id[0] === 'x' && /^x\d+$/.test(id)) return (LAY.extras || []).find(x => x.id === id) || null;
    return LAY.els[id] || (LAY.els[id] = { dx: 0, dy: 0, s: 1 });
  };
  const lxName = id => {
    const x = (LAY.extras || []).find(e => e.id === id);
    if (x) return (LX.EXTRA_TYPES.find(t => t.type === x.type) || {}).label || 'عنصر مضاف';
    return (LX.ELS.find(e => e.id === id) || {}).label || '';
  };
  const lxSend = (now) => {                                         // إرسال للمسبحة الحقيقية (متقطّع أثناء السحب)
    const go = () => { lxSendT = 0; window.azkar.patch({ dialLayout: lxClone(LAY) }); };
    if (now) { clearTimeout(lxSendT); go(); } else if (!lxSendT) lxSendT = setTimeout(go, 90);
  };
  const lxBusyOn = () => { lxBusy++; setTimeout(() => lxBusy--, 700); };

  function pvBuildBeads(st) {                                       // خرز ثابت للمعاينة (نفس المقاسات والأماكن بتاعة المسبحة الحقيقية)
    const svg = $('pvBeads'); svg.textContent = '';
    if (st !== 'beads' && st !== 'strand') return;
    const NS = 'http://www.w3.org/2000/svg', big = st === 'strand', N = big ? 16 : 28, R = big ? 11.2 : 6.9, RR = big ? 74 : 70;
    const E = (tag, at, par) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); par.appendChild(e); return e; };
    const g = E('radialGradient', { id: 'pvbg', cx: '.34', cy: '.28', r: '.95' }, E('defs', {}, svg));
    [[0, '#2c6e52'], [.5, '#0f3123'], [1, '#07140e']].forEach(([o, c]) => E('stop', { offset: o, 'stop-color': c }, g));
    E('circle', { cx: 88, cy: 88, r: RR, fill: 'none', stroke: big ? 'rgba(61,255,163,.12)' : '#0a1c14', 'stroke-width': 1.6 }, svg);
    for (let i = 0; i < N; i++) {
      const a = (-90 + i * 360 / N) * Math.PI / 180;
      E('circle', { cx: (88 + RR * Math.cos(a)).toFixed(2), cy: (88 + RR * Math.sin(a)).toFixed(2), r: R, fill: 'url(#pvbg)', stroke: 'rgba(0,0,0,.55)', 'stroke-width': .7 }, svg);
    }
  }
  function lxPaintPreview() {
    const c = lxCard(); if (!c || !S) return;
    const box = $('pvBox'), k = LAY.k || 1;
    c.style.transform = 'scale(' + k + ')';
    box.style.width = Math.round(258 * k + 36) + 'px'; box.style.height = Math.round(354 * k + 36) + 'px';
    c.style.left = '18px'; c.style.top = '18px'; c.style.position = 'absolute';
    const dl = $('pvDial'), st = S.dialStyle || 'ring';                // المعاينة بتاخد نفس شكل المسبحة الحقيقية (دايرة / حبات / خرز)
    dl.classList.toggle('beads', st === 'beads'); dl.classList.toggle('strand', st === 'strand');
    if (dl.dataset.bs !== st) { dl.dataset.bs = st; pvBuildBeads(st); }
    const t = S.target, n = S.count || 0;
    $('pvNum').textContent = n; $('pvOf').textContent = t ? '/ ' + t : 'بدون هدف';
    $('pvBar').style.strokeDashoffset = t ? 465 * (1 - Math.min(1, n / t)) : 465;
    $('pvDhikr').textContent = S.dhikrText || ''; $('pvTotal').textContent = 'الإجمالي ' + (S.total || 0);
    $('pvTag').textContent = 'وَذَكِّرْ فَإِنَّ الذِّكْرَىٰ تَنفَعُ الْمُؤْمِنِينَ'; $('pvGoal').textContent = t || '∞';
    LX.apply(c, LAY);
    LX.renderExtras($('pvX'), LAY, S);
    c.querySelectorAll('.pvsel').forEach(n2 => n2.classList.remove('pvsel'));
    const cur = lxSel && (lxSel[0] === 'x' && /^x\d+$/.test(lxSel) ? c.querySelector('[data-xid="' + lxSel + '"]') : c.querySelector('[data-lx="' + lxSel + '"]'));
    if (cur) cur.classList.add('pvsel');
  }

  // ───── حدود المسبحة: العنصر مايخرجش بره الكارت (أقصى حجم = على الحدود) ─────
  const LX_W = 258, LX_H = 354, LX_M = 4;
  function lxRect(id) {
    const c = lxCard(), k = LAY.k || 1;
    const e = /^x\d+$/.test(id) ? c.querySelector('[data-xid="' + id + '"]') : c.querySelector('[data-lx="' + id + '"]');
    if (!e) return null;
    const r = e.getBoundingClientRect(), b = c.getBoundingClientRect();
    return { l: (r.left - b.left) / k, t: (r.top - b.top) / k, r: (r.right - b.left) / k, b: (r.bottom - b.top) / k };
  }
  // تكبير: بيقف عند الحدود (من غير ما يتحرك العنصر). prevS = آخر حجم كان سليم
  function lxFitScale(id, prevS) {
    const d = lxGet(id); if (!d) return;
    lxPaintPreview();
    const R = lxRect(id); if (!R) return;
    const w = R.r - R.l, h = R.b - R.t, cx = (R.l + R.r) / 2, cy = (R.t + R.b) / 2;
    const f = Math.min(1, 2 * (cx - LX_M) / w, 2 * (LX_W - LX_M - cx) / w, 2 * (cy - LX_M) / h, 2 * (LX_H - LX_M - cy) / h);
    if (f < 0.999) {
      d.s = Math.max(Math.min(prevS || 1, d.s), Math.floor(d.s * Math.max(0.05, f) * 100) / 100);
      d.s = Math.max(0.4, d.s);
      lxPaintPreview();
    }
  }
  // تحريك: بيفضل جوه الحدود (لو العنصر أكبر من الكارت نفسه بيتصغّر)
  function lxFitPos(id) {
    const d = lxGet(id); if (!d) return;
    for (let i = 0; i < 4; i++) {
      lxPaintPreview();
      const R = lxRect(id); if (!R) return;
      const w = R.r - R.l, h = R.b - R.t;
      if (w > LX_W - 2 * LX_M || h > LX_H - 2 * LX_M) { d.s = Math.max(0.4, Math.floor(d.s * Math.min((LX_W - 2 * LX_M) / w, (LX_H - 2 * LX_M) / h) * 100) / 100); continue; }
      const sx = R.l < LX_M ? LX_M - R.l : R.r > LX_W - LX_M ? LX_W - LX_M - R.r : 0;
      const sy = R.t < LX_M ? LX_M - R.t : R.b > LX_H - LX_M ? LX_H - LX_M - R.b : 0;
      if (Math.abs(sx) < 0.5 && Math.abs(sy) < 0.5) break;
      d.dx = Math.max(-400, Math.min(400, Math.round((d.dx || 0) + sx))); d.dy = Math.max(-400, Math.min(400, Math.round((d.dy || 0) + sy)));
    }
    lxPaintPreview();
  }


  // ───── مسطرة المحاذاة: مغناطيس + خطوط + مسافات (بتشتغل أثناء السحب في المعاينة) ─────
  const SNAP_PX = 6, GAP_MAX = 120, EDGE_MAX = 40, EPS = 0.6, NEAR = 90;   // NEAR: بنحاذي بس مع العناصر القريبة (مش اللي في الناحية التانية من المسبحة)
  const gapX = (R, t) => Math.max(0, Math.max(R.l, t.l) - Math.min(R.r, t.r)), gapY = (R, t) => Math.max(0, Math.max(R.t, t.t) - Math.min(R.b, t.b));
  function lxTargets(id) {                                           // كل العناصر الظاهرة غير العنصر المسحوب (وغير اللي جواه)
    const c = lxCard(), k = LAY.k || 1, b = c.getBoundingClientRect();
    const me = /^x\d+$/.test(id) ? c.querySelector('[data-xid="' + id + '"]') : c.querySelector('[data-lx="' + id + '"]');
    const out = [], seen = new Set();
    const add = (el, kind, name) => {
      if (!el || el === me || seen.has(el) || (me && me.contains(el)) || el.closest('.lx-off')) return;
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
      seen.add(el);
      out.push({ el, kind, name, l: (r.left - b.left) / k, t: (r.top - b.top) / k, r: (r.right - b.left) / k, b: (r.bottom - b.top) / k });
    };
    c.querySelectorAll('[data-lx]').forEach(e => { if (e.dataset.lx !== 'az') add(e, 'el'); });
    c.querySelectorAll('.azdue').forEach(e => add(e, 'el'));
    c.querySelectorAll('.xel').forEach(e => add(e, 'el'));
    add(c.querySelector('.pvstar'), 'star');
    return out;
  }
  const lxMid = (a, b) => (a + b) / 2;
  function lxSnap(id, off) {
    if (off) return;
    const d = lxGet(id); if (!d) return;
    lxPaintPreview();
    const R = lxRect(id); if (!R) return;
    const T = lxTargets(id);
    const xs = [R.l, lxMid(R.l, R.r), R.r], ys = [R.t, lxMid(R.t, R.b), R.b];
    const tx = [LX_W / 2], ty = [LX_H / 2], cx = [LX_W / 2], cy = [LX_H / 2];       // cx/cy = المنتصفات بس (ليها أولوية: منتصف على منتصف قبل الحواف)
    T.forEach(t => {
      if (gapY(R, t) <= NEAR) { tx.push(t.l, lxMid(t.l, t.r), t.r); cx.push(lxMid(t.l, t.r)); }
      if (gapX(R, t) <= NEAR) { ty.push(t.t, lxMid(t.t, t.b), t.b); cy.push(lxMid(t.t, t.b)); }
    });
    const best = (as, ts) => { let b = null; for (const a of as) for (const v of ts) { const dd = v - a; if (Math.abs(dd) <= SNAP_PX && (b === null || Math.abs(dd) < Math.abs(b))) b = dd; } return b; };
    const pick = (as, ac, ts, tc) => { const c = best([ac], tc); return c !== null ? c : best(as, ts); };
    const bx = pick(xs, xs[1], tx, cx), by = pick(ys, ys[1], ty, cy), r2 = v => Math.round(v * 100) / 100;
    if (bx !== null) d.dx = Math.max(-400, Math.min(400, r2((d.dx || 0) + bx)));
    if (by !== null) d.dy = Math.max(-400, Math.min(400, r2((d.dy || 0) + by)));
  }
  function lxGuidesClear() { const g = lxCard().querySelector('.pvg'); if (g) g.remove(); }
  function lxGuides(id) {
    const c = lxCard(); lxPaintPreview();
    const R = lxRect(id); if (!R) return;
    const T = lxTargets(id);
    let g = c.querySelector('.pvg'); if (!g) { g = document.createElement('div'); g.className = 'pvg'; c.appendChild(g); }
    const h = [], f = v => Math.round(v * 100) / 100;
    const line = (x, y, w, hh, cls) => h.push('<i class="' + cls + '" style="left:' + f(x) + 'px;top:' + f(y) + 'px;width:' + f(w) + 'px;height:' + f(hh) + 'px"></i>');
    const tag = (x, y, t, cls) => h.push('<b class="gt ' + (cls || '') + '" style="left:' + f(x) + 'px;top:' + f(y) + 'px">' + t + '</b>');
    const cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const CROSS = '<svg viewBox="0 0 12 12" width="12" height="12" style="display:block;position:static"><circle cx="6" cy="6" r="3.2" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M6 .6v2.2M6 9.2v2.2M.6 6h2.2M9.2 6h2.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';   // علامة "في المنتصف" (من غير نص علشان الخط الصغير)
    const hit = new Set();
    // محاذاة: خط لكل مكان متطابق (حافة/منتصف) مع إبراز العناصر المتطابقة
    const axis = (isX) => {
      const mine = isX ? [['l', R.l], ['c', lxMid(R.l, R.r)], ['r', R.r]] : [['t', R.t], ['c', lxMid(R.t, R.b)], ['b', R.b]];
      const groups = new Map();
      const push = (pos, cc, t) => { const key = Math.round(pos * 2); const e = groups.get(key) || { pos, cc: [], ot: [], card: false }; if (!t) { e.card = true; e.center = true; } else if (cc) e.cc.push(t); else e.ot.push(t); groups.set(key, e); };
      for (const [mk, mv] of mine) {
        if (mk === 'c' && Math.abs((isX ? LX_W : LX_H) / 2 - mv) <= EPS) push((isX ? LX_W : LX_H) / 2, true, null);
        for (const t of T) {
          if ((isX ? gapY(R, t) : gapX(R, t)) > NEAR) continue;
          const tv = isX ? [['l', t.l], ['c', lxMid(t.l, t.r)], ['r', t.r]] : [['t', t.t], ['c', lxMid(t.t, t.b)], ['b', t.b]];
          for (const [tk, v] of tv) if (Math.abs(v - mv) <= EPS) push(mv, mk === 'c' && tk === 'c', t);
        }
      }
      let list = [...groups.values()];
      list.forEach(e => { if (e.cc.length) e.center = true; });
      const anyC = list.some(e => e.center);
      if (anyC) list = list.filter(e => e.center);                 // منتصف على منتصف ليه الأولوية وبيخفي خطوط الحواف
      list.sort((p, q) => (q.cc.length + q.ot.length) - (p.cc.length + p.ot.length));
      list.slice(0, 2).forEach(e => {
        const ts = e.center ? e.cc : e.ot;
        let lo = isX ? R.t : R.l, hi = isX ? R.b : R.r;
        ts.forEach(t => { hit.add(t); lo = Math.min(lo, isX ? t.t : t.l); hi = Math.max(hi, isX ? t.b : t.r); });
        if (e.card) { lo = 0; hi = isX ? LX_H : LX_W; }
        if (isX) line(e.pos, lo, 1, hi - lo, 'gl'); else line(lo, e.pos, hi - lo, 1, 'gl');
        if (e.center) {
          const lb = CROSS;
          if (isX) tag(cl(e.pos, 14, LX_W - 14), cl(hi + 11, 11, LX_H - 11), lb);
          else tag(cl(lo - 11, 14, LX_W - 14), cl(e.pos, 11, LX_H - 11), lb);
        }
      });
    };
    axis(true); axis(false);
    hit.forEach(t => { const bb = (t.l), r = t; line(r.l - 1, r.t - 1, r.r - r.l + 2, r.b - r.t + 2, 'gb'); });
    // مسافات: أقرب عنصر على كل جهة (أفقي/رأسي) + حدود المسبحة لو قريب
    const gapH = (from, to, y, val, near) => { line(from, y, to - from, 1, 'gm'); tag(lxMid(from, to), y - 8, Math.round(val), 'd'); };
    const gapV = (from, to, x, val) => { line(x, from, 1, to - from, 'gm'); tag(x + 12, lxMid(from, to), Math.round(val), 'd'); };
    const nearest = (list, key) => list.reduce((a, b) => (a === null || b[key] < a[key] ? b : a), null);
    const L1 = [], R1 = [], U1 = [], D1 = [];
    for (const t of T) {
      const ov = Math.min(R.b, t.b) - Math.max(R.t, t.t), oh = Math.min(R.r, t.r) - Math.max(R.l, t.l);
      if (ov > 0) { if (t.r <= R.l) L1.push({ t, gap: R.l - t.r, a: Math.max(R.t, t.t), z: Math.min(R.b, t.b) }); else if (t.l >= R.r) R1.push({ t, gap: t.l - R.r, a: Math.max(R.t, t.t), z: Math.min(R.b, t.b) }); }
      if (oh > 0) { if (t.b <= R.t) U1.push({ t, gap: R.t - t.b, a: Math.max(R.l, t.l), z: Math.min(R.r, t.r) }); else if (t.t >= R.b) D1.push({ t, gap: t.t - R.b, a: Math.max(R.l, t.l), z: Math.min(R.r, t.r) }); }
    }
    let n = nearest(L1, 'gap'); if (n && n.gap > .5 && n.gap <= GAP_MAX) gapH(n.t.r, R.l, lxMid(n.a, n.z), n.gap);
    n = nearest(R1, 'gap'); if (n && n.gap > .5 && n.gap <= GAP_MAX) gapH(R.r, n.t.l, lxMid(n.a, n.z), n.gap);
    n = nearest(U1, 'gap'); if (n && n.gap > .5 && n.gap <= GAP_MAX) gapV(n.t.b, R.t, lxMid(n.a, n.z), n.gap);
    n = nearest(D1, 'gap'); if (n && n.gap > .5 && n.gap <= GAP_MAX) gapV(R.b, n.t.t, lxMid(n.a, n.z), n.gap);
    const cy = lxMid(R.t, R.b), cx = lxMid(R.l, R.r);
    if (R.l > .5 && R.l <= EDGE_MAX) gapH(0, R.l, cy, R.l);
    if (LX_W - R.r > .5 && LX_W - R.r <= EDGE_MAX) gapH(R.r, LX_W, cy, LX_W - R.r);
    if (R.t > .5 && R.t <= EDGE_MAX) gapV(0, R.t, cx, R.t);
    if (LX_H - R.b > .5 && LX_H - R.b <= EDGE_MAX) gapV(R.b, LX_H, cx, LX_H - R.b);
    g.innerHTML = h.join('');
    g.querySelectorAll('.gt').forEach(t => { t.style.width = (t.scrollWidth + 2) + 'px'; });   // العرض الفعلي للنص (الخط بيتحمّل بعد القياس)
  }

  function lxPaintPanel() {
    const d = lxGet(lxSel), isX = !!lxSel && /^x\d+$/.test(lxSel);
    $('lxName').textContent = lxSel ? lxName(lxSel) : 'اختر عنصر من المعاينة';
    $('lxCtl').hidden = !lxSel; $('lxReset').disabled = !lxSel; $('lxTools').toggleAttribute('data-off', !lxSel);
    if (!lxSel || !d) return;
    if (document.activeElement !== $('lxSize')) $('lxSize').value = Math.round((d.s || 1) * 100);
    $('lxSizePct').textContent = Math.round((d.s || 1) * 100) + '%';
    const def = LX.ELS.find(e => e.id === lxSel);
    $('lxHide').checked = !!d.hide; $('lxHide').disabled = !!(def && def.noHide);
    const x = isX ? d : null;
    $('lxTextRow').hidden = !(x && x.type === 'text');
    if (x && x.type === 'text' && document.activeElement !== $('lxText')) $('lxText').value = x.text || '';
    $('lxDelRow').hidden = !isX;
  }
  function lxPaintAll() {
    lxPaintPreview(); lxPaintPanel();
    if (document.activeElement !== $('lxK')) $('lxK').value = Math.round((LAY.k || 1) * 100);
    $('lxKPct').textContent = Math.round((LAY.k || 1) * 100) + '%';
    const left = LX.EXTRAS_MAX - (LAY.extras || []).length;
    $('lxAdd').querySelectorAll('button').forEach(b => {
      const has = b.dataset.t !== 'text' && (LAY.extras || []).some(x => x.type === b.dataset.t);
      b.disabled = left <= 0 || has;
      const lab = b.textContent.replace(/^[+✓] /, ''); b.textContent = (has ? '✓ ' : '+ ') + lab;
    });
  }
  function renderLayout(s) {
    if (!lxDrag && !lxBusy && !lxSendT) LAY = lxClone(s.dialLayout);
    if (lxSel && !lxGet(lxSel)) lxSel = null;
    if (cur === 'pLayout' || !lxCard().dataset.init) { lxCard().dataset.init = '1'; lxPaintAll(); }
    chk($('lockChk'), s.dialLocked);
  }
  function lxSelect(id) { lxSel = id; lxPaintAll(); }
  function lxIdOf(t) {
    const x = t.closest && t.closest('.xel');
    if (x) return x.dataset.xid;
    const e = t.closest && t.closest('[data-lx]');
    return e && !(LX.ELS.find(d => d.id === e.dataset.lx) || {}).locked ? e.dataset.lx : null;   // اللوجو والآية ثابتين: مش بيتحددوا ولا بيتسحبوا
  }
  lxCard().addEventListener('pointerdown', ev => {
    if (ev.button !== 0) return;
    const id = lxIdOf(ev.target);
    if (!id) { lxSelect(null); return; }
    lxSelect(id);
    const d = lxGet(id); if (!d) return;
    lxDrag = { id, sx: ev.clientX, sy: ev.clientY, dx: d.dx || 0, dy: d.dy || 0, moved: false };
    lxCard().setPointerCapture(ev.pointerId); lxCard().classList.add('dragging');
    ev.preventDefault();
  });
  lxCard().addEventListener('pointermove', ev => {
    if (!lxDrag) return;
    const d = lxGet(lxDrag.id); if (!d) return;
    const k = LAY.k || 1;
    const nx = Math.round(lxDrag.dx + (ev.clientX - lxDrag.sx) / k), ny = Math.round(lxDrag.dy + (ev.clientY - lxDrag.sy) / k);
    if (lxDrag.rx === nx && lxDrag.ry === ny && lxDrag.alt === ev.altKey) return;
    lxDrag.rx = nx; lxDrag.ry = ny; lxDrag.alt = ev.altKey;
    lxDrag.moved = true; d.dx = Math.max(-400, Math.min(400, nx)); d.dy = Math.max(-400, Math.min(400, ny));
    lxSnap(lxDrag.id, ev.altKey);                                  // الـ Alt = من غير مغناطيس
    lxFitPos(lxDrag.id); lxGuides(lxDrag.id); lxSend(false);
  });
  const lxEnd = () => { if (!lxDrag) return; const m = lxDrag.moved; lxDrag = null; lxCard().classList.remove('dragging'); lxGuidesClear(); lxBusyOn(); if (m) lxSend(true); lxPaintPanel(); };
  lxCard().addEventListener('pointerup', lxEnd);
  lxCard().addEventListener('pointercancel', lxEnd);

  const lxChange = fn => { const d = lxGet(lxSel); if (!d) return; fn(d); lxBusyOn(); lxPaintAll(); lxSend(false); };
  $('lxSize').oninput = e => { const d0 = lxGet(lxSel); if (!d0) return; const prev = d0.s || 1; d0.s = Number(e.target.value) / 100; lxFitScale(lxSel, prev); e.target.value = Math.round(d0.s * 100); lxBusyOn(); lxPaintAll(); lxSend(false); };
  $('lxHide').onchange = e => lxChange(d => { d.hide = e.target.checked; });
  $('lxText').oninput = e => lxChange(d => { d.text = e.target.value; });
  $('lxK').oninput = e => { LAY.k = Number(e.target.value) / 100; lxBusyOn(); lxPaintAll(); lxSend(false); };
  document.querySelectorAll('.lxnudge .pill').forEach(b => b.onclick = () => {
    const [x, y] = b.dataset.n.split(',').map(Number); lxChange(d => { d.dx = (d.dx || 0) + x * 2; d.dy = (d.dy || 0) + y * 2; lxFitPos(lxSel); });
  });
  $('lxReset').onclick = () => {
    if (!lxSel) return;
    if (/^x\d+$/.test(lxSel)) { const d = lxGet(lxSel); const h = LX.homePos(d.type); lxChange(() => { d.dx = h.dx; d.dy = h.dy; d.s = 1; }); return; }
    delete LAY.els[lxSel]; lxBusyOn(); lxPaintAll(); lxSend(true);
  };
  $('lxDel').onclick = () => { LAY.extras = (LAY.extras || []).filter(x => x.id !== lxSel); lxSel = null; lxBusyOn(); lxPaintAll(); lxSend(true); };
  window.addEventListener('keydown', e => {
    if (cur !== 'pLayout' || !lxSel || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) return;
    const m = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!m) return;
    e.preventDefault(); const st = e.shiftKey ? 10 : 1;
    lxChange(d => { d.dx = (d.dx || 0) + m[0] * st; d.dy = (d.dy || 0) + m[1] * st; lxFitPos(lxSel); });
  });
  LX.EXTRA_TYPES.forEach(t => {
    const b = document.createElement('button'); b.className = 'pill'; b.dataset.t = t.type; b.textContent = '+ ' + t.label;
    b.onclick = () => {
      if ((LAY.extras || []).length >= LX.EXTRAS_MAX) return;
      if (t.type !== 'text' && (LAY.extras || []).some(x => x.type === t.type)) return;   // العنصر ده مضاف بالفعل (غير النص): مفيش نسخ فوق بعض
      $('lxAddFold').classList.remove('open'); $('lxPlus').setAttribute('aria-expanded', 'false');
      const used = new Set((LAY.extras || []).map(x => x.id)); let id;
      do { id = 'x' + (Math.floor(Math.random() * 9e8) + 1e8); } while (used.has(id));
      (LAY.extras = LAY.extras || []).push({ id, type: t.type, ...(t.type === 'prayer' ? LX.homePos('prayer') : { dx: 0, dy: 120 + 26 * (LAY.extras || []).filter(x => x.type === t.type).length }), s: 1, ...(t.type === 'text' ? { text: 'نص من عندك' } : {}) });
      lxSel = id; lxBusyOn(); lxPaintAll(); lxSend(true);
    };
    $('lxAdd').appendChild(b);
  });
  $('lxPlus').onclick = () => { const o = !$('lxAddFold').classList.contains('open'); $('lxAddFold').classList.toggle('open', o); $('lxPlus').setAttribute('aria-expanded', String(o)); };
  $('lxOpenView').onclick = () => go('pView');
  $('lxResetAll').onclick = () => {
    const b = $('lxResetAll');
    if (b.classList.contains('confirm')) { b.classList.remove('confirm'); b.textContent = 'إعادة ضبط المسبحة'; LAY = lxClone(null); lxSel = null; lxBusyOn(); lxPaintAll(); lxSend(true); }
    else { b.classList.add('confirm'); b.textContent = 'تأكيد؟'; setTimeout(() => { b.classList.remove('confirm'); b.textContent = 'إعادة ضبط المسبحة'; }, 2500); }
  };
  setInterval(() => { if (cur === 'pLayout' && S && !lxDrag) LX.renderExtras($('pvX'), LAY, S); }, 15000);

  // ───── ما الجديد: مرة واحدة بعد التحديث (الـ main بيقرر، ومش بيرجّعها تاني بعد كده) ─────
  const wn = $('wn');
  function wnClose() {
    if (wn.hidden) return;
    wn.classList.add('out'); wn.classList.remove('on');
    setTimeout(() => { wn.hidden = true; wn.classList.remove('out'); }, 350);
    window.removeEventListener('keydown', wnKey, true);
  }
  function wnKey(e) { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); wnClose(); } }
  $('wnSkip').onclick = wnClose;
  try {
    window.azkar.whatsNew().then(w => {
      if (!w || !Array.isArray(w.items) || !w.items.length) return;
      const ul = $('wnList'); ul.textContent = '';
      w.items.forEach((t, i) => { const li = document.createElement('li'); li.style.setProperty('--i', i); li.textContent = t; ul.appendChild(li); });
      $('wnVer').textContent = 'v' + w.ver;
      wn.hidden = false;
      window.addEventListener('keydown', wnKey, true);
      requestAnimationFrame(() => requestAnimationFrame(() => { wn.classList.add('on'); $('wnSkip').focus(); }));
    }).catch(() => {});
  } catch (_) {}

  window.azkar.onState(render);
  window.azkar.onStats(renderStats);
  window.azkar.onSettingsFocus(focusTarget);
  window.azkar.getState().then(s => { A = s.audio || {}; render(s); focusTarget(location.hash.slice(1)); });
  window.azkar.getStats().then(renderStats);
})();

  // ───── صفحة "الوضع المصغر والإنبثاق": كل مجموعة مقفولة وجنبها سهم، بالضغط عليه بتفتح إعداداتها ─────
  try {
    document.querySelectorAll('#pView > .grp').forEach(g => {
      const h = g.querySelector(':scope > .grp-h');
      if (!h || g.classList.contains('acc-g')) return;
      const fold = document.createElement('div'), inn = document.createElement('div');
      fold.className = 'fold'; inn.className = 'fold-in';
      [...g.children].filter(c => c !== h).forEach(c => inn.appendChild(c));
      fold.appendChild(inn); g.appendChild(fold);
      g.classList.add('acc-g'); h.classList.add('acc-h');
      const t = document.createElement('span'); t.className = 'acc-t'; while (h.firstChild) t.appendChild(h.firstChild); h.appendChild(t);   // العنوان في عنصر لوحده علشان السهم ياخد الجنب التاني
      h.setAttribute('role', 'button'); h.tabIndex = 0; h.setAttribute('aria-expanded', 'false');
      h.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>');
      const tgl = () => { const o = fold.classList.toggle('open'); g.classList.toggle('open', o); h.setAttribute('aria-expanded', String(o)); };
      h.onclick = tgl;
      h.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tgl(); } };
    });
  } catch (err) { console.error('acc:', err); }
