/* Sanier Fix — "So arbeiten wir": rail draws with scroll, the step in view lights up, counter follows */
(() => {
  'use strict';
  const html = document.documentElement;
  function init() {
    const wrap = document.querySelector('[data-hw]');
    if (!wrap) return;
    const steps = Array.from(wrap.querySelectorAll('[data-hw-step]'));
    const rail = wrap.querySelector('[data-hw-rail]');
    const now = document.querySelector('[data-hw-now]');
    const bar = document.querySelector('[data-hw-bar]');
    const set = (i) => {
      steps.forEach((s, k) => s.classList.toggle('is-on', k <= i));
      if (now) now.textContent = String(Math.max(0, i) + 1).padStart(2, '0');
      if (bar) bar.style.width = ((Math.max(0, i) + 1) / steps.length * 100) + '%';
    };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !window.gsap || !window.ScrollTrigger) {
      wrap.closest('.hw').classList.add('is-static'); set(steps.length - 1); if (rail) rail.style.transform = 'none'; return;
    }
    gsap.registerPlugin(ScrollTrigger);
    gsap.fromTo(rail, { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: wrap, start: 'top 60%', end: 'bottom 60%', scrub: 0.5, invalidateOnRefresh: true } });
    set(-1);
    steps.forEach((s, i) => ScrollTrigger.create({ trigger: s, start: 'top 62%', onEnter: () => set(i), onLeaveBack: () => set(i - 1) }));
    ScrollTrigger.refresh();
  }
  const start = () => {
    if (html.classList.contains('is-loaded')) return setTimeout(init, 300);
    const mo = new MutationObserver(() => { if (html.classList.contains('is-loaded')) { mo.disconnect(); setTimeout(init, 300); } });
    mo.observe(html, { attributes: true, attributeFilter: ['class'] });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
