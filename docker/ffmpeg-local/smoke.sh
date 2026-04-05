#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p work/out

echo "==> ffmpeg -version"
docker compose run --rm ffmpeg -version

echo "==> 5s test pattern -> work/out/smoke.mp4 (720p, h264, light settings)"
docker compose run --rm ffmpeg \
	-f lavfi -i "testsrc=duration=5:size=1280x720:rate=30" \
	-c:v libx264 -preset fast -crf 28 -pix_fmt yuv420p \
	-an -t 5 -y /work/out/smoke.mp4

ls -la work/out/smoke.mp4
echo "Done. Open work/out/smoke.mp4 to verify."
