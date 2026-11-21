# Sanier Fix

Premium website for Sanier Fix (Landau in der Pfalz) with a cinematic, scroll-controlled film hero, built in the Sanier Fix brand (navy #002458, blue #05A5E3, IBM Plex Sans, Yellowtail).

## Highlights

- **Scroll-controlled film, one scene per gesture.** The hero is pinned and every scroll position maps to a frame of the construction film. Each scroll gesture glides to the next *complete* scene (plot → blueprint → structure → façade → entrance → living → kitchen → bedroom → dusk) and stops there — never mid-transition. Rest frames are set by `data-frame` on each chapter in `index.html`.
- **Smooth playback.** The film is an all-intra H.264 MP4 (every frame a keyframe) that is fully downloaded before the site opens, then seeked by scroll with easing — hardware-decoded, so there is no memory pressure or stutter. GSAP Observer turns each wheel/touch gesture into one animated step.
- **Video files** (mastered from the 4K upscaled film): `film-1440.mp4` (2560×1440, large/retina screens), `film-1080.mp4` (1920×1080, desktop), `film-portrait.mp4` (960×1440 crop, phones). Light `*-preview.mp4` versions (5 MB / 3 MB) open the site fast; the HD file is swapped in seamlessly once downloaded.
- **Brand assets** (logo, team & reference photos, brush icons) are loaded directly from sanier-fix.com/wp-content/uploads.
- **Chapters synced to scenes:** Ground → Structure → Form → Threshold → Living → Kitchen → Retreat → Home, each with masked word reveals, plus a chapter rail and a frame counter.
- **Full site:** studio statement (words light up as you read), stats, services (with a cursor-following image preview), a pinned horizontal residence gallery, philosophy, process timeline, contact form and footer.
- **Accessibility:** works without JavaScript (static poster + content), respects `prefers-reduced-motion`, includes a skip link, keyboard focus styles and semantic markup.

## Stack

Static HTML, CSS and JavaScript with no build step. GSAP 3.15 and ScrollTrigger are vendored in `js/vendor/`.

```
index.html
css/style.css
js/main.js                 # film renderer, timelines, interactions
js/vendor/                 # gsap.min.js, ScrollTrigger.min.js
assets/frames/{lg,md,sm}/  # 0001.webp … 0302.webp
assets/img/                # stills, poster, social image
scripts/build-film.sh    # regenerates frames/stills from the source video
```

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy

The site is fully static, so any host works.

- **GitHub Pages:** Settings → Pages → deploy from branch `main`, folder `/ (root)`.
- **Netlify / Vercel / Cloudflare Pages:** no build command; the publish directory is `/`.

## Replacing the film

```bash
./scripts/build-film.sh path/to/new-video.mp4
```

If the frame count changes, update `FRAME_COUNT` in `js/main.js`. Each chapter's `data-from` and `data-to` attributes in `index.html` are frame numbers; adjust them to match the new scene cuts.

## Before launch

- **Contact form:** by default it opens the visitor's email app addressed to info@sanier-fix.com. To receive submissions directly, add `data-endpoint="https://formspree.io/f/your-id"` (or similar) to the `<form>`.
- Images are hotlinked from sanier-fix.com — if media files there are renamed or deleted, update the URLs in `index.html`.

## V2 (portrait film) — `/v2/`

A second version of the homepage built around the vertical film *Modern Home Transformation* (2160×3840, 453 frames).
On landscape screens the film is shown in a tall rounded frame on the right over a blurred live backdrop; on phones it plays full-screen.
Seven scenes stop at frames 48, 110, 180, 266, 310, 348 and 452 (`data-frame` in `v2/index.html`).
Files: `v2/index.html`, `v2/v2.css` (layout overrides on top of `css/style.css`), `v2/main-v2.js`, `v2/assets/video/film-{preview,hd}.mp4`.
