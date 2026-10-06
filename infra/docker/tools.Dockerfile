# Tooling image: Node 24 LTS with pnpm through Corepack. The pnpm version comes
# from "packageManager" in the root package.json, so it is pinned in one place.
FROM node:24

RUN corepack enable

WORKDIR /repo
