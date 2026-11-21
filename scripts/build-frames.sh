#!/usr/bin/env bash
# Regenerates the scroll-scrub image sequences and stills from the source film.
# Usage: ./scripts/build-frames.sh path/to/video.mp4
# Requires ffmpeg built with libwebp.
set -euo pipefail

SRC="${1:?Usage: $0 path/to/video.mp4}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/assets/frames"

rm -rf "$OUT" && mkdir -p "$OUT"/{lg,md,sm} "$ROOT/assets/img"

# lg — wide, high-density screens (1920x1080)
ffmpeg -v error -i "$SRC" -vf "scale=1920:1080:flags=lanczos" \
  -c:v libwebp -quality 58 -compression_level 5 -preset photo "$OUT/lg/%04d.webp" &
# md — laptops & tablets (1280x720)
ffmpeg -v error -i "$SRC" -vf "scale=1280:720:flags=lanczos" \
  -c:v libwebp -quality 62 -compression_level 5 -preset photo "$OUT/md/%04d.webp" &
# sm — phones in portrait: centre crop 2:3 so the subject stays sharp (640x960)
ffmpeg -v error -i "$SRC" -vf "crop=ih*2/3:ih:(iw-ih*2/3)/2:0,scale=640:960:flags=lanczos" \
  -c:v libwebp -quality 62 -compression_level 5 -preset photo "$OUT/sm/%04d.webp" &
wait

# Stills used across the page (frame index in the source film)
for pair in plot:22 structure:58 facade:100 entry:128 living:172 kitchen:212 bedroom:242 dusk:296; do
  name=${pair%%:*}; frame=${pair##*:}
  ffmpeg -v error -y -i "$SRC" -vf "select=eq(n\,$frame),scale=1600:-1:flags=lanczos" \
    -frames:v 1 -c:v libwebp -quality 74 "$ROOT/assets/img/$name.webp"
done
ffmpeg -v error -y -i "$SRC" -vf "select=eq(n\,0),scale=1280:-1" -frames:v 1 -q:v 4 "$ROOT/assets/img/poster.jpg"
ffmpeg -v error -y -i "$SRC" -vf "select=eq(n\,296),scale=1200:630:force_original_aspect_ratio=increase,crop=1200:630" \
  -frames:v 1 -q:v 4 "$ROOT/assets/img/og.jpg"

COUNT=$(ls "$OUT/md" | wc -l | tr -d ' ')
echo "Done: $COUNT frames per set. If this differs from FRAME_COUNT in js/main.js, update it."
