# Sanier Fix

Premium website for Sanier Fix (Landau in der Pfalz) with a cinematic, scroll-controlled film hero, built in the Sanier Fix brand (navy #002458, blue #05A5E3, IBM Plex Sans, Yellowtail).

## Highlights

- **Scroll-scrubbed film with step snapping.** The hero is pinned and every scroll position maps to a frame of the construction film. Each scroll gesture glides to the next *complete* scene (plot → blueprint → structure → façade → entrance → living → kitchen → bedroom → dusk) and stops there — never mid-transition. Rest frames are set by `data-frame` on each chapter in `index.html`.
- **Apple-style rendering.** The film is pre-rendered as a WebP image sequence and drawn to a `<canvas>`, rather than seeking a `<video>` element, so playback stays smooth on Safari, iOS and Android.
- **High-resolution frame sets.** `lg` (1920×1080, full source resolution) for all laptops/desktops, `md` (1440×810) for small landscape tablets, `sm` (720×1080 native-resolution portrait crop) for phones. Light sharpening, WebP q80+.
- **Progressive loading.** The nine rest frames load first, then coarse-to-fine (every 16th, 8th, 4th, 2nd, every frame).
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
scripts/build-frames.sh    # regenerates frames/stills from the source video
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
./scripts/build-frames.sh path/to/new-video.mp4
```

If the frame count changes, update `FRAME_COUNT` in `js/main.js`. Each chapter's `data-from` and `data-to` attributes in `index.html` are frame numbers; adjust them to match the new scene cuts.

## Before launch

- **Contact form:** by default it opens the visitor's email app addressed to info@sanier-fix.com. To receive submissions directly, add `data-endpoint="https://formspree.io/f/your-id"` (or similar) to the `<form>`.
- Images are hotlinked from sanier-fix.com — if media files there are renamed or deleted, update the URLs in `index.html`.
