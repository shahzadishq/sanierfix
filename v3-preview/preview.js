/* ==========================================================================
   Sanier Fix — V3 PREVIEW: Ablauf-Timeline (Hauptseite) + Anfrage-Funnel
   ========================================================================== */
(() => {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Ablauf: drawn line + active steps (created once the page/film is set up) ---------- */
  function initSteps() {
    const line = $('[data-steps-line]'), stepsEl = $('[data-steps]');
    if (!line || !stepsEl || !window.gsap || !window.ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);
    if (reduce) { gsap.set(line, { scaleY: 1 }); $$('[data-step]').forEach((s) => s.classList.add('is-active')); return; }
    gsap.fromTo(line, { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: stepsEl, start: 'top 55%', end: 'bottom 65%', scrub: 0.5, invalidateOnRefresh: true } });
    $$('[data-step]').forEach((s) => ScrollTrigger.create({ trigger: s, start: 'top 58%', onEnter: () => s.classList.add('is-active'), onLeaveBack: () => s.classList.remove('is-active') }));
    ScrollTrigger.refresh();
  }
  const html = document.documentElement;
  const whenLoaded = () => {
    if (html.classList.contains('is-loaded')) return setTimeout(initSteps, 300);
    const mo = new MutationObserver(() => { if (html.classList.contains('is-loaded')) { mo.disconnect(); setTimeout(initSteps, 300); } });
    mo.observe(html, { attributes: true, attributeFilter: ['class'] });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', whenLoaded); else whenLoaded();

  /* page height changes (images loading, funnel steps) → recalc scroll triggers, so the footer wordmark always fills completely */
  if ('ResizeObserver' in window) {
    let lastH = 0, tid = 0;
    new ResizeObserver(() => {
      const hgt = document.documentElement.scrollHeight;
      if (Math.abs(hgt - lastH) < 2 || !window.ScrollTrigger || !html.classList.contains('is-loaded')) { lastH = hgt; return; }
      lastH = hgt; clearTimeout(tid); tid = setTimeout(() => ScrollTrigger.refresh(), 250);
    }).observe(document.body);
  }

  /* ---------- Anfrage-Funnel (6 Schritte) ---------- */
  const f = $('#funnel');
  if (!f) return;
  const IC = {
    komplett: '<path d="M3 10 12 3l9 7v11H3z"/><path d="M9 21v-6h6v6"/>',
    kern: '<path d="M4 21V9l8-6 8 6v12"/><path d="M4 13h16M9 21v-8M15 21v-8"/>',
    energie: '<path d="M13 2 4 14h7l-1 8 9-12h-7Z"/>',
    teil: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
    bad: '<path d="M4 12h16v3a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M6 12V6a2 2 0 0 1 4 0"/><path d="M7 20l-1 2M17 20l1 2"/>',
    sonst: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5"/><path d="M12 17v.01"/>',
    efh: '<path d="M3 10 12 3l9 7v11H3z"/><path d="M9 21v-6h6v6"/>',
    mfh: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2"/>',
    wohnung: '<path d="M3 21h18"/><rect x="6" y="7" width="12" height="14" rx="1"/><path d="M10 21v-4h4v4M9 11h2M13 11h2"/>',
    gewerbe: '<path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v11h16V9"/><path d="M9 20v-6h6v6"/>',
    asap: '<path d="M13 2 4 14h7l-1 8 9-12h-7Z"/>',
    monate: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    spaeter: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    alt: '<path d="M4 21V10l8-6 8 6v11"/><path d="M9 21v-5h6v5"/><path d="M15 6V3h3v5"/>',
    b50: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M8 14h3"/>',
    b78: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M13 15h3"/>',
    neu: '<path d="M3 10 12 3l9 7v11H3z"/><path d="m9 14 2 2 4-4"/>',
    halb: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none" opacity=".25"/><path d="M12 7v5l3 2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/>',
  };
  const DATA = {
    leistung: [['komplett', 'Komplettsanierung'], ['kern', 'Kernsanierung'], ['energie', 'Energetische Sanierung'], ['teil', 'Teilsanierung'], ['bad', 'Badsanierung'], ['sonst', 'Noch unklar – Beratung gewünscht']],
    objekt: [['efh', 'Einfamilienhaus'], ['mfh', 'Zwei- / Mehrfamilienhaus'], ['wohnung', 'Eigentumswohnung'], ['gewerbe', 'Gewerbeimmobilie'], ['sonst', 'Sonstiges']],
    baujahr: [['alt', 'Vor 1950'], ['b50', '1950 – 1977'], ['b78', '1978 – 1999'], ['neu', 'Ab 2000'], ['sonst', 'Weiß ich nicht']],
    zeitraum: [['asap', 'So schnell wie möglich'], ['monate', 'In den nächsten 1–3 Monaten'], ['halb', 'In 3–6 Monaten'], ['info', 'Später / erst informieren']],
  };
  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4.5 4.5L19 7"/></svg>';
  const esc = (s) => s.replace(/&/g, '&amp;');
  Object.keys(DATA).forEach((k) => {
    const box = $('#o-' + k);
    DATA[k].forEach((o, i) => {
      const d = document.createElement('div');
      d.className = 'opt';
      const id = 'f-' + k + '-' + i;
      d.innerHTML = '<input type="radio" name="' + k + '" id="' + id + '" value="' + o[0] + '" data-text="' + esc(o[1]) + '"><label for="' + id + '"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[o[0]] + '</svg></span><span class="t">' + esc(o[1]) + '</span><span class="ck">' + CHECK + '</span></label>';
      box.appendChild(d);
    });
  });

  const fs = $$('.fs', f), N = fs.length, err = $('#ferr'), back = $('#back'), next = $('#next');
  let cur = 0;
  const checked = (st) => st.querySelector('input[type=radio]:checked');
  function showStep(focus) {
    fs.forEach((s, i) => { s.hidden = i !== cur; });
    const p = cur / N;
    $('#rail').style.width = (p * 100) + '%';
    $('#spct').innerHTML = Math.round(p * 100) + '&nbsp;%';
    const trackW = $('.track').clientWidth - 40;
    $('#dig').style.left = Math.max(0, p * trackW) + 'px';
    $('#slabel').textContent = 'Schritt ' + (cur + 1) + ' von ' + N;
    back.hidden = cur === 0;
    $('span', next).textContent = cur === N - 1 ? 'Anfrage senden' : 'Weiter';
    err.hidden = true;
    if (focus) {
      const q = $('.fq', fs[cur]);
      if (q) q.focus({ preventScroll: true });
      const c = $('#fcard'), top = c.getBoundingClientRect().top;
      if (top < 0 || top > innerHeight * 0.5) c.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
  }
  function fail(msg, el) { err.textContent = msg; err.hidden = false; if (el) { el.setAttribute('aria-invalid', 'true'); el.focus(); } }
  function valid() {
    const st = fs[cur], key = st.getAttribute('data-key');
    if (['leistung', 'objekt', 'baujahr', 'zeitraum'].includes(key) && !checked(st)) { fail('Bitte wählen Sie eine Antwort aus.'); return false; }
    if (key === 'flaeche') { const fl = $('#f-flaeche'), v = parseFloat(String(fl.value).replace(',', '.')); if (!(v > 0)) { fail('Bitte geben Sie die ungefähre Größe in m² an.', fl); return false; } }
    if (key === 'kontakt') {
      const n = $('#f-name'), m = $('#f-mail'), t = $('#f-msg'), ok = $('#f-ok');
      if (n.value.trim().length < 2) { fail('Bitte geben Sie Ihren Namen an.', n); return false; }
      const o = $('#f-ort'); if (o.value.trim().length < 3) { fail('Bitte geben Sie PLZ und Ort des Objekts an.', o); return false; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.value.trim())) { fail('Bitte geben Sie eine gültige E-Mail-Adresse an.', m); return false; }
      if (!ok.checked) { fail('Bitte stimmen Sie der Verarbeitung Ihrer Angaben zu.', ok); return false; }
    }
    return true;
  }
  // choosing an answer moves on by itself
  f.addEventListener('change', (e) => {
    const t = e.target;
    if (t.type !== 'radio') return;
    err.hidden = true;
    const st = fs[cur];
    if (st.contains(t) && cur < N - 1) setTimeout(() => { if (fs[cur] === st && checked(st)) { cur++; showStep(true); } }, 350);
  });
  f.addEventListener('input', (e) => { e.target.removeAttribute('aria-invalid'); });
  back.addEventListener('click', () => { if (cur > 0) { cur--; showStep(true); } });
  f.addEventListener('submit', (e) => { e.preventDefault(); if (!valid()) return; if (cur < N - 1) { cur++; showStep(true); } else send(); });

  function send() {
    const v = f.elements;
    if (v.website.value.trim()) return;
    const d = {};
    fs.forEach((s) => { const r = checked(s); if (r) d[s.getAttribute('data-key')] = r.getAttribute('data-text'); });
    const body = [
      'Name: ' + v.name.value.trim(), 'E-Mail: ' + v.email.value.trim(), 'Telefon: ' + (v.telefon.value.trim() || 'Nicht angegeben'),
      'Sanierung: ' + (d.leistung || '-'), 'Objekt: ' + (d.objekt || '-'), 'Baujahr: ' + (d.baujahr || '-'), 'Wohnfläche: ' + (v.flaeche.value.trim() ? v.flaeche.value.trim() + ' m²' : '-'),
      'Start: ' + (d.zeitraum || '-'), 'Objekt in: ' + v.ort.value.trim(), '', 'Vorhaben:', v.nachricht.value.trim() || '-',
    ].join('\n');
    const first = v.name.value.trim().split(' ')[0];
    if (first) $('#done-t').textContent = 'Vielen Dank, ' + first + '!';
    $('#fcard').classList.add('is-done');
    const dn = $('#done'); dn.hidden = false; dn.focus({ preventScroll: true });
    location.href = 'mailto:info@sanier-fix.com?subject=' + encodeURIComponent('Projektanfrage – ' + (d.leistung || 'Sanierung')) + '&body=' + encodeURIComponent(body);
  }
  showStep(false);
  addEventListener('resize', () => showStep(false));
})();
