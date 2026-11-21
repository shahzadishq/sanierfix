/* ==========================================================================
   Sanier Fix — scroll-driven film (step-snapping) + page interactions
   GSAP 3 + ScrollTrigger (vendored in js/vendor)
   ========================================================================== */
(() => {
  'use strict';

  const FRAME_COUNT = 302;              // frames in the source film (30 fps)
  const SEG = 10;                       // timeline units per step

  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isNarrow = () => innerWidth <= 860;

  if (!window.gsap || !window.ScrollTrigger || !window.Observer || !window.ScrollToPlugin) {
    root.classList.remove('js');
    root.classList.add('no-anim');
    return;
  }

  gsap.registerPlugin(ScrollTrigger, Observer, ScrollToPlugin);
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
     FILM — all-intra MP4, fully pre-downloaded, seeked by scroll (hardware decoded)
     ========================================================================== */
  const filmEl = $('.film');
  const stage = $('[data-film]');
  let video = $('[data-film-video]');
  const rail = $('[data-rail]');
  const chapters = $$('[data-chapter]');

  // Rest frames: each scroll gesture travels to the next complete scene and stops.
  const STEPS = [0, ...chapters.map((c) => Math.min(FRAME_COUNT - 1, Number(c.dataset.frame)))];
  const STEP_COUNT = STEPS.length - 1;

  const state = { frame: 0 };
  let filmST = null;
  let duration = FRAME_COUNT / 30;
  let cur = 0, inflight = false;

  // Two files per orientation: a light preview (opens the site fast) and the HD film (swapped in when ready).
  const FILES = {
    // Large / high-density screens get 2560×1440, everything else 1920×1080 (both mastered from the 4K film)
    land: { preview: 'assets/video/film-preview.mp4?v=4k',
            hd: innerWidth * Math.min(devicePixelRatio || 1, 2) >= 2200 ? 'assets/video/film-1440.mp4?v=4k' : 'assets/video/film-1080.mp4?v=4k' },
    port: { preview: 'assets/video/film-portrait-preview.mp4?v=4k', hd: 'assets/video/film-portrait.mp4?v=4k' },
  };
  const pickKey = () => (innerHeight > innerWidth * 1.1 ? 'port' : 'land');
  let currentKey = pickKey();

  // A quick play/pause unlocks seeking on iOS/Safari; the film never plays on its own.
  function prime(v) {
    if (v.dataset.primed) return; v.dataset.primed = '1';
    const stop = () => { try { v.pause(); } catch (e) {} };
    try { const pr = v.play(); if (pr && pr.then) pr.then(() => setTimeout(stop, 60)).catch(stop); else setTimeout(stop, 60); } catch (e) { stop(); }
    setTimeout(stop, 300);
  }
  function bindVideo(v) {
    v.addEventListener('loadedmetadata', () => { if (isFinite(v.duration)) duration = v.duration; });
    v.addEventListener('seeked', () => { if (v === video) inflight = false; filmEl.classList.add('is-ready'); });
    v.addEventListener('loadeddata', () => { prime(v); filmEl.classList.add('is-ready'); });
  }
  bindVideo(video);

  // Swap in a new file without a flash: prepare it in a hidden twin, seek it, then exchange.
  function showFile(url) {
    if (!video.getAttribute('src')) { video.src = url; video.load(); return; }
    const nv = video.cloneNode(false);
    nv.removeAttribute('src'); delete nv.dataset.primed;
    nv.style.opacity = '0';
    bindVideo(nv);
    video.after(nv);
    nv.addEventListener('loadeddata', () => {
      nv.addEventListener('seeked', () => {
        const old = video;
        video = nv; inflight = false; cur = nv.currentTime;
        nv.style.opacity = '';
        old.remove();
      }, { once: true });
      try { nv.currentTime = video.currentTime || 0.001; } catch (e) {}
    }, { once: true });
    nv.src = url; nv.load();
  }

  // Scrub loop: ease towards the target time, one seek at a time.
  (function loop() {
    const target = (state.frame / (FRAME_COUNT - 1)) * duration;
    cur += (target - cur) * (reduceMotion ? 1 : 0.32);
    if (Math.abs(target - cur) < 0.002) cur = target;
    if (!video.paused && video.dataset.primed) { try { video.pause(); } catch (e) {} }
    if (!inflight && video.readyState >= 2 && Math.abs(cur - video.currentTime) > 0.008) {
      inflight = true;
      try { video.currentTime = Math.min(duration - 0.001, Math.max(0, cur)); } catch (e) { inflight = false; }
    }
    requestAnimationFrame(loop);
  })();

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
  let activeStep = -1;

  function updateHud(progress) {
    const step = Math.round(progress * STEP_COUNT);
    if (step !== activeStep) {
      activeStep = step;
      railItems.forEach((li, n) => li.classList.toggle('is-active', n + 1 === step));
    }
  }

  /* ---------- Step navigation: one gesture = one complete scene ---------- */
  let stepIndex = 0;
  let animating = false;
  let observer = null;
  const stepY = (n) => filmST.start + (filmST.end - filmST.start) * (n / STEP_COUNT);

  function goToStep(n) {
    if (!filmST) return;
    n = Math.max(0, Math.min(STEP_COUNT, n));
    stepIndex = n;
    animating = true;
    // Unhurried, cinematic travel: longer scenes take a little longer (≈1.7–2.4 s per step)
    const from = Math.round(Math.max(0, Math.min(1, (scrollY - filmST.start) / (filmST.end - filmST.start))) * STEP_COUNT);
    const frames = Math.abs(STEPS[n] - STEPS[Math.max(0, Math.min(STEP_COUNT, from))]);
    gsap.to(window, {
      scrollTo: { y: stepY(n), autoKill: false },
      duration: reduceMotion ? 0 : Math.min(2.8, 1.1 + frames * 0.019),
      ease: 'power1.inOut',
      overwrite: true,
      onComplete: () => setTimeout(() => { animating = false; }, 350),
    });
  }

  function leaveFilm(dir) {
    observer && observer.disable();
    animating = true;
    const y = dir > 0 ? filmST.end + 2 : 0;
    gsap.to(window, { scrollTo: { y, autoKill: false }, duration: 0.5, ease: 'power2.out', overwrite: true,
      onComplete: () => setTimeout(() => { animating = false; }, 200) });
  }

  function step(dir) {
    if (animating) return;
    if (dir > 0 && stepIndex >= STEP_COUNT) return leaveFilm(1);
    if (dir < 0 && stepIndex <= 0) return;
    goToStep(stepIndex + dir);
  }

  function initStepper() {
    observer = Observer.create({
      target: window,
      type: 'wheel,touch',
      preventDefault: true,
      tolerance: 12,
      wheelSpeed: 1,
      onChangeY: (self) => {
        const isTouch = self.event && self.event.type && self.event.type.indexOf('touch') === 0;
        const dy = isTouch ? -self.deltaY : self.deltaY;
        if (Math.abs(dy) < 2) return;
        step(dy > 0 ? 1 : -1);
      },
    });
    observer.disable();

    const inFilm = () => scrollY >= filmST.start - 2 && scrollY <= filmST.end - 2;
    const enable = () => {
      if (observer.isEnabled) return;
      stepIndex = Math.round(Math.max(0, Math.min(1, (scrollY - filmST.start) / (filmST.end - filmST.start))) * STEP_COUNT);
      observer.enable();
      if (Math.abs(scrollY - stepY(stepIndex)) > 4) goToStep(stepIndex);
    };
    ScrollTrigger.create({
      trigger: filmEl, start: () => filmST.start, end: () => filmST.end - 2,
      onEnter: enable, onEnterBack: enable,
      onLeave: () => { if (!animating) observer.disable(); },
    });
    if (inFilm()) enable();

    addEventListener('keydown', (e) => {
      if (!observer.isEnabled) return;
      const next = ['ArrowDown', 'PageDown', ' ', 'Spacebar'].includes(e.key);
      const prev = ['ArrowUp', 'PageUp'].includes(e.key);
      if (!next && !prev) return;
      e.preventDefault();
      step(next ? 1 : -1);
    });
  }

  /* ---------- Film timeline: one segment per step (scrubbed directly by scroll) ---------- */
  function buildFilm() {
    const introWords = splitWords($('.film__intro .display'));
    const introSide = $$('.film__intro .script, .film__lead, .film__cue');

    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: filmEl,
        start: 'top top',
        end: () => '+=' + Math.round(innerHeight * STEP_COUNT),
        pin: stage,
        scrub: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => updateHud(self.progress),
      },
    });
    filmST = tl.scrollTrigger;

    for (let i = 0; i < STEP_COUNT; i++) {
      tl.to(state, { frame: STEPS[i + 1], duration: SEG }, i * SEG);
    }

    tl.to(introSide, { autoAlpha: 0, y: -24, duration: 3 }, 0)
      .to(introWords, { yPercent: -115, stagger: 0.3, duration: 3.6, ease: 'power2.in' }, 0.2);

    chapters.forEach((ch, n) => {
      const k = n + 1;
      const rest = k * SEG;
      const isLast = k === STEP_COUNT;
      const words = splitWords($('.chapter__title', ch));
      const side = $$('.chapter__num, .chapter__body, .chapter__actions', ch);
      const tIn = rest - 4.6;

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
     Preloader: download the whole film first (so every seek is instant)
     ========================================================================== */
  const loaderCount = $('[data-loader-count]');
  const loaderBar = $('[data-loader-bar]');
  let shown = 0;
  let started = false;

  const loaderRing = $('[data-loader-ring]');
  const RING = 2 * Math.PI * 26;
  function setLoader(p) {
    shown = Math.max(shown, Math.min(100, Math.round(p * 100)));
    loaderCount.textContent = shown;
    if (loaderRing) loaderRing.style.strokeDashoffset = String(RING * (1 - shown / 100));
  }

  function fetchBlob(url, onProgress) {
    return fetch(url).then((r) => {
      if (!r.ok || !r.body) throw new Error('stream');
      const total = +(r.headers.get('content-length') || 0);
      let got = 0; const chunks = []; const rd = r.body.getReader();
      const pump = () => rd.read().then((x) => {
        if (x.done) return URL.createObjectURL(new Blob(chunks, { type: 'video/mp4' }));
        chunks.push(x.value); got += x.value.length;
        if (total && onProgress) onProgress(got / total);
        return pump();
      });
      return pump();
    });
  }

  // 1) light preview → open the site  2) HD film in the background → swap in seamlessly
  function loadFilm(key, onReady) {
    const f = FILES[key];
    fetchBlob(f.preview, (p) => { if (!started) setLoader(p * 0.97); })
      .then((url) => { if (key === currentKey) showFile(url); })
      .catch(() => { if (key === currentKey) showFile(f.preview); })
      .then(() => {
        onReady && onReady();
        return fetchBlob(f.hd).then((url) => { if (key === currentKey) showFile(url); })
          .catch(() => { if (key === currentKey) showFile(f.hd); });
      });
  }

  function start() {
    if (started) return;
    started = true;
    setLoader(1);
    const introWords = splitWords($('.film__intro .display'));
    const introSide = $$('.film__intro .script, .film__lead, .film__cue');

    gsap.timeline({
      delay: 0.2,
      onComplete: () => {
        root.classList.remove('is-loading');
        root.classList.add('is-loaded');
        $('.loader').remove();
        initPage();
      },
    })
      .to('.loader__inner', { autoAlpha: 0, scale: 0.94, duration: 0.5, ease: 'power2.in' })
      .to('.loader', { clipPath: 'inset(0 0 100% 0)', duration: 1, ease: 'expo.inOut' }, '-=0.1')
      .from(introWords, { y: (i, el) => el.offsetHeight * 1.15, stagger: 0.08, duration: 1.4, ease: 'expo.out' }, '-=0.5')
      .from(introSide, { autoAlpha: 0, y: 16, stagger: 0.1, duration: 1, ease: 'power3.out' }, '-=1.1')
      .fromTo('.nav', { autoAlpha: 0, y: -16 }, { autoAlpha: 1, y: 0, duration: 1, ease: 'power3.out', clearProps: 'transform,opacity,visibility' }, '-=1');
  }

  loadFilm(currentKey, () => {
    const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.race([fonts, new Promise((r) => setTimeout(r, 800))]).then(start);
  });
  // Safety net for very slow connections.
  setTimeout(() => {
    if (started) return;
    if (!video.getAttribute('src')) showFile(FILES[currentKey].preview);
    start();
  }, 20000);

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
    initStepper();

    let resizeTimer;
    addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const next = pickKey();
        if (next !== currentKey) { currentKey = next; loadFilm(next); }
      }, 250);
    });
  }

  /* ---------- Navigation ---------- */
  function initNav() {
    const nav = $('[data-nav]');
    gsap.set(nav, { clearProps: 'transform,opacity,visibility' });   // CSS owns the header position from here on
    const toggle = $('[data-menu-toggle]');
    const menu = $('[data-menu]');

    ScrollTrigger.create({
      trigger: filmEl,
      start: () => filmST.end + 2,
      end: 'max',
      onToggle: (self) => { nav.classList.toggle('is-solid', self.isActive); root.classList.toggle('past-film', self.isActive); },
    });
    ScrollTrigger.create({
      start: 0, end: 'max',
      onUpdate: (self) => {
        const pastFilm = self.scroll() > filmST.end + innerHeight * 0.4;
        nav.classList.toggle('is-hidden', pastFilm && self.direction === 1 && !root.classList.contains('menu-open'));
      },
    });

    // Hide the phone call/enquiry bar while the contact form itself is on screen
    ScrollTrigger.create({
      trigger: '#kontakt', start: 'top 80%', end: 'bottom top',
      onToggle: (self) => root.classList.toggle('at-contact', self.isActive),
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
    gsap.fromTo('[data-band-img]', { scale: 1.12 }, {
      scale: 1, ease: 'none',
      scrollTrigger: { trigger: '[data-band]', start: 'top bottom', end: 'bottom top', scrub: true },
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
