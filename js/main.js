/* ==========================================================================
   Sanierfix — scroll-driven film + page interactions
   GSAP 3 + ScrollTrigger (vendored in js/vendor)
   ========================================================================== */
(() => {
  'use strict';

  const FRAME_COUNT = 302;              // frames per set in assets/frames/{lg,md,sm}
  const FRAME_PATH = (set, i) => `assets/frames/${set}/${String(i + 1).padStart(4, '0')}.webp`;
  const MAX_PARALLEL = 6;               // concurrent frame requests
  const INTRO = 8;                      // timeline units before the film starts moving
  const FILM = 92;                      // timeline units spent playing frames
  const HOLD = 5;                       // units resting on the final frame before unpinning

  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isNarrow = () => innerWidth <= 860;

  /* ---------- Graceful fallback: no GSAP → static, fully readable page ---------- */
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

  /* ---------- Utilities ---------- */
  // Wrap each word in a mask (.w) + inner (.w__i); preserves <em> etc.
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
  const frameWrap = $('[data-film-frame]');
  const canvas = $('[data-film-canvas]');
  const ctx = canvas.getContext('2d', { alpha: false });
  const hudNum = $('[data-frame-num]');
  const hudBuffer = $('[data-buffer]');
  const rail = $('[data-rail]');
  const progressBar = $('[data-progress]');
  const chapters = $$('[data-chapter]');
  $('[data-frame-total]').textContent = String(FRAME_COUNT);

  const images = new Array(FRAME_COUNT);
  const loaded = new Uint8Array(FRAME_COUNT);
  const state = { frame: 0 };
  let currentSet = null;
  let loadToken = 0;
  let drawnIndex = -1;
  let drawnSet = null;
  let rafPending = false;
  let activeChapter = -1;
  let dpr = 1;

  function pickSet() {
    const w = innerWidth, h = innerHeight;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    if (h > w * 1.15) return 'sm';                 // portrait phones / tablets
    return w * ratio >= 1700 ? 'lg' : 'md';
  }

  // Coarse-to-fine order: every 16th frame first (scrubbable almost immediately),
  // then 8th, 4th, 2nd, every frame. The last frame is fetched in the first pass.
  function buildOrder() {
    const order = [], seen = new Uint8Array(FRAME_COUNT);
    const push = (i) => { if (!seen[i]) { seen[i] = 1; order.push(i); } };
    [16, 8, 4, 2, 1].forEach((step, pass) => {
      for (let i = 0; i < FRAME_COUNT; i += step) push(i);
      if (pass === 0) push(FRAME_COUNT - 1);
    });
    return order;
  }

  function loadSet(set, onFirstPass, onProgress) {
    const token = ++loadToken;
    const order = buildOrder();
    const firstPass = Math.ceil(FRAME_COUNT / 16) + 1;
    let cursor = 0, active = 0, done = 0, firstDone = 0, firedFirst = false;
    images.setKeys = images.setKeys || new Array(FRAME_COUNT);

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
          if (ok) { images[i] = img; images.setKeys[i] = set; loaded[i] = 1; }
          done++;
          if (pos < firstPass) firstDone++;
          if (!firedFirst && firstDone >= firstPass) { firedFirst = true; onFirstPass && onFirstPass(); }
          onProgress && onProgress(done / order.length, firstDone / firstPass);
          if (ok && Math.abs(i - state.frame) < 24) requestRender(true);
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
    dpr = Math.min(devicePixelRatio || 1, 2);
    const r = frameWrap.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width * dpr));
    const h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      drawnIndex = -1;
    }
  }

  function draw(force) {
    rafPending = false;
    const target = Math.round(state.frame);
    const i = nearestLoaded(target);
    updateHud(target);
    if (i < 0) return;
    if (!force && i === drawnIndex && images.setKeys[i] === drawnSet) return;
    const img = images[i];
    const cw = canvas.width, ch = canvas.height;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const s = Math.max(cw / iw, ch / ih);
    const dw = iw * s, dh = ih * s;
    ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    drawnIndex = i; drawnSet = images.setKeys[i];
    if (!filmEl.classList.contains('is-ready')) filmEl.classList.add('is-ready');
  }

  let forceNext = false;
  function requestRender(force) {
    if (force) forceNext = true;
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => { const f = forceNext; forceNext = false; draw(f); });
  }

  // Chapter rail + counter
  const chapterRanges = chapters.map((c) => [Number(c.dataset.from), Number(c.dataset.to)]);
  chapters.forEach((c, i) => {
    const li = document.createElement('li');
    li.textContent = c.dataset.label;
    rail.appendChild(li);
    c.dataset.index = i;
  });
  const railItems = $$('li', rail);
  const setProgress = gsap.quickSetter(progressBar, 'scaleX');

  function updateHud(f) {
    hudNum.textContent = String(f + 1).padStart(3, '0');
    setProgress(f / (FRAME_COUNT - 1));
    let idx = chapterRanges.findIndex(([a, b]) => f >= a && f < b);
    if (idx < 0) idx = chapterRanges.length - 1;
    if (idx !== activeChapter) {
      railItems.forEach((li, n) => li.classList.toggle('is-active', n === idx));
      activeChapter = idx;
    }
  }

  /* ---------- Film timeline (pinned + scrubbed) ---------- */
  const frameToTime = (f) => INTRO + (Math.min(f, FRAME_COUNT - 1) / (FRAME_COUNT - 1)) * FILM;

  function buildFilm() {
    const introWords = splitWords($('.film__intro .display'));
    const introSide = $$('.film__intro .eyebrow, .film__cue');

    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: filmEl,
        start: 'top top',
        end: () => '+=' + Math.round(innerHeight * (isNarrow() ? 6.5 : 8.5)),
        pin: stage,
        scrub: 0.6,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });

    // Intro: title lifts away, camera settles from a slight push-in
    tl.to(introSide, { autoAlpha: 0, y: -20, duration: 2.5 }, 0)
      .to(introWords, { yPercent: -115, stagger: 0.35, duration: 3.5, ease: 'power2.in' }, 0.3)
      .fromTo(canvas, { scale: 1.12 }, { scale: 1, duration: INTRO + 10, ease: 'power1.out' }, 0);

    // The film itself — frame index is linked 1:1 to scroll position
    tl.to(state, { frame: FRAME_COUNT - 1, duration: FILM, onUpdate: requestRender }, INTRO);

    // Chapters line up with scene ranges in the film
    chapters.forEach((ch, n) => {
      const start = frameToTime(Number(ch.dataset.from));
      const end = frameToTime(Number(ch.dataset.to));
      const isLast = n === chapters.length - 1;
      const words = splitWords($('.chapter__title', ch));
      const side = $$('.chapter__num, .chapter__body, .chapter__actions', ch);
      const tIn = n === 0 ? start + 0.6 : start + 0.2;

      tl.fromTo(ch, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 }, tIn)
        .fromTo(words, { yPercent: 115 }, { yPercent: 0, stagger: 0.18, duration: 2, ease: 'power3.out' }, tIn)
        .fromTo(side, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, stagger: 0.3, duration: 1.6, ease: 'power2.out' }, tIn + 0.6);

      if (!isLast) {
        const tOut = end - 2;
        tl.to(words, { yPercent: -115, stagger: 0.08, duration: 1.4, ease: 'power2.in' }, tOut)
          .to(side, { autoAlpha: 0, y: -16, duration: 1.1, ease: 'power2.in' }, tOut)
          .to(ch, { autoAlpha: 0, duration: 0.3 }, tOut + 1.5);
      }
    });

    tl.to({}, { duration: HOLD }, INTRO + FILM);
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
    const v = Math.max(shown, Math.round(p * 100));
    shown = v;
    loaderCount.textContent = v;
    loaderBar.style.transform = `scaleX(${v / 100})`;
  }

  function start() {
    if (started) return;
    started = true;
    setLoader(1);
    sizeCanvas();
    draw(true);

    const introWords = splitWords($('.film__intro .display'));
    const introSide = $$('.film__intro .eyebrow, .film__cue');

    const enter = gsap.timeline({
      delay: 0.15,
      onComplete: () => {
        root.classList.remove('is-loading');
        root.classList.add('is-loaded');
        $('.loader').remove();
        initPage();
      },
    });
    enter
      .to('.loader__inner, .loader__bar', { autoAlpha: 0, y: -24, duration: 0.6, ease: 'power2.in' })
      .to('.loader', { clipPath: 'inset(0 0 100% 0)', duration: 1.1, ease: 'expo.inOut' }, '-=0.1')
      .from(canvas, { scale: 1.3, duration: 2.2, ease: 'expo.out', clearProps: 'scale' }, '-=0.9')
      .from(introWords, { y: (i, el) => el.offsetHeight * 1.15, stagger: 0.08, duration: 1.4, ease: 'expo.out' }, '-=1.9')
      .from(introSide, { autoAlpha: 0, y: 16, stagger: 0.1, duration: 1, ease: 'power3.out' }, '-=1.1')
      .from('.nav', { autoAlpha: 0, y: -16, duration: 1, ease: 'power3.out' }, '-=1');
  }

  currentSet = pickSet();
  loadSet(
    currentSet,
    () => {
      const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
      Promise.race([fonts, new Promise((r) => setTimeout(r, 1500))]).then(start);
    },
    (all, first) => {
      if (!started) setLoader(first * 0.98);
      if (all >= 1) {
        hudBuffer.classList.add('is-done');
      } else {
        hudBuffer.textContent = `Loading film ${Math.round(all * 100)}%`;
      }
    }
  );
  // Never trap the visitor behind the loader on very slow connections.
  setTimeout(start, 9000);

  /* ==========================================================================
     Page interactions (built once the loader is gone)
     ========================================================================== */
  function initPage() {
    buildFilm();
    initReveals();
    initStatement();
    initServices();
    initResidence();
    initPhilosophy();
    initProcess();
    initFooter();
    initForm();
    initNav();            // after all pins exist, so section positions are correct
    ScrollTrigger.refresh();
    requestRender(true);

    let resizeTimer;
    addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        sizeCanvas();
        requestRender(true);
        const next = pickSet();
        if (next !== currentSet) {     // e.g. phone rotated: stream the better-fitting set
          currentSet = next;
          hudBuffer.classList.remove('is-done');
          loadSet(next, null, (all) => {
            if (all >= 1) hudBuffer.classList.add('is-done');
            else hudBuffer.textContent = `Loading film ${Math.round(all * 100)}%`;
          });
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
      start: 0, end: 'max',
      onUpdate: (self) => {
        const y = self.scroll();
        const hide = self.direction === 1 && y > innerHeight * 0.6 && !root.classList.contains('menu-open');
        nav.classList.toggle('is-hidden', hide);
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

    // Smooth anchor navigation that respects pinned sections
    $$('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href');
        if (id.length < 2) return;
        const target = id === '#top' || id === '#story' ? document.body : $(id);
        if (!target) return;
        e.preventDefault();
        setMenu(false);
        const top = target === document.body ? 0 : target.getBoundingClientRect().top + scrollY;
        window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
      });
    });

    // Active link
    const links = $$('.nav__links a');
    links.forEach((link) => {
      const sec = $(link.getAttribute('href'));
      if (!sec) return;
      ScrollTrigger.create({
        trigger: sec.closest('.pin-spacer') || sec,
        start: 'top 50%', end: 'bottom 50%',
        onToggle: (self) => link.classList.toggle('is-active', self.isActive),
      });
    });
  }

  /* ---------- Generic reveals ---------- */
  function initReveals() {
    const targets = $$('[data-split]').filter((el) => !el.closest('.film'));
    targets.forEach((el) => {
      const words = splitWords(el);
      if (reduceMotion) return;
      gsap.from(words, {
        yPercent: 115, duration: 1.3, stagger: 0.07, ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 86%', once: true },
      });
    });

    if (reduceMotion) return;
    ScrollTrigger.batch('[data-reveal]', {
      start: 'top 90%',
      once: true,
      onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1.2, stagger: 0.09, ease: 'power3.out', overwrite: true }),
    });
  }

  /* ---------- Statement: words light up as you read ---------- */
  function initStatement() {
    const el = $('[data-words]');
    const words = splitWords(el);
    if (!reduceMotion) {
      gsap.fromTo(words, { opacity: 0.14 }, {
        opacity: 1, stagger: 0.1, ease: 'none',
        scrollTrigger: { trigger: el, start: 'top 78%', end: 'bottom 52%', scrub: 0.5 },
      });
    }

    $$('[data-count]').forEach((n) => {
      const endVal = Number(n.dataset.count);
      const obj = { v: 0 };
      if (reduceMotion) return;
      n.textContent = '0';
      gsap.to(obj, {
        v: endVal, duration: 2.2, ease: 'power3.out',
        scrollTrigger: { trigger: n, start: 'top 90%', once: true },
        onUpdate: () => { n.textContent = Math.round(obj.v); },
      });
    });
  }

  /* ---------- Services: cursor-following image preview ---------- */
  function initServices() {
    const preview = $('[data-service-preview]');
    const img = $('img', preview);
    const list = $('[data-services]');
    const canHover = matchMedia('(hover: hover) and (min-width: 861px)').matches;
    if (!canHover || reduceMotion) return;

    $$('.service', list).forEach((row) => { const pre = new Image(); pre.src = row.dataset.img; });
    const xTo = gsap.quickTo(preview, 'x', { duration: 0.7, ease: 'power3' });
    const yTo = gsap.quickTo(preview, 'y', { duration: 0.7, ease: 'power3' });
    gsap.set(preview, { xPercent: -50, yPercent: -50, x: innerWidth / 2, y: innerHeight / 2 });

    list.addEventListener('mousemove', (e) => { xTo(e.clientX + 40); yTo(e.clientY); });
    $$('.service', list).forEach((row) => {
      row.addEventListener('mouseenter', () => {
        if (img.getAttribute('src') !== row.dataset.img) {
          gsap.fromTo(img, { scale: 1.15 }, { scale: 1, duration: 0.8, ease: 'power3.out' });
          img.src = row.dataset.img;
        }
        gsap.to(preview, { autoAlpha: 1, scale: 1, rotate: 0, duration: 0.6, ease: 'power3.out' });
      });
    });
    list.addEventListener('mouseleave', () => gsap.to(preview, { autoAlpha: 0, scale: 0.85, duration: 0.5, ease: 'power3.out' }));
    addEventListener('scroll', () => {
      if (!list.matches(':hover')) gsap.to(preview, { autoAlpha: 0, duration: 0.3 });
    }, { passive: true });
  }

  /* ---------- Residence: pinned horizontal gallery (desktop/tablet) ---------- */
  function initResidence() {
    const pinEl = $('[data-residence]');
    const track = $('[data-residence-track]');
    const bar = $('[data-residence-progress]');
    const mm = gsap.matchMedia();

    mm.add('(min-width: 861px)', () => {
      const distance = () => Math.max(0, track.scrollWidth - innerWidth);
      const horizontal = gsap.to(track, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: pinEl,
          start: 'top top',
          end: () => '+=' + distance(),
          pin: true,
          scrub: 0.7,
          invalidateOnRefresh: true,
          onUpdate: (self) => gsap.set(bar, { scaleX: self.progress }),
        },
      });

      if (!reduceMotion) {
        $$('.card__media img', track).forEach((im) => {
          gsap.fromTo(im, { xPercent: -5 }, {
            xPercent: 5, ease: 'none',
            scrollTrigger: { trigger: im.parentElement, containerAnimation: horizontal, start: 'left right', end: 'right left', scrub: true },
          });
        });
      }
    });

    mm.add('(max-width: 860px)', () => {
      $$('.card__media img', track).forEach((im) => gsap.set(im, { scale: 1 }));
    });
  }

  /* ---------- Philosophy: clip reveal + parallax ---------- */
  function initPhilosophy() {
    if (reduceMotion) return;
    const media = $('[data-clip]');
    gsap.fromTo(media, { clipPath: 'inset(16% 14% 16% 14%)' }, {
      clipPath: 'inset(0% 0% 0% 0%)', ease: 'none',
      scrollTrigger: { trigger: media, start: 'top 90%', end: 'top 25%', scrub: 0.6 },
    });
    $$('[data-parallax]').forEach((im) => {
      gsap.fromTo(im, { yPercent: -16 }, {
        yPercent: 0, ease: 'none',
        scrollTrigger: { trigger: im.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });
  }

  /* ---------- Process: drawing line + step activation ---------- */
  function initProcess() {
    const steps = $('[data-steps]');
    const line = $('[data-steps-line]');
    gsap.fromTo(line, { scaleY: 0 }, {
      scaleY: 1, ease: 'none',
      scrollTrigger: { trigger: steps, start: 'top 65%', end: 'bottom 65%', scrub: 0.4 },
    });
    $$('[data-step]', steps).forEach((step) => {
      ScrollTrigger.create({
        trigger: step, start: 'top 65%',
        onEnter: () => step.classList.add('is-on'),
        onLeaveBack: () => step.classList.remove('is-on'),
      });
      if (reduceMotion) return;
      gsap.from(step.children, {
        autoAlpha: 0, y: 34, stagger: 0.08, duration: 1.1, ease: 'power3.out',
        scrollTrigger: { trigger: step, start: 'top 88%', once: true },
      });
    });
  }

  /* ---------- Footer wordmark ---------- */
  function initFooter() {
    const yearEl = $('[data-year]');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
    const word = $('[data-footer-word]');
    if (reduceMotion) return;
    word.innerHTML = word.textContent.split('').map((c) => `<span class="w"><span class="w__i">${c}</span></span>`).join('');
    gsap.from($$('.w__i', word), {
      yPercent: 105, stagger: 0.04, duration: 1.4, ease: 'expo.out',
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
        const valid = input.checkValidity() && input.value.trim() !== '';
        f.classList.toggle('is-invalid', !valid);
        if (!valid) ok = false;
      });
      if (!ok) { status.textContent = 'Please complete the highlighted fields.'; return; }

      const data = new FormData(form);
      const endpoint = form.dataset.endpoint; // set data-endpoint="https://formspree.io/f/…" to POST
      if (endpoint) {
        status.textContent = 'Sending…';
        try {
          const res = await fetch(endpoint, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
          if (!res.ok) throw new Error(res.statusText);
          form.reset();
          status.textContent = 'Thank you — we will be in touch within two working days.';
        } catch (err) {
          status.textContent = 'Something went wrong. Please email hello@sanierfix.com.';
        }
        return;
      }
      const subject = encodeURIComponent(`Project enquiry — ${data.get('type')}`);
      const body = encodeURIComponent(`Name: ${data.get('name')}\nEmail: ${data.get('email')}\nProject: ${data.get('type')}\n\n${data.get('message')}`);
      window.location.href = `mailto:hello@sanierfix.com?subject=${subject}&body=${body}`;
      status.textContent = 'Opening your email app…';
    });
  }
})();
