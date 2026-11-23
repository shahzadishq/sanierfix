/* ==========================================================================
   Sanier Fix — scroll-driven film (step-snapping) + page interactions
   GSAP 3 + ScrollTrigger (vendored in js/vendor)
   ========================================================================== */
(() => {
  'use strict';

  const FRAME_COUNT = 155;              // frames in the source film (30 fps)
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
    land: { preview: 'assets/video/film-preview.mp4?v=nv1',
            hd: 'assets/video/film-1080.mp4?v=nv1' },
    port: { preview: 'assets/video/film-portrait-preview.mp4?v=nv1', hd: 'assets/video/film-portrait.mp4?v=nv1' },
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
        refreshPriority: 10,
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
  const loaderEl = $('.loader');
  let shown = 0;
  let started = false;

  function setLoader(p) {
    shown = Math.max(shown, Math.min(100, Math.round(p * 100)));
    loaderCount.textContent = shown;
    loaderEl.style.setProperty('--p', shown / 100);
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
      .to('.loader__inner, .loader__big, .loader__label', { autoAlpha: 0, y: -18, duration: 0.5, ease: 'power2.in' })
      .to('.loader__panel--t', { yPercent: -101, duration: 1.15, ease: 'expo.inOut' }, '-=0.05')
      .to('.loader__panel--b', { yPercent: 101, duration: 1.15, ease: 'expo.inOut' }, '<')
      .to('.loader__grid', { autoAlpha: 0, duration: 0.4 }, '<')
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
})();
