# ADR 002: Monorepo (D2)

Status: accepted

## Decision

pnpm workspaces: `apps/*` for the three builds, `packages/*` for per-team domain and contract packages plus the platform-owned `ui`, `services/*` for data APIs.

## Alternative

Separate repos.

## Why

One clone and one `docker compose up`. Ownership boundaries are enforced with dependency-cruiser (ADR 023).
