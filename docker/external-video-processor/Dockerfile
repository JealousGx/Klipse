# syntax=docker/dockerfile:1.6
# Build from the repository root (needs pnpm workspace + lockfile):
#   docker build -f docker/external-video-processor/Dockerfile -t klipse-external-video-processor:latest .
#
# Runtime: Node 23 + FFmpeg only — app code is a single esbuild bundle (no pnpm in the image).

FROM node:23-alpine AS builder

WORKDIR /app
ENV CI=true

RUN corepack enable && corepack prepare pnpm@10.31.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/external-video-processor ./packages/external-video-processor
COPY packages/video-assembly-shared ./packages/video-assembly-shared

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
	pnpm install --frozen-lockfile --filter @klipse/external-video-processor...

RUN pnpm --filter @klipse/external-video-processor run build

# ---

FROM node:23-alpine AS runner

# FFmpeg for encode. BusyBox `wget` is used for HEALTHCHECK (no extra packages).
RUN apk add --no-cache ffmpeg \
	&& addgroup -g 65532 -S app \
	&& adduser -S -D -H -u 65532 -G app app

WORKDIR /app

# Prefer IPv4 for S3-compatible endpoints when IPv6 paths misbehave in Docker.
ENV NODE_ENV=production \
	PORT=8790 \
	NODE_OPTIONS=--dns-result-order=ipv4first

COPY --from=builder --chown=app:app /app/packages/external-video-processor/dist/index.js ./dist/index.js

USER app:app

EXPOSE 8790

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
	CMD wget -q -O /dev/null http://127.0.0.1:8790/health || exit 1

CMD ["node", "dist/index.js"]
