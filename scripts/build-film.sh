#!/usr/bin/env bash
# Rebuilds the scroll films (all-intra MP4s) and poster from the source video.
# Usage: ./scripts/build-frames.sh path/to/video.mp4
set -euo pipefail
SRC="${1:?Usage: $0 path/to/video.mp4}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/assets/video" "$ROOT/assets/img"
SHARP="unsharp=5:5:0.7:5:5:0"
X264="-c:v libx264 -preset slow -tune film -g 1 -keyint_min 1 -pix_fmt yuv420p -movflags +faststart -an"
ffmpeg -v error -y -i "$SRC" -vf "scale=1920:1080:flags=lanczos,$SHARP" $X264 -crf 15 "$ROOT/assets/video/film-1080.mp4" &
ffmpeg -v error -y -i "$SRC" -vf "crop=ih*2/3:ih:(iw-ih*2/3)/2:0,$SHARP" $X264 -crf 17 "$ROOT/assets/video/film-portrait.mp4" &
wait
ffmpeg -v error -y -i "$SRC" -vf "select=eq(n\,0),scale=1280:-1" -frames:v 1 -q:v 4 "$ROOT/assets/img/poster.jpg"
echo "Done. If the frame count changed, update FRAME_COUNT in js/main.js and data-frame on each chapter."
