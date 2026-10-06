# ADR 025: Service build (D25)

Status: accepted

## Decision

Rslib (`@rslib/core`) builds `people-api` and `delivery-api`: `rslib.config.ts` with one ESM lib entry, `output.target: 'node'` and `autoExternal: false`, so the service and its workspace packages (domain, contracts) are bundled into `dist/`. The runtime image needs only `dist/` plus the seed file, with no `node_modules` install. Dev loop: `rslib build --watch` alongside `node --watch dist/index.js`.

## Alternatives

`tsup`; running TypeScript directly (Node type stripping or `tsx`) with no build.

## Why

Completes the Rstack toolchain. Bundling the workspace packages gives a small, self-contained runtime image that doesn't depend on pnpm's symlinked layout. Cost: one more config per service, and less common than `tsup`.

## To verify

That Rslib builds a Node application as one ESM bundle inlining workspace packages, `hono`, `lowdb` and `zod` is checked in T2.9.
