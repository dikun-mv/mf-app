# syntax=docker/dockerfile:1
# One image for both data services (ADR 032, ADR 033): `--build-arg SERVICE=people-pb`
# or `delivery-pb`. Build context is the repo root. Nothing is compiled: a service is
# its migrations and hooks, loaded by the stock PocketBase binary at start.

# ---- Pinned release. Change the version and both checksums together. ----
# Checksums are from the release's checksums.txt.
ARG PB_VERSION=0.40.4
ARG PB_SHA256_AMD64=9042ec818570e79c3628dadcd0a756c1496d9e1173918ec409d133c02f82e5fa
ARG PB_SHA256_ARM64=86095bf8ed9345954f0d2bf0a5fb9b57584ae60b77ebf3b6cd23a8003a3fd418

FROM alpine:3.22 AS fetch
ARG PB_VERSION
ARG PB_SHA256_AMD64
ARG PB_SHA256_ARM64
ARG TARGETARCH
WORKDIR /dl
RUN set -eu; \
    case "$TARGETARCH" in \
      amd64) sha="$PB_SHA256_AMD64" ;; \
      arm64) sha="$PB_SHA256_ARM64" ;; \
      *) echo "unsupported architecture: $TARGETARCH" >&2; exit 1 ;; \
    esac; \
    file="pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip"; \
    wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/${file}"; \
    echo "${sha}  ${file}" | sha256sum -c -; \
    unzip -q "$file" pocketbase

FROM alpine:3.22
ARG SERVICE
RUN test -n "$SERVICE" || (echo "pass --build-arg SERVICE=people-pb or delivery-pb" >&2; exit 1)
COPY --from=fetch --chmod=755 /dl/pocketbase /pb/pocketbase
# The whole service folder lands in a scratch path first: people-pb has no pb_hooks yet,
# and COPY fails on a missing source. Only the two folders PocketBase loads are kept.
COPY services/${SERVICE}/ /tmp/service/
RUN mkdir -p /pb/pb_migrations /pb/pb_hooks /pb/seed /pb_data \
    && cp -r /tmp/service/pb_migrations/. /pb/pb_migrations/ \
    && if [ -d /tmp/service/pb_hooks ]; then cp -r /tmp/service/pb_hooks/. /pb/pb_hooks/; fi \
    && rm -rf /tmp/service
COPY docs/data.json /pb/seed/data.json

EXPOSE 8090
# The healthcheck (wget on /api/health) is in docker-compose.yml.
CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb_data", "--migrationsDir=/pb/pb_migrations", "--hooksDir=/pb/pb_hooks", "--automigrate=false"]
