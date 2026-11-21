# Sanierfix

Premium architecture, construction & renovation website with a cinematic, scroll-controlled film hero.

## Highlights

- **Scroll-scrubbed film.** The hero is pinned to the viewport. Every scroll position maps to one frame of the construction film (302 frames). Scroll down to build the house; scroll up and it un-builds.
- **Apple-style rendering.** The film is pre-rendered as a WebP image sequence and drawn to a `<canvas>`, rather than seeking a `<video>` element, so playback stays smooth on Safari, iOS and Android.
- **Responsive frame sets.** `lg` (1920×1080) goes to large, high-density screens, `md` (1280×720) to laptops and tablets, and `sm` (640×960, a portrait centre crop) to phones. If a device rotates, the page streams the better-fitting set.
- **Progressive loading.** Frames load coarse-to-fine (every 16th frame, then every 8th, 4th, 2nd, and finally every frame), so the film can be scrubbed after about 20 requests while the rest streams in.
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

## Before launch: placeholders to update

- **Stats** (`18` years, `240+` homes, `96k` m²): replace these with your real figures.
- **Email** `hello@sanierfix.com` and the Instagram and LinkedIn links (`href="#"`).
- **Contact form:** by default it opens the visitor's email app with the enquiry pre-filled. To post to a form service instead, add `data-endpoint="https://formspree.io/f/your-id"` (or similar) to the `<form>`.
- **"The Lumen House":** the featured-residence name and captions describe the house in the film; rename them as you like.
