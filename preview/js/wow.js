/* Sanier Fix — wow layer (cursor, spotlight, outline marquee, orbs, progress, footer letters) */
(() => {
'use strict';
if (!window.gsap || !window.ScrollTrigger) return;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const root = document.documentElement;
gsap.registerPlugin(ScrollTrigger);

/* ---- ambient orbs + grain on dark sections ---- */
['.bigtype', '.why', '.contact', '.footer'].forEach((sel) => {
  const el = $(sel); if (!el) return;
  const a = document.createElement('i'); a.className = 'orb orb--a'; a.setAttribute('aria-hidden', 'true');
  const b = document.createElement('i'); b.className = 'orb orb--b'; b.setAttribute('aria-hidden', 'true');
  const g = document.createElement('i'); g.className = 'grain'; g.setAttribute('aria-hidden', 'true');
  el.prepend(g, b, a);
  if (!reduce) {
    gsap.fromTo(a, { yPercent: -18 }, { yPercent: 18, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.fromTo(b, { yPercent: 18 }, { yPercent: -18, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
  }
});

/* ---- big outline type ---- */
const words = ['Sanieren', 'Renovieren', 'Modernisieren', 'Energie sparen', 'Wohnen'];
$$('[data-bt]').forEach((row) => {
  const dir = parseFloat(row.dataset.bt);
  const seq = (dir < 0 ? words : words.slice().reverse());
  const html = seq.map((w, i) => (i % 2 && dir > 0 ? `<em>${w}</em>` : `<span>${w}</span>`) + '<b>✦</b>').join('');
  row.innerHTML = html + html;
  if (reduce) return;
  gsap.fromTo(row, { xPercent: dir < 0 ? 0 : -50 }, {
    xPercent: dir < 0 ? -50 : 0, ease: 'none',
    scrollTrigger: { trigger: '.bigtype', start: 'top bottom', end: 'bottom top', scrub: 0.8 },
  });
});

/* ---- spotlight on cards ---- */
$$('.fcard, .reason, .step, .form').forEach((el) => {
  const s = document.createElement('i'); s.className = 'spot'; s.setAttribute('aria-hidden', 'true'); el.appendChild(s);
  if (!fine) return;
  el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); el.style.setProperty('--mx', (e.clientX - r.left) + 'px'); el.style.setProperty('--my', (e.clientY - r.top) + 'px'); });
});
const contact = $('.contact');
if (contact && fine) {
  const g = document.createElement('i'); g.className = 'contact__glow'; g.setAttribute('aria-hidden', 'true'); contact.prepend(g);
  contact.addEventListener('pointermove', (e) => { const r = contact.getBoundingClientRect(); g.style.setProperty('--mx', (e.clientX - r.left) + 'px'); g.style.setProperty('--my', (e.clientY - r.top) + 'px'); });
}

/* ---- progress bar + back to top ---- */
const bar = document.createElement('div'); bar.className = 'wprog'; bar.setAttribute('aria-hidden', 'true');
const top = document.createElement('button'); top.className = 'totop'; top.type = 'button'; top.setAttribute('aria-label', 'Nach oben');
top.innerHTML = '<svg viewBox="0 0 60 60" aria-hidden="true"><circle class="t" cx="30" cy="30" r="27"/><circle class="r" cx="30" cy="30" r="27" pathLength="1"/></svg><b aria-hidden="true">↑</b>';
document.body.append(bar, top);
const after = $('#ueber-uns');
ScrollTrigger.create({
  start: 0, end: 'max',
  onUpdate: (s) => {
    bar.style.transform = `scaleX(${s.progress})`;
    top.style.setProperty('--sp', s.progress);
    top.classList.toggle('is-on', !!after && scrollY > after.offsetTop - innerHeight * 0.4);
  },
});
top.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }));

/* ---- custom cursor ---- */
if (fine && !reduce) {
  const cur = document.createElement('div'); cur.className = 'cur'; cur.setAttribute('aria-hidden', 'true');
  cur.innerHTML = '<div class="cur__ring"><span></span></div><div class="cur__dot"></div>';
  document.body.appendChild(cur);
  const ring = $('.cur__ring', cur), dot = $('.cur__dot', cur), label = $('span', ring);
  const rx = gsap.quickTo(ring, 'x', { duration: 0.5, ease: 'power3' }), ry = gsap.quickTo(ring, 'y', { duration: 0.5, ease: 'power3' });
  const dx = gsap.quickTo(dot, 'x', { duration: 0.08 }), dy = gsap.quickTo(dot, 'y', { duration: 0.08 });
  addEventListener('pointermove', (e) => { cur.classList.add('is-on'); rx(e.clientX); ry(e.clientY); dx(e.clientX); dy(e.clientY); }, { passive: true });
  document.addEventListener('pointerleave', () => cur.classList.remove('is-on'));
  addEventListener('pointerdown', () => cur.classList.add('is-down'));
  addEventListener('pointerup', () => cur.classList.remove('is-down'));
  const labels = [['.fcard', 'Öffnen'], ['.compare', 'Ziehen'], ['.service', 'Ansehen'], ['.card', 'Ansehen']];
  labels.forEach(([sel, txt]) => $$(sel).forEach((el) => {
    el.addEventListener('pointerenter', () => { label.textContent = txt; cur.classList.add('is-label'); });
    el.addEventListener('pointerleave', () => cur.classList.remove('is-label'));
  }));
  $$('a, button, .chips label, [data-magnetic]').forEach((el) => {
    if (el.closest('.fcard, .service')) return;
    el.addEventListener('pointerenter', () => cur.classList.add('is-link'));
    el.addEventListener('pointerleave', () => cur.classList.remove('is-link'));
  });
}

/* ---- card image parallax-scale on scroll ---- */
if (!reduce) $$('.fcard__media img').forEach((img) => gsap.fromTo(img, { scale: 1.22 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: img, start: 'top bottom', end: 'center 40%', scrub: true } }));

/* ---- footer wordmark: letter by letter ---- */
const word = $('[data-footer-word]');
if (word) {
  const txt = word.textContent; word.textContent = '';
  const letters = Array.from(txt).map((ch) => { const s = document.createElement('span'); s.className = 'fl'; s.textContent = ch === ' ' ? ' ' : ch; word.appendChild(s); return s; });
  if (!reduce) {
    gsap.set(letters, { yPercent: 110, rotate: 6 });
    ScrollTrigger.create({ trigger: word, start: 'top 98%', once: true, onEnter: () => gsap.to(letters, { yPercent: 0, rotate: 0, duration: 1.4, ease: 'power4.out', stagger: 0.07 }) });
    if (fine) letters.forEach((l) => l.addEventListener('pointerenter', () => gsap.fromTo(l, { yPercent: 0 }, { yPercent: -14, duration: 0.3, yoyo: true, repeat: 1, ease: 'power2.out', overwrite: true })));
  }
}

addEventListener('load', () => ScrollTrigger.refresh());
/* keep trigger positions in sync when lazy images / fonts shift the layout */
{
  let lastH = document.documentElement.scrollHeight, t;
  const check = () => { const h = document.documentElement.scrollHeight; if (Math.abs(h - lastH) > 2) { lastH = h; ScrollTrigger.refresh(); } };
  if ('ResizeObserver' in window) new ResizeObserver(() => { clearTimeout(t); t = setTimeout(check, 200); }).observe(document.body);
  document.fonts && document.fonts.ready.then(() => setTimeout(() => ScrollTrigger.refresh(), 100));
}
})();
