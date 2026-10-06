# ADR 005: Persistence (D5)

Status: accepted

## Decision

lowdb: one JSON file per service on a Docker volume, written atomically (temp file + rename). Seed on first boot only. Logical transactions come from the in-memory change-set pattern (plan section 3, Service design).

## Alternatives

`better-sqlite3`; `node-persist`.

## Why

Pure JS with no native build, the same JSON shape as the fixtures, and atomic writes built in. Survives reload and container restart. Reset with `docker compose down -v` or a reset script.
