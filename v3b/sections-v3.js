/* ==========================================================================
   Sanier Fix — V3 sections (AI studio design)
   Called from main-v3.js once the hero film is built:  SFSections.init({ splitWords, reduceMotion })
   ========================================================================== */
(() => {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;

  function init({ splitWords, reduceMotion }) {
    const root = $('[data-x]');
    if (!root) return;
    const RM = !!reduceMotion;

    /* ---------- before / after: pinned AI scan (created first: later triggers must see its pin spacing) ---------- */
    const ba = $('[data-ba]');
    if (ba) {
      const bar = $('[data-ba-bar]');
      const range = $('[data-ba-range]');
      const notes = $$('.ba__notes li', ba);
      // p = position of the scan line (100 = right edge … 0 = left edge). Left of it: Vorher, right of it: Nachher.
      const setP = (p) => {
        ba.style.setProperty('--p', p + '%');
        if (bar) bar.style.transform = `scaleX(${(100 - p) / 100})`;
        notes.forEach((n) => n.classList.toggle('is-on', p <= Number(n.dataset.at)));
      };
      range.addEventListener('input', () => setP(Number(range.value)));
      if (RM) {
        setP(50); range.value = 50; ba.classList.add('is-free');
      } else {
        const o = { p: 100 };
        setP(100); range.value = 100;
        gsap.timeline({
          scrollTrigger: {
            trigger: '[data-x-ba]', start: 'top top', end: () => '+=' + Math.round(innerHeight * 1.5),
            pin: true, scrub: 0.8, invalidateOnRefresh: true,
            onUpdate: (self) => { const free = self.progress > 0.985; ba.classList.toggle('is-free', free); },
          },
        })
          .fromTo(ba, { scale: 0.86, rotateX: 10, transformPerspective: 1400 }, { scale: 1, rotateX: 0, duration: 0.25, ease: 'power2.out' }, 0)
          .to(o, { p: 0, duration: 1, ease: 'none', onUpdate: () => { setP(o.p); range.value = o.p; } }, 0.15)
          .to({}, { duration: 0.12 });
      }
    }

    /* ---------- generic reveals & split titles ---------- */
    $$('[data-x-split]').forEach((el) => {
      const words = splitWords(el);
      if (RM) return;
      gsap.from(words, {
        yPercent: 118, rotate: 4, duration: 1.25, stagger: 0.06, ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 86%', once: true },
      });
    });
    if (!RM) {
      ScrollTrigger.batch('.v3 [data-x-reveal]', {
        start: 'top 90%', once: true,
        onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1.1, stagger: 0.08, ease: 'power3.out', overwrite: true }),
      });
    }

    /* ---------- manifest: words light up as you read ---------- */
    const manifest = $('[data-x-manifest]');
    if (manifest) {
      const words = splitWords(manifest);
      if (!RM) {
        gsap.fromTo(words, { opacity: 0.14 }, {
          opacity: 1, stagger: 0.12, ease: 'none',
          scrollTrigger: { trigger: manifest, start: 'top 78%', end: 'bottom 48%', scrub: 0.6 },
        });
      }
    }

    /* ---------- über uns: collage reveal, parallax, badges, checks ---------- */
    const collage = $('[data-x-collage]');
    if (collage) {
      const figs = $$('.x-collage__img', collage);
      const checks = $$('[data-x-checks] li');
      if (RM) { checks.forEach((li) => li.classList.add('is-on')); } else {
        gsap.fromTo(figs, { clipPath: 'inset(100% 0% 0% 0% round 14px)' }, {
          clipPath: 'inset(0% 0% 0% 0% round 14px)', duration: 1.5, stagger: 0.18, ease: 'expo.out',
          scrollTrigger: { trigger: collage, start: 'top 78%', once: true },
        });
        figs.forEach((f) => {
          gsap.fromTo($('img', f), { scale: 1.3 }, { scale: 1.12, duration: 1.8, ease: 'expo.out', scrollTrigger: { trigger: collage, start: 'top 78%', once: true } });
          gsap.fromTo(f, { y: () => -Number(f.dataset.xSpeed) * 4 }, {
            y: () => Number(f.dataset.xSpeed) * 4, ease: 'none',
            scrollTrigger: { trigger: collage, start: 'top bottom', end: 'bottom top', scrub: true },
          });
        });
        gsap.from('[data-x-badge]', {
          opacity: 0, scale: 0.6, y: 30, duration: 1, stagger: 0.2, ease: 'back.out(2)',
          scrollTrigger: { trigger: collage, start: 'top 60%', once: true },
        });
        gsap.to('[data-x-badge]', { y: -10, duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: 0.8, delay: 1.5 });
        gsap.from(checks, {
          opacity: 0, x: -24, duration: 0.8, stagger: 0.15, ease: 'power3.out',
          scrollTrigger: { trigger: '[data-x-checks]', start: 'top 85%', once: true },
          onStart: () => checks.forEach((li, i) => setTimeout(() => li.classList.add('is-on'), 450 + i * 180)),
        });
        $$('[data-x-checks] path').forEach((p) => gsap.fromTo(p, { strokeDashoffset: 16 }, { strokeDashoffset: 0, duration: 0.6, ease: 'power2.out', scrollTrigger: { trigger: p, start: 'top 85%', once: true }, delay: 0.5 }));
      }
    }

    /* ---------- counters ---------- */
    $$('[data-x-count]').forEach((n) => {
      const end = parseFloat(n.dataset.xCount);
      const dec = Number(n.dataset.xDec || 0);
      if (RM) return;
      const o = { v: 0 };
      n.textContent = (0).toFixed(dec);
      gsap.to(o, {
        v: end, duration: 2.2, ease: 'power3.out',
        scrollTrigger: { trigger: n, start: 'top 92%', once: true },
        onUpdate: () => { n.textContent = o.v.toFixed(dec); },
      });
    });

    /* ---------- bento: 3D entrance, tilt + spotlight ---------- */
    const cards = $$('[data-x-card]');
    if (!RM) {
      gsap.from(cards, {
        opacity: 0, y: 70, rotateX: 14, transformOrigin: '50% 100%', duration: 1.2, stagger: 0.09, ease: 'expo.out',
        scrollTrigger: { trigger: '.bento', start: 'top 82%', once: true },
      });
      gsap.to('.stars i', {
        scale: 1, duration: 0.6, stagger: 0.09, ease: 'back.out(3)',
        scrollTrigger: { trigger: '.b--rating', start: 'top 85%', once: true },
      });
    } else {
      gsap.set('.stars i', { scale: 1 });
    }
    if (canHover && !RM) {
      cards.forEach((card) => {
        const rx = gsap.quickTo(card, 'rotateX', { duration: 0.6, ease: 'power3' });
        const ry = gsap.quickTo(card, 'rotateY', { duration: 0.6, ease: 'power3' });
        card.addEventListener('pointermove', (e) => {
          const r = card.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
          card.style.setProperty('--mx', px * 100 + '%');
          card.style.setProperty('--my', py * 100 + '%');
          ry((px - 0.5) * 8); rx((0.5 - py) * 8);
        });
        card.addEventListener('pointerleave', () => { rx(0); ry(0); });
      });
    }

    /* ---------- services: cards stack and recede ---------- */
    const scards = $$('.scard');
    if (!RM) {
      scards.forEach((card, i) => {
        const next = scards[i + 1];
        if (!next) return;
        gsap.to(card, {
          scale: 0.9 + i * 0.008, filter: 'brightness(0.45) saturate(0.8)', ease: 'none',
          scrollTrigger: { trigger: next, start: () => `top ${120 + i * 18 + card.offsetHeight * 0.92}px`, end: () => `top ${120 + (i + 1) * 18 + 10}px`, scrub: true, invalidateOnRefresh: true },
        });
      });
      scards.forEach((card) => {
        const img = $('img', card);
        gsap.fromTo(img, { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: true } });
      });
    }

    /* ---------- process: the path draws itself, steps light up ---------- */
    const pathWrap = $('[data-x-path]');
    if (pathWrap) {
      const line = $('[data-x-path-line]');
      const steps = $$('[data-x-step]', pathWrap);
      const len = line.getTotalLength ? line.getTotalLength() : 1200;
      line.style.strokeDasharray = len;
      line.style.strokeDashoffset = RM ? 0 : len;
      const light = (p) => steps.forEach((s, i) => s.classList.toggle('is-on', p >= (i + 0.15) / steps.length));
      if (RM) { light(1); } else {
        gsap.to(line, {
          strokeDashoffset: 0, ease: 'none',
          scrollTrigger: { trigger: pathWrap, start: 'top 75%', end: 'bottom 55%', scrub: 0.6, onUpdate: (self) => light(self.progress) },
        });
        gsap.from(steps, {
          opacity: 0, y: 40, stagger: 0.12, duration: 1, ease: 'power3.out',
          scrollTrigger: { trigger: pathWrap, start: 'top 80%', once: true },
        });
        // mobile: light steps as each enters
        if (innerWidth <= 860) steps.forEach((s) => ScrollTrigger.create({ trigger: s, start: 'top 70%', onEnter: () => s.classList.add('is-on'), onLeaveBack: () => s.classList.remove('is-on') }));
      }
    }

    /* ---------- gallery: endless rows that react to scroll speed ---------- */
    const rows = $$('[data-x-row]');
    const loops = rows.map((row) => {
      const track = $('.row__track', row);
      Array.from(track.children).forEach((c) => track.appendChild(c.cloneNode(true)));
      if (RM) return null;
      const dir = Number(row.dataset.xRow);
      return gsap.fromTo(track, { xPercent: dir > 0 ? 0 : -50 }, { xPercent: dir > 0 ? -50 : 0, duration: 46, ease: 'none', repeat: -1 });
    }).filter(Boolean);
    if (loops.length) {
      ScrollTrigger.create({
        trigger: '[data-x-rows]', start: 'top bottom', end: 'bottom top',
        onUpdate: (self) => {
          const boost = Math.min(5, 1 + Math.abs(self.getVelocity()) / 400);
          loops.forEach((t) => gsap.to(t, { timeScale: boost, duration: 0.2, overwrite: true, onComplete: () => gsap.to(t, { timeScale: 1, duration: 1.2 }) }));
        },
      });
      gsap.fromTo('.row', { rotateX: (i) => (i ? -10 : 12) }, {
        rotateX: 0, ease: 'none',
        scrollTrigger: { trigger: '[data-x-rows]', start: 'top bottom', end: 'center center', scrub: true },
      });
      rows.forEach((row, i) => {
        row.addEventListener('mouseenter', () => gsap.to(loops[i], { timeScale: 0.15, duration: 0.6 }));
        row.addEventListener('mouseleave', () => gsap.to(loops[i], { timeScale: 1, duration: 0.6 }));
      });
    }

    /* ---------- cursor light + magnetic buttons ---------- */
    if (canHover && !RM) {
      const glow = $('[data-x-cursor]');
      const gx = gsap.quickTo(glow, 'x', { duration: 0.8, ease: 'power3' });
      const gy = gsap.quickTo(glow, 'y', { duration: 0.8, ease: 'power3' });
      root.addEventListener('pointermove', (e) => { gx(e.clientX); gy(e.clientY); });
      root.addEventListener('pointerenter', () => root.classList.add('is-pointer'));
      root.addEventListener('pointerleave', () => root.classList.remove('is-pointer'));

      $$('[data-x-magnetic]').forEach((b) => {
        const mx = gsap.quickTo(b, 'x', { duration: 0.5, ease: 'power3' });
        const my = gsap.quickTo(b, 'y', { duration: 0.5, ease: 'power3' });
        b.addEventListener('pointermove', (e) => {
          const r = b.getBoundingClientRect();
          mx((e.clientX - (r.left + r.width / 2)) * 0.18);
          my((e.clientY - (r.top + r.height / 2)) * 0.3);
        });
        b.addEventListener('pointerleave', () => { mx(0); my(0); });
      });
    }

    /* ---------- contact: drifting orb ---------- */
    if (!RM) {
      gsap.to('.x-orb--c', { yPercent: 30, ease: 'none', scrollTrigger: { trigger: '.x-contact', start: 'top bottom', end: 'bottom top', scrub: true } });
    }

    /* ---------- footer: the wordmark fills with light ---------- */
    const word = $('[data-x-word]');
    if (word) {
      if (RM) word.style.backgroundSize = '100% 100%';
      else gsap.fromTo(word, { backgroundSize: '0% 100%' }, {
        backgroundSize: '100% 100%', ease: 'none',
        scrollTrigger: { trigger: word, start: 'top bottom', end: () => ScrollTrigger.maxScroll(window), scrub: 0.6, invalidateOnRefresh: true },
      });
    }
    const y = $('[data-year]');
    if (y) y.textContent = new Date().getFullYear();
  }

  window.SFSections = { init };
})();
