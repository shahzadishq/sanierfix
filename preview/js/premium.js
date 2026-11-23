/* Sanier Fix — premium motion layer (GSAP + ScrollTrigger, native scrolling, no video) */
(() => {
  'use strict';
  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  // If GSAP is unavailable, show everything instead of leaving content hidden.
  if (!window.gsap || !window.ScrollTrigger) return;   // film.js already restores the static page
  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: 'power3.out' });

  // ---------- Split text into masked words (keeps <em> styling) ----------
  const splitWords = (el) => {
    const walk = (node) => {
      Array.from(node.childNodes).forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span'); w.className = 'w';
            const i = document.createElement('span'); i.className = 'wi'; i.textContent = part;
            w.appendChild(i); frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    walk(el);
    $$('.w', el).forEach((w) => w.setAttribute('aria-hidden', 'true'));
    return $$('.wi', el);
  };

  const splits = new Map();
  $$('[data-split]').filter((el) => !el.closest('.film')).forEach((el) => splits.set(el, splitWords(el)));
  const statement = $('.statement__text');
  const stmtWords = statement ? splitWords(statement) : [];

  if (reduce) return initStatic();

  // ---------- Generic reveals ----------
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 88%', once: true,
    onEnter: (els) => gsap.to(els, { opacity: 1, x: 0, y: 0, scale: 1, duration: 1.2, stagger: .12, ease: 'power3.out', overwrite: true }),
  });
  splits.forEach((words, el) => {
    if (el.matches('[data-hero-title]')) return;
    ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => gsap.to(words, { y: 0, duration: 1.1, stagger: .06, ease: 'power4.out' }) });
  });

  // ---------- Statement: words light up with scroll ----------
  if (stmtWords.length) gsap.to(stmtWords, { opacity: 1, ease: 'none', stagger: .6, scrollTrigger: { trigger: statement, start: 'top 80%', end: 'bottom 45%', scrub: .6 } });

  // ---------- Counters ----------
  $$('[data-count]').forEach((el) => {
    const end = parseFloat(el.dataset.count), dec = parseInt(el.dataset.decimals || '0', 10), o = { v: 0 };
    ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => gsap.to(o, { v: end, duration: 2.2, ease: 'power3.out', onUpdate: () => { el.textContent = o.v.toFixed(dec); } }) });
    el.textContent = (0).toFixed(dec);
  });

  // ---------- Team band: clip-grow + inner parallax ----------
  const band = $('[data-band]');
  if (band) {
    gsap.fromTo(band, { clipPath: 'inset(0% 8% round 32px)' }, { clipPath: 'inset(0% 0% round 32px)', ease: 'none', scrollTrigger: { trigger: band, start: 'top 95%', end: 'top 25%', scrub: true } });
    gsap.fromTo('[data-band-img]', { yPercent: -8, scale: 1.08 }, { yPercent: 8, scale: 1, ease: 'none', scrollTrigger: { trigger: band, start: 'top bottom', end: 'bottom top', scrub: true } });
  }

  // ---------- Parallax images ----------
  $$('[data-parallax]').forEach((img) => gsap.fromTo(img, { yPercent: -7 }, { yPercent: 7, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } }));
  $$('[data-clip]').forEach((el) => gsap.fromTo(el, { clipPath: 'inset(10% 6% round 32px)' }, { clipPath: 'inset(0% 0% round 32px)', ease: 'none', scrollTrigger: { trigger: el, start: 'top 95%', end: 'top 35%', scrub: true } }));

  // ---------- Feature cards: stagger in + 3D tilt ----------
  $$('.fcard').forEach((c) => {
    if (!finePointer) return;
    const rx = gsap.quickTo(c, 'rotationX', { duration: .6 }), ry = gsap.quickTo(c, 'rotationY', { duration: .6 });
    c.addEventListener('pointermove', (e) => { const r = c.getBoundingClientRect(); ry(((e.clientX - r.left) / r.width - .5) * 7); rx(((e.clientY - r.top) / r.height - .5) * -7); });
    c.addEventListener('pointerleave', () => { rx(0); ry(0); });
  });

  // ---------- Services: tiles get their hover image from data-img ----------
  $$('.service').forEach((s) => { s.style.setProperty('--img', `url("${s.dataset.img}")`); });
  ScrollTrigger.batch('.service', { start: 'top 92%', once: true, onEnter: (els) => gsap.from(els, { opacity: 0, y: 50, scale: .94, duration: 1, stagger: .07, ease: 'power3.out' }) });

  // ---------- Compare slider ----------
  const cmp = $('[data-compare]');
  if (cmp) {
    const range = $('[data-compare-range]', cmp);
    const set = (v) => cmp.style.setProperty('--pos', v + '%');
    range.addEventListener('input', () => set(range.value));
    ScrollTrigger.create({ trigger: cmp, start: 'top 70%', once: true, onEnter: () => { const o = { v: 50 }; gsap.timeline().to(o, { v: 22, duration: 1, ease: 'power2.inOut', onUpdate: () => set(o.v) }).to(o, { v: 78, duration: 1.4, ease: 'power2.inOut', onUpdate: () => set(o.v) }).to(o, { v: 50, duration: 1, ease: 'power2.inOut', onUpdate: () => { set(o.v); range.value = o.v; } }); } });
  }

  // ---------- Process: drawn line + active steps ----------
  const line = $('[data-steps-line]'), stepsEl = $('[data-steps]');
  if (line && stepsEl) {
    gsap.fromTo(line, { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: stepsEl, start: 'top 55%', end: 'bottom 65%', scrub: .5, invalidateOnRefresh: true } });
    $$('[data-step]').forEach((s) => ScrollTrigger.create({ trigger: s, start: 'top 58%', onEnter: () => s.classList.add('is-active'), onLeaveBack: () => s.classList.remove('is-active') }));
  }

  // ---------- Contact + footer ----------
  gsap.fromTo('.contact__bg img', { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: '.contact', start: 'top bottom', end: 'bottom top', scrub: true } });

  // ---------- Magnetic buttons ----------
  if (finePointer) $$('[data-magnetic]').forEach((b) => {
    const qx = gsap.quickTo(b, 'x', { duration: .5, ease: 'power3' }), qy = gsap.quickTo(b, 'y', { duration: .5, ease: 'power3' });
    b.addEventListener('pointermove', (e) => { const r = b.getBoundingClientRect(); qx((e.clientX - r.left - r.width / 2) * .25); qy((e.clientY - r.top - r.height / 2) * .35); });
    b.addEventListener('pointerleave', () => { qx(0); qy(0); });
  });

  // Keep the CSS marquee speed in step with scroll velocity
  const track2 = $('[data-marquee]');
  if (track2) {
    const anim = track2.getAnimations()[0];
    if (anim) ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (s) => { const v = Math.min(5, 1 + Math.abs(s.getVelocity()) / 700); gsap.to(anim, { playbackRate: v, duration: .3, overwrite: true, onComplete: () => gsap.to(anim, { playbackRate: 1, duration: 1.2 }) }); } });
  }

  initCommon();
  addEventListener('load', () => ScrollTrigger.refresh());

  // =========================================================================
  function initStatic() {
    // Reduced motion: everything visible, native behaviour only
    $$('[data-count]').forEach((el) => { el.textContent = parseFloat(el.dataset.count).toFixed(parseInt(el.dataset.decimals || '0', 10)); });
    const cmp = $('[data-compare]'); if (cmp) $('[data-compare-range]', cmp).addEventListener('input', (e) => cmp.style.setProperty('--pos', e.target.value + '%'));
    $$('[data-step]').forEach((s) => s.classList.add('is-active'));
    initCommon();
  }

  function initCommon() {
    const y = $('[data-year]'); if (y) y.textContent = new Date().getFullYear();
    const form = $('[data-form]'), status = $('[data-form-status]');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      let ok = true;
      $$('.field', form).forEach((f) => {
        const input = $('input, textarea', f); if (!input.required) return;
        const valid = input.checkValidity() && input.value.trim() !== '';
        f.classList.toggle('is-invalid', !valid); if (!valid) ok = false;
      });
      if (!ok) { status.textContent = 'Bitte füllen Sie die markierten Felder aus.'; return; }
      const data = new FormData(form), endpoint = form.dataset.endpoint;
      if (endpoint) {
        status.textContent = 'Wird gesendet…';
        try {
          const res = await fetch(endpoint, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
          if (!res.ok) throw new Error(res.statusText);
          form.reset(); status.textContent = 'Vielen Dank! Wir melden uns schnellstmöglich bei Ihnen.';
        } catch (err) { status.textContent = 'Leider ist ein Fehler aufgetreten. Bitte schreiben Sie an info@sanier-fix.com.'; }
        return;
      }
      const subject = encodeURIComponent(`Projektanfrage – ${data.get('type')}`);
      const body = encodeURIComponent(`Name: ${data.get('name')}\nE-Mail: ${data.get('email')}\nTelefon: ${data.get('phone') || '-'}\nProjekt: ${data.get('type')}\n\n${data.get('message')}`);
      window.location.href = `mailto:info@sanier-fix.com?subject=${subject}&body=${body}`;
      status.textContent = 'Ihr E-Mail-Programm wird geöffnet…';
    });
  }
})();
