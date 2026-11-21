#!/usr/bin/env bash
# Rebuilds the scroll films (all-intra MP4s), poster and social image from the 4K source video.
# Usage: ./scripts/build-film.sh path/to/video-4k.mp4
set -euo pipefail
SRC="${1:?Usage: $0 path/to/video.mp4}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/assets/video"; mkdir -p "$OUT" "$ROOT/assets/img"
X264="-an -c:v libx264 -preset slow -tune film -g 1 -keyint_min 1 -pix_fmt yuv420p -movflags +faststart"
PORT="crop=ih*2/3:ih:(iw-ih*2/3)/2:0"
ffmpeg -v error -y -i "$SRC" -vf "scale=2560:1440:flags=lanczos" $X264 -crf 19 "$OUT/film-1440.mp4" &
ffmpeg -v error -y -i "$SRC" -vf "scale=1920:1080:flags=lanczos" $X264 -crf 18 "$OUT/film-1080.mp4" &
ffmpeg -v error -y -i "$SRC" -vf "$PORT,scale=960:1440:flags=lanczos" $X264 -crf 19 "$OUT/film-portrait.mp4" &
ffmpeg -v error -y -i "$SRC" -vf "scale=960:540:flags=lanczos" $X264 -crf 26 "$OUT/film-preview.mp4" &
ffmpeg -v error -y -i "$SRC" -vf "$PORT,scale=480:720:flags=lanczos" $X264 -crf 26 "$OUT/film-portrait-preview.mp4" &
wait
ffmpeg -v error -y -i "$SRC" -vf "select=eq(n\,0),scale=1600:-1" -frames:v 1 -q:v 3 "$ROOT/assets/img/poster.jpg"
ffmpeg -v error -y -i "$SRC" -vf "select=eq(n\,296),scale=1200:630:force_original_aspect_ratio=increase,crop=1200:630" -frames:v 1 -q:v 3 "$ROOT/assets/img/og.jpg"
echo "Done. If the frame count changed, update FRAME_COUNT in js/main.js and data-frame on each chapter."
