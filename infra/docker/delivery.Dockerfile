# syntax=docker/dockerfile:1
# @baseline/delivery (ADR 031). Build context is the repo root: the apps compile
# workspace packages from source.

FROM node:24 AS build
RUN corepack enable
WORKDIR /repo

# Fetch first, from the lockfile alone, so editing source doesn't re-download
# packages. package.json is here for the `packageManager` pin that Corepack reads.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm fetch

COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --offline
RUN pnpm --filter @baseline/delivery --fail-if-no-match build

FROM nginx:1.29-alpine
COPY infra/nginx/app.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/delivery/dist /usr/share/nginx/html
# Scripts in /docker-entrypoint.d/ run, in name order, before nginx starts.
COPY --chmod=755 infra/docker/entrypoints/remote.sh /docker-entrypoint.d/40-delivery.sh
