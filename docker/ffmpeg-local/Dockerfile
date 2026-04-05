# Slim FFmpeg image for local dev on Apple Silicon (linux/arm64).
# x86_64 hosts: remove `platform:` from docker-compose or use buildx.
FROM ubuntu:22.04

RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
		ffmpeg \
		ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /work

ENTRYPOINT ["ffmpeg"]
