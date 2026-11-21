#!/usr/bin/env bash
# Regenerates the scroll-scrub image sequences and stills from the source film.
# Usage: ./scripts/build-frames.sh path/to/video.mp4
# Requires ffmpeg built with libwebp.
set -euo pipefail

SRC="${1:?Usage: $0 path/to/video.mp4}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/assets/frames"

rm -rf "$OUT" && mkdir -p "$OUT"/{lg,md,sm} "$ROOT/assets/img"

SHARP="unsharp=5:5:0.7:5:5:0"
# lg — desktops & laptops: full source resolution (1920x1080), high quality + light sharpening
ffmpeg -v error -i "$SRC" -vf "scale=1920:1080:flags=lanczos,$SHARP" \
  -c:v libwebp -quality 82 -compression_level 6 -preset photo "$OUT/lg/%04d.webp" &
# md — small tablets in landscape (1440x810)
ffmpeg -v error -i "$SRC" -vf "scale=1440:810:flags=lanczos,$SHARP" \
  -c:v libwebp -quality 80 -compression_level 6 -preset photo "$OUT/md/%04d.webp" &
# sm — phones/tablets in portrait: native-resolution 2:3 centre crop (720x1080), no downscaling
ffmpeg -v error -i "$SRC" -vf "crop=ih*2/3:ih:(iw-ih*2/3)/2:0,$SHARP" \
  -c:v libwebp -quality 80 -compression_level 6 -preset photo "$OUT/sm/%04d.webp" &
wait

# Stills used across the page (frame index in the source film)
ffmpeg -v error -y -i "$SRC" -vf "select=eq(n\,0),scale=1280:-1" -frames:v 1 -q:v 4 "$ROOT/assets/img/poster.jpg"
ffmpeg -v error -y -i "$SRC" -vf "select=eq(n\,296),scale=1200:630:force_original_aspect_ratio=increase,crop=1200:630" \
  -frames:v 1 -q:v 4 "$ROOT/assets/img/og.jpg"

COUNT=$(ls "$OUT/md" | wc -l | tr -d ' ')
echo "Done: $COUNT frames per set. If this differs from FRAME_COUNT in js/main.js, update it."
