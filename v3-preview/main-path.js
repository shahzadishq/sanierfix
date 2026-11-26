/* Main page preview: the V3 process path draws itself, steps light up */
(() => {
  'use strict';
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function init() {
    const wrap = document.querySelector('[data-pv-path]');
    if (!wrap || !window.gsap || !window.ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);
    const line = wrap.querySelector('[data-pv-path-line]');
    const steps = $$('[data-pv-step]', wrap);
    const len = line.getTotalLength ? line.getTotalLength() : 1200;
    line.style.strokeDasharray = len;
    line.style.strokeDashoffset = reduce ? 0 : len;
    const light = (p) => steps.forEach((s, i) => s.classList.toggle('is-on', p >= (i + 0.15) / steps.length));
    if (reduce) { light(1); return; }
    gsap.to(line, { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: wrap, start: 'top 75%', end: 'bottom 55%', scrub: 0.6, onUpdate: (self) => light(self.progress) } });
    gsap.from(steps, { opacity: 0, y: 40, stagger: 0.12, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: wrap, start: 'top 80%', once: true } });
    if (innerWidth <= 860) steps.forEach((s) => ScrollTrigger.create({ trigger: s, start: 'top 70%', onEnter: () => s.classList.add('is-on'), onLeaveBack: () => s.classList.remove('is-on') }));
    ScrollTrigger.refresh();
  }
  const html = document.documentElement;
  const go = () => setTimeout(init, 300);
  const start = () => {
    if (html.classList.contains('is-loaded')) return go();
    const mo = new MutationObserver(() => { if (html.classList.contains('is-loaded')) { mo.disconnect(); go(); } });
    mo.observe(html, { attributes: true, attributeFilter: ['class'] });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
