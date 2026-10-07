# ADR 021: Schema validation (D21)

Status: accepted; amended by [ADR 032](032-pocketbase-data-layer.md) (2026-10-07)

## Decision

`zod` v4, pinned to one version across the workspace with a pnpm catalog (`catalog:` in each `package.json`). The `*-contract` packages declare `zod` as a `peerDependency`, and each consuming app (and each service's test package) provides it. Types are inferred from schemas and never written twice.

## Alternatives

zod v3; Valibot.

## Why

v4 is the current major, faster and smaller than v3. PocketBase doesn't run zod: the apps parse every record with the contract schemas at the boundary. One pinned version means a schema built in a contract package is checked by the same zod the consumer runs. Making it a peer dependency avoids two copies of zod inside one bundle. zod is not shared through MF: each app bundles its own copy, like `ui`.
