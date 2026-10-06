# ADR 004: Data layer (D4)

Status: accepted

## Decision

One small Hono service per team (`people-api`, `delivery-api`) running in Docker, each seeded from its slice of `data.json`. Requests are validated with the team's contract schemas, and every rule comes from the team's own domain package, which the team's app also uses.

## Alternatives

Browser-only stores (IndexedDB per app); json-server; PocketBase.

## Why

Ownership is visible and real: each team owns its service. Standalone and hosted see the same data. Each domain rule exists once in TypeScript and runs on the client (instant feedback) and the server (enforcement). No host Node, because Node runs in containers.
