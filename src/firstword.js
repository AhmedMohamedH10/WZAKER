/* ──────────────────────────────────────────────────────────────
   WZAKER — أول كلمة من كل نص بالخط الأصلي (Hail Elastic Light-1: الحروف الممدودة)
   وباقي الكلام بالخط العادي (Hail Elastic Plain). بيتطبق تلقائيًا على كل الصفحات،
   وعلى أي نص بيتغيّر لاحقًا (عدّاد، حالة، إعدادات...). مفيش حاجة في الكود التاني بتتغيّر.
   - "النص" = أقرب عنصر مش inline (div / label / button / ...): أول كلمة عربية فيه بتتلف في <span class="fw">.
   - الأرقام والكلمات الإنجليزي والـ input/textarea/SVG بتتسيب زي ما هي.
   - الكلمة بتتقطع عند أول مسافة بس، فاتصال حروف الكلمة الواحدة مش بيتأثر.
   ────────────────────────────────────────────────────────────── */
(() => {
  'use strict';
  // نص القرآن (المصحف / التفسير / البسملة) بيفضل بخط المصحف (UthmanicHafs) بس — من غير أي خلط مع خط التطبيق
  const SKIP = 'script,style,noscript,textarea,input,select,option,svg,canvas,title,head,.fw,[data-nofw],.mpb,.qtext,.bism,.tfq,.msn,.mbi,.qpg';
  const ARABIC = /\p{Script=Arabic}/u;
  // مسافات + رموز لوحدها (• ✓ ...) قبل أول كلمة حقيقية بتفضل زي ما هي
  const LEAD = /^((?:\s*[^\p{L}\p{N}\s]+(?=\s))*\s*)(\S+)/u;
  // كلمات تفضل دايمًا بالخط العادي (Hail Elastic Plain) حتى لو هي أول كلمة في النص
  const PLAIN_WORDS = new Set(['الإجمالي']);
  const bare = w => w.replace(/[^\p{L}\p{M}]/gu, '');   // من غير علامات الترقيم (: ، ...)
  let busy = false;

  function blockOf(node, cache) {
    let el = node.nodeType === 1 ? node : node.parentElement;
    while (el && el !== document.body && el !== document.documentElement) {
      let d = cache.get(el);
      if (d === undefined) { d = getComputedStyle(el).display; cache.set(el, d); }
      if (d !== 'inline' && d !== 'contents') return el;
      el = el.parentElement;
    }
    return document.body;
  }

  function wrapFirst(textNode) {
    const m = LEAD.exec(textNode.nodeValue);
    if (!m || !ARABIC.test(m[2]) || PLAIN_WORDS.has(bare(m[2]))) return;
    const pre = m[1].length, len = m[2].length;
    const wordNode = pre ? textNode.splitText(pre) : textNode;
    if (wordNode.nodeValue.length > len) wordNode.splitText(len);
    const span = document.createElement('span');
    span.className = 'fw';
    wordNode.parentNode.insertBefore(span, wordNode);
    span.appendChild(wordNode);
  }

  function process(root) {
    if (!root || !root.isConnected) return;
    const cache = new Map(), seen = new Set(), todo = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const p = n.parentElement;
      if (!p || !/\p{L}/u.test(n.nodeValue) || p.closest(SKIP)) {
        if (p && p.classList.contains('fw')) seen.add(blockOf(p, cache));   // كلمة اتلفّت قبل كده: النص ده خلص
        continue;
      }
      const b = blockOf(n, cache);
      if (seen.has(b)) continue;
      seen.add(b);                                          // أول نص فيه حروف في البلوك ده
      todo.push(n);
    }
    for (const t of todo) wrapFirst(t);
  }

  const observer = new MutationObserver(records => {
    if (busy) return;
    busy = true;
    observer.disconnect();                                  // تعديلاتنا إحنا ما تعملش loop
    try {
      const cache = new Map(), roots = new Set();
      for (const r of records) {
        const t = r.type === 'characterData' ? r.target.parentElement : r.target;
        if (t && t.nodeType === 1 && !t.closest('.fw')) roots.add(blockOf(t, cache));
        else if (t && t.closest) { const f = t.closest('.fw'); if (f) roots.add(blockOf(f.parentElement || f, cache)); }
      }
      for (const el of roots) process(el);                  // بيشتغل قبل الرسم (microtask): مفيش وميض بالخط التاني
    } finally {
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
      busy = false;
    }
  });

  function start() {
    process(document.body);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
