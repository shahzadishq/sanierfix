/* ==========================================================================
   Sanier Fix — scroll-driven film (step-snapping) + page interactions
   GSAP 3 + ScrollTrigger (vendored in js/vendor)
   ========================================================================== */
(() => {
  'use strict';

  const FRAME_COUNT = 302;              // frames per set in assets/frames/{lg,md,sm}
  const FRAME_PATH = (set, i) => `assets/frames/${set}/${String(i + 1).padStart(4, '0')}.webp`;
  const MAX_PARALLEL = 6;
  const SEG = 10;                       // timeline units per step

  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isNarrow = () => innerWidth <= 860;

  if (!window.gsap || !window.ScrollTrigger) {
    root.classList.remove('js');
    root.classList.add('no-anim');
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  scrollTo(0, 0);
  root.classList.add('is-loading');
  if (reduceMotion) root.classList.add('no-anim');

  /* ---------- Split words into masked spans ---------- */
  function splitWords(el) {
    if (el.dataset.splitDone) return $$('.w__i', el);
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            const i = document.createElement('span');
            w.className = 'w'; i.className = 'w__i'; i.textContent = part;
            w.appendChild(i); frag.appendChild(w);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1) {
          walk(child);
        }
      });
    };
    walk(el);
    el.dataset.splitDone = '1';
    return $$('.w__i', el);
  }

  /* ==========================================================================
     FILM — image-sequence renderer
     ========================================================================== */
  const filmEl = $('.film');
  const stage = $('[data-film]');
  const canvas = $('[data-film-canvas]');
  const ctx = canvas.getContext('2d', { alpha: false });
  const hudBuffer = $('[data-buffer]');
  const hudStep = $('[data-step-num]');
  const rail = $('[data-rail]');
  const progressBar = $('[data-progress]');
  const chapters = $$('[data-chapter]');

  // Rest frames: the film always comes to a stop on a complete scene.
  const STEPS = [0, ...chapters.map((c) => Math.min(FRAME_COUNT - 1, Number(c.dataset.frame)))];
  const STEP_COUNT = STEPS.length - 1;
  $('[data-step-total]').textContent = String(STEP_COUNT).padStart(2, '0');

  const images = new Array(FRAME_COUNT);
  const imageSet = new Array(FRAME_COUNT);
  const loaded = new Uint8Array(FRAME_COUNT);
  const state = { frame: 0 };
  let currentSet = null;
  let loadToken = 0;
  let drawnIndex = -1;
  let drawnSet = null;
  let rafPending = false;
  let forceNext = false;
  let filmST = null;

  function pickSet() {
    const w = innerWidth, h = innerHeight;
    if (h > w * 1.1) return 'sm';          // portrait phones & tablets — native-res 2:3 crop
    return w >= 1000 ? 'lg' : 'md';         // laptops/desktops always get full 1920px frames
  }

  // Rest frames first (so every stop is crisp immediately), then coarse → fine.
  function buildOrder() {
    const order = [], seen = new Uint8Array(FRAME_COUNT);
    const push = (i) => { if (i >= 0 && i < FRAME_COUNT && !seen[i]) { seen[i] = 1; order.push(i); } };
    STEPS.forEach(push);
    [16, 8, 4, 2, 1].forEach((step) => { for (let i = 0; i < FRAME_COUNT; i += step) push(i); });
    return order;
  }

  function loadSet(set, onFirstPass, onProgress) {
    const token = ++loadToken;
    const order = buildOrder();
    const firstPass = STEPS.length + Math.ceil(FRAME_COUNT / 16);
    let cursor = 0, active = 0, done = 0, firstDone = 0, fired = false;

    const pump = () => {
      if (token !== loadToken) return;
      while (active < MAX_PARALLEL && cursor < order.length) {
        const pos = cursor++;
        const i = order[pos];
        const img = new Image();
        img.decoding = 'async';
        img.src = FRAME_PATH(set, i);
        active++;
        const finish = (ok) => {
          active--;
          if (token !== loadToken) return;
          if (ok) { images[i] = img; imageSet[i] = set; loaded[i] = 1; }
          done++;
          if (pos < firstPass) firstDone++;
          if (!fired && firstDone >= Math.min(firstPass, order.length)) { fired = true; onFirstPass && onFirstPass(); }
          onProgress && onProgress(done / order.length, Math.min(1, firstDone / firstPass));
          if (ok && Math.abs(i - state.frame) < 30) requestRender(true);
          pump();
        };
        const decoded = img.decode ? img.decode() : new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
        decoded.then(() => finish(true), () => finish(false));
      }
    };
    pump();
  }

  function nearestLoaded(i) {
    if (loaded[i]) return i;
    for (let d = 1; d < FRAME_COUNT; d++) {
      const a = i - d, b = i + d;
      if (a >= 0 && loaded[a]) return a;
      if (b < FRAME_COUNT && loaded[b]) return b;
    }
    return -1;
  }

  function sizeCanvas() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const r = stage.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width * dpr));
    const h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      drawnIndex = -1;
    }
  }

  function draw(force) {
    rafPending = false;
    const target = Math.round(state.frame);
    const i = nearestLoaded(target);
    if (i < 0) return;
    if (!force && i === drawnIndex && imageSet[i] === drawnSet) return;
    const img = images[i];
    const cw = canvas.width, ch = canvas.height;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const s = Math.max(cw / iw, ch / ih);
    const dw = iw * s, dh = ih * s;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    drawnIndex = i; drawnSet = imageSet[i];
    filmEl.classList.add('is-ready');
  }

  function requestRender(force) {
    if (force) forceNext = true;
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => { const f = forceNext; forceNext = false; draw(f); });
  }

  /* ---------- Chapter rail (clickable) ---------- */
  chapters.forEach((c, n) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = c.dataset.label;
    b.addEventListener('click', () => goToStep(n + 1));
    li.appendChild(b);
    rail.appendChild(li);
  });
  const railItems = $$('li', rail);
  const setProgress = gsap.quickSetter(progressBar, 'scaleX');
  let activeStep = -1;

  function updateHud(progress) {
    setProgress(progress);
    const step = Math.round(progress * STEP_COUNT);
    if (step !== activeStep) {
      activeStep = step;
      hudStep.textContent = String(step).padStart(2, '0');
      railItems.forEach((li, n) => li.classList.toggle('is-active', n + 1 === step));
    }
  }

  function goToStep(n) {
    if (!filmST) return;
    const y = filmST.start + (filmST.end - filmST.start) * (n / STEP_COUNT);
    window.scrollTo({ top: Math.round(y) + 1, behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  /* ---------- Film timeline: one segment per step, snapping between rests ---------- */
  function buildFilm() {
    const introWords = splitWords($('.film__intro .display'));
    const introSide = $$('.film__intro .script, .film__lead, .film__cue');

    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: filmEl,
        start: 'top top',
        end: () => '+=' + Math.round(innerHeight * STEP_COUNT * (isNarrow() ? 0.85 : 1)),
        pin: stage,
        scrub: 0.5,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        snap: {
          snapTo: 1 / STEP_COUNT,   // every rest frame
          directional: true,        // a small scroll moves to the next/previous complete scene
          delay: 0.04,
          duration: { min: 0.45, max: 1.1 },
          ease: 'power2.inOut',
          inertia: false,
        },
        onUpdate: (self) => updateHud(self.progress),
      },
    });
    filmST = tl.scrollTrigger;

    // Frames: each segment plays exactly from one complete scene to the next.
    for (let i = 0; i < STEP_COUNT; i++) {
      tl.to(state, { frame: STEPS[i + 1], duration: SEG, onUpdate: requestRender }, i * SEG);
    }

    // Intro leaves during the first segment
    tl.to(introSide, { autoAlpha: 0, y: -24, duration: 3 }, 0)
      .to(introWords, { yPercent: -115, stagger: 0.3, duration: 3.6, ease: 'power2.in' }, 0.2);

    // Each chapter is fully visible exactly at its rest point (k * SEG)
    chapters.forEach((ch, n) => {
      const k = n + 1;
      const rest = k * SEG;
      const isLast = k === STEP_COUNT;
      const words = splitWords($('.chapter__title', ch));
      const side = $$('.chapter__num, .chapter__body, .chapter__actions', ch);
      const tIn = rest - 4.8;

      tl.fromTo(ch, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, tIn)
        .fromTo(words, { yPercent: 115 }, { yPercent: 0, stagger: 0.25, duration: 3, ease: 'power3.out' }, tIn)
        .fromTo(side, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, stagger: 0.3, duration: 2.4, ease: 'power2.out' }, tIn + 0.8);

      if (!isLast) {
        const tOut = rest + 0.8;
        tl.to(words, { yPercent: -115, stagger: 0.1, duration: 2.2, ease: 'power2.in' }, tOut)
          .to(side, { autoAlpha: 0, y: -16, duration: 1.8, ease: 'power2.in' }, tOut)
          .to(ch, { autoAlpha: 0, duration: 0.3 }, tOut + 2.4);
      }
    });

    tl.set({}, {}, STEP_COUNT * SEG);
    return tl;
  }

  /* ==========================================================================
     Preloader → entrance
     ========================================================================== */
  const loaderCount = $('[data-loader-count]');
  const loaderBar = $('[data-loader-bar]');
  let shown = 0;
  let started = false;

  function setLoader(p) {
    shown = Math.max(shown, Math.round(p * 100));
    loaderCount.textContent = shown;
    loaderBar.style.transform = `scaleX(${shown / 100})`;
  }

  function start() {
    if (started) return;
    started = true;
    setLoader(1);
    sizeCanvas();
    draw(true);

    const introWords = splitWords($('.film__intro .display'));
    const introSide = $$('.film__intro .script, .film__lead, .film__cue');

    gsap.timeline({
      delay: 0.15,
      onComplete: () => {
        root.classList.remove('is-loading');
        root.classList.add('is-loaded');
        $('.loader').remove();
        initPage();
      },
    })
      .to('.loader__logo, .loader__foot, .loader__bar', { autoAlpha: 0, y: -20, duration: 0.6, stagger: 0.05, ease: 'power2.in' })
      .to('.loader', { clipPath: 'inset(0 0 100% 0)', duration: 1.1, ease: 'expo.inOut' }, '-=0.15')
      .from(introWords, { y: (i, el) => el.offsetHeight * 1.15, stagger: 0.08, duration: 1.4, ease: 'expo.out' }, '-=0.55')
      .from(introSide, { autoAlpha: 0, y: 16, stagger: 0.1, duration: 1, ease: 'power3.out' }, '-=1.1')
      .from('.nav', { autoAlpha: 0, y: -16, duration: 1, ease: 'power3.out' }, '-=1');
  }

  const bufferText = (all) => {
    if (all >= 1) hudBuffer.classList.add('is-done');
    else { hudBuffer.classList.remove('is-done'); hudBuffer.textContent = `Film lädt ${Math.round(all * 100)}%`; }
  };

  currentSet = pickSet();
  loadSet(
    currentSet,
    () => {
      const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
      Promise.race([fonts, new Promise((r) => setTimeout(r, 1500))]).then(start);
    },
    (all, first) => { if (!started) setLoader(first * 0.98); bufferText(all); }
  );
  setTimeout(start, 10000);   // never trap visitors on very slow connections

  /* ==========================================================================
     Page
     ========================================================================== */
  function initPage() {
    buildFilm();
    initReveals();
    initStatement();
    initServices();
    initWhy();
    initCompare();
    initGallery();
    initProcess();
    initFooter();
    initForm();
    initNav();             // last: all pins exist, so positions are correct
    ScrollTrigger.refresh();
    requestRender(true);

    let resizeTimer;
    addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        sizeCanvas();
        requestRender(true);
        const next = pickSet();
        if (next !== currentSet) {
          currentSet = next;
          loadSet(next, null, bufferText);
        }
      }, 180);
    });
  }

  /* ---------- Navigation ---------- */
  function initNav() {
    const nav = $('[data-nav]');
    const toggle = $('[data-menu-toggle]');
    const menu = $('[data-menu]');

    ScrollTrigger.create({
      trigger: filmEl,
      start: () => filmST.end + 2,
      end: 'max',
      onToggle: (self) => nav.classList.toggle('is-solid', self.isActive),
    });
    ScrollTrigger.create({
      start: 0, end: 'max',
      onUpdate: (self) => {
        const pastFilm = self.scroll() > filmST.end + innerHeight * 0.4;
        nav.classList.toggle('is-hidden', pastFilm && self.direction === 1 && !root.classList.contains('menu-open'));
      },
    });

    const setMenu = (open) => {
      root.classList.toggle('menu-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      menu.setAttribute('aria-hidden', String(!open));
      document.body.style.overflow = open ? 'hidden' : '';
    };
    toggle.addEventListener('click', () => setMenu(!root.classList.contains('menu-open')));
    addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

    $$('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href');
        if (id.length < 2) return;
        const isTop = id === '#top' || id === '#film';
        const target = isTop ? null : $(id);
        if (!isTop && !target) return;
        e.preventDefault();
        setMenu(false);
        const top = isTop ? 0 : target.getBoundingClientRect().top + scrollY;
        window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
      });
    });

    $$('.nav__links a').forEach((link) => {
      const sec = $(link.getAttribute('href'));
      if (!sec) return;
      ScrollTrigger.create({
        trigger: sec, start: 'top 50%', end: 'bottom 50%',
        onToggle: (self) => link.classList.toggle('is-active', self.isActive),
      });
    });
  }

  /* ---------- Generic reveals ---------- */
  function initReveals() {
    $$('[data-split]').filter((el) => !el.closest('.film')).forEach((el) => {
      const words = splitWords(el);
      if (reduceMotion) return;
      gsap.from(words, {
        yPercent: 115, duration: 1.2, stagger: 0.06, ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 86%', once: true },
      });
    });
    if (reduceMotion) return;
    ScrollTrigger.batch('[data-reveal]', {
      start: 'top 90%', once: true,
      onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1.1, stagger: 0.08, ease: 'power3.out', overwrite: true }),
    });
    $$('[data-parallax]').forEach((im) => {
      gsap.fromTo(im, { yPercent: -18 }, {
        yPercent: 0, ease: 'none',
        scrollTrigger: { trigger: im.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });
  }

  /* ---------- Statement + counters ---------- */
  function initStatement() {
    const el = $('[data-words]');
    const words = splitWords(el);
    if (!reduceMotion) {
      gsap.fromTo(words, { opacity: 0.16 }, {
        opacity: 1, stagger: 0.1, ease: 'none',
        scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 55%', scrub: 0.5 },
      });
    }
    $$('[data-count]').forEach((n) => {
      if (reduceMotion) return;
      const endVal = parseFloat(n.dataset.count);
      const dec = Number(n.dataset.decimals || 0);
      const obj = { v: 0 };
      n.textContent = (0).toFixed(dec);
      gsap.to(obj, {
        v: endVal, duration: 2.2, ease: 'power3.out',
        scrollTrigger: { trigger: n, start: 'top 92%', once: true },
        onUpdate: () => { n.textContent = obj.v.toFixed(dec); },
      });
    });
  }

  /* ---------- Services: image preview follows the cursor ---------- */
  function initServices() {
    const preview = $('[data-service-preview]');
    const img = $('img', preview);
    const list = $('[data-services]');
    const rows = $$('.service', list);
    if (!reduceMotion) {
      gsap.from(rows, {
        autoAlpha: 0, y: 24, duration: 0.9, stagger: 0.05, ease: 'power3.out',
        scrollTrigger: { trigger: list, start: 'top 85%', once: true },
      });
    }
    if (!matchMedia('(hover: hover) and (min-width: 861px)').matches || reduceMotion) return;

    let preloaded = false;
    const preload = () => { if (preloaded) return; preloaded = true; rows.forEach((r) => { const p = new Image(); p.src = r.dataset.img; }); };
    ScrollTrigger.create({ trigger: list, start: 'top 140%', once: true, onEnter: preload });

    const xTo = gsap.quickTo(preview, 'x', { duration: 0.6, ease: 'power3' });
    const yTo = gsap.quickTo(preview, 'y', { duration: 0.6, ease: 'power3' });
    gsap.set(preview, { xPercent: -50, yPercent: -50, x: innerWidth / 2, y: innerHeight / 2, scale: 0.85 });
    list.addEventListener('mousemove', (e) => { xTo(e.clientX + 40); yTo(e.clientY); });
    rows.forEach((row) => {
      row.addEventListener('mouseenter', () => {
        if (img.getAttribute('src') !== row.dataset.img) {
          img.src = row.dataset.img;
          gsap.fromTo(img, { scale: 1.15 }, { scale: 1, duration: 0.8, ease: 'power3.out' });
        }
        gsap.to(preview, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'power3.out' });
      });
    });
    list.addEventListener('mouseleave', () => gsap.to(preview, { autoAlpha: 0, scale: 0.85, duration: 0.45, ease: 'power3.out' }));
    addEventListener('scroll', () => { if (!list.matches(':hover')) gsap.to(preview, { autoAlpha: 0, duration: 0.3 }); }, { passive: true });
  }

  /* ---------- Why: clip reveal ---------- */
  function initWhy() {
    if (reduceMotion) return;
    const media = $('[data-clip]');
    gsap.fromTo(media, { clipPath: 'inset(14% 12% 14% 12% round 6px)' }, {
      clipPath: 'inset(0% 0% 0% 0% round 6px)', ease: 'none',
      scrollTrigger: { trigger: media, start: 'top 90%', end: 'top 30%', scrub: 0.6 },
    });
    gsap.from('.why__badge', {
      autoAlpha: 0, y: 30, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: media, start: 'top 50%', once: true },
    });
  }

  /* ---------- Vorher / Nachher slider ---------- */
  function initCompare() {
    const box = $('[data-compare]');
    const range = $('[data-compare-range]');
    const set = (v) => box.style.setProperty('--pos', v + '%');
    range.addEventListener('input', () => set(range.value));
    set(range.value);
    if (reduceMotion) return;
    const o = { v: 88 };
    set(o.v);
    gsap.to(o, {
      v: 50, duration: 1.8, ease: 'power3.inOut', delay: 0.2,
      scrollTrigger: { trigger: box, start: 'top 70%', once: true },
      onUpdate: () => { set(o.v); range.value = o.v; },
    });
  }

  /* ---------- Gallery: pinned horizontal scroll on desktop ---------- */
  function initGallery() {
    const pinEl = $('[data-gallery]');
    const track = $('[data-gallery-track]');
    const bar = $('[data-gallery-progress]');
    gsap.matchMedia().add('(min-width: 861px)', () => {
      const distance = () => Math.max(0, track.scrollWidth - innerWidth);
      const horizontal = gsap.to(track, {
        x: () => -distance(), ease: 'none',
        scrollTrigger: {
          trigger: pinEl, start: 'top top', end: () => '+=' + distance(),
          pin: true, scrub: 0.7, invalidateOnRefresh: true,
          onUpdate: (self) => gsap.set(bar, { scaleX: self.progress }),
        },
      });
      if (reduceMotion) return;
      $$('.card__media img', track).forEach((im) => {
        gsap.fromTo(im, { xPercent: -5 }, {
          xPercent: 5, ease: 'none',
          scrollTrigger: { trigger: im.parentElement, containerAnimation: horizontal, start: 'left right', end: 'right left', scrub: true },
        });
      });
    });
    gsap.matchMedia().add('(max-width: 860px)', () => {
      $$('.card__media img', track).forEach((im) => gsap.set(im, { scale: 1 }));
    });
  }

  /* ---------- Process ---------- */
  function initProcess() {
    const steps = $('[data-steps]');
    gsap.fromTo('[data-steps-line]', { scaleY: 0 }, {
      scaleY: 1, ease: 'none',
      scrollTrigger: { trigger: steps, start: 'top 65%', end: 'bottom 65%', scrub: 0.4 },
    });
    $$('[data-step]', steps).forEach((step) => {
      ScrollTrigger.create({
        trigger: step, start: 'top 70%',
        onEnter: () => step.classList.add('is-on'),
        onLeaveBack: () => step.classList.remove('is-on'),
      });
      if (reduceMotion) return;
      gsap.from(step.children, {
        autoAlpha: 0, y: 30, stagger: 0.08, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: step, start: 'top 88%', once: true },
      });
    });
  }

  /* ---------- Footer ---------- */
  function initFooter() {
    const yearEl = $('[data-year]');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
    const word = $('[data-footer-word]');
    word.innerHTML = word.textContent.split('').map((c) => `<span class="w"><span class="w__i">${c === ' ' ? '&nbsp;' : c}</span></span>`).join('');
    if (reduceMotion) return;
    gsap.from($$('.w__i', word), {
      yPercent: 105, stagger: 0.04, duration: 1.3, ease: 'expo.out',
      scrollTrigger: { trigger: word, start: 'top 95%', once: true },
    });
  }

  /* ---------- Contact form ---------- */
  function initForm() {
    const form = $('[data-form]');
    const status = $('[data-form-status]');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      let ok = true;
      $$('.field', form).forEach((f) => {
        const input = $('input, textarea', f);
        if (!input.required) return;
        const valid = input.checkValidity() && input.value.trim() !== '';
        f.classList.toggle('is-invalid', !valid);
        if (!valid) ok = false;
      });
      if (!ok) { status.textContent = 'Bitte füllen Sie die markierten Felder aus.'; return; }

      const data = new FormData(form);
      const endpoint = form.dataset.endpoint; // e.g. data-endpoint="https://formspree.io/f/…"
      if (endpoint) {
        status.textContent = 'Wird gesendet…';
        try {
          const res = await fetch(endpoint, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
          if (!res.ok) throw new Error(res.statusText);
          form.reset();
          status.textContent = 'Vielen Dank! Wir melden uns schnellstmöglich bei Ihnen.';
        } catch (err) {
          status.textContent = 'Leider ist ein Fehler aufgetreten. Bitte schreiben Sie an info@sanier-fix.com.';
        }
        return;
      }
      const subject = encodeURIComponent(`Projektanfrage – ${data.get('type')}`);
      const body = encodeURIComponent(`Name: ${data.get('name')}\nE-Mail: ${data.get('email')}\nTelefon: ${data.get('phone') || '-'}\nProjekt: ${data.get('type')}\n\n${data.get('message')}`);
      window.location.href = `mailto:info@sanier-fix.com?subject=${subject}&body=${body}`;
      status.textContent = 'Ihr E-Mail-Programm wird geöffnet…';
    });
  }
})();
