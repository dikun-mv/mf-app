# ADR 021: Schema validation (D21)

Status: accepted

## Decision

`zod` v4, pinned to one version across the workspace with a pnpm catalog (`catalog:` in each `package.json`). The `*-contract` packages declare `zod` as a `peerDependency`, and each consuming app and service provides it. Types are inferred from schemas and never written twice.

## Alternatives

zod v3; Valibot.

## Why

v4 is the current major and what new Hono middleware targets. One pinned version means a schema built in a contract package is checked by the same zod the consumer runs. Making it a peer dependency avoids two copies of zod inside one bundle. zod is not shared through MF: each app bundles its own copy, like `ui`.
