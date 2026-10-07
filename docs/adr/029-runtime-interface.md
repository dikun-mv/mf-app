# ADR 029: Runtime interface

Status: accepted (agreed before Phase 2; not one of D1-D25)

> **Partly superseded by [ADR 032](032-pocketbase-data-layer.md) (2026-10-07).** The data services became PocketBase instances before Phase 3 was built. Items 1–8, 11 and 13 changed for the services, as listed there; the frontend values (items 1–3 for the apps, 9, 10, 12) stand.

These values are fixed before Phase 2, so the three apps, their containers and the data services fit together without each part waiting on the others. Changing any of them needs the user's agreement.

## Decisions

1. **Names.** Packages are `@baseline/shell`, `@baseline/people`, `@baseline/delivery`, `@baseline/ui`, `@baseline/people-api` and `@baseline/delivery-api`. The MF containers are `shell`, `people` and `delivery`; remotes expose `./App` and `./mount` (D10). Compose services are `gateway`, `shell`, `people`, `delivery`, `people-api` and `delivery-api`.
2. **Ports.** The gateway listens on host port 8080 (nginx port 80 in its container). App containers serve their build output at `/` on port 80. `people-api` runs on 4001 and `delivery-api` on 4002, inside the container and on the host alike. Dev servers: shell 3000, people 3010, delivery 3020.
3. **Volumes.** `people-data` and `delivery-data`, mounted at `/data`.
4. **Each service owns its full URL prefix**, `/api/people/v1/…` and `/api/delivery/v1/…`. The gateway forwards requests unchanged. `GET /health` sits at the root, outside the prefix, returns `200 {"status":"ok"}`, and is used only by compose healthchecks.
5. **Service env and build.** `PORT`, `DATA_DIR` (holding `db.json`; `/data` in Docker) and `SEED_FILE` (`/app/seed/data.json` in Docker, copied from `docs/data.json`). `pnpm --filter @baseline/<svc> build` (Rslib, D25) writes `dist/index.js` (the server, run with `node dist/index.js`) and `dist/reset.js` (overwrites `DATA_DIR/db.json` with a fresh seed and exits). The image is a `node:24` build stage and a `node:24-slim` runtime holding only `dist/` and the seed, built from the repo root. Its healthcheck uses `node -e "fetch(…/health)"`, because the slim image has no curl.
6. **SSE.** `GET /api/people/v1/events` and `GET /api/delivery/v1/events`. Each event is `event: <name>`, `id: <version>`, `data: <JSON>`, with a `: ping` comment every 15 s.
7. **`version`** is a per-service integer, incremented by every successful write, stored in `db.json` and carried in every event payload.
8. **Error body** `{ "error": { "code": "<DomainError code>", "message": "<text>" } }`: 400 for validation or a domain rule, 404 for a missing entity, 409 for a conflict (including a duplicate client-generated id), 500 for a persistence failure after the in-memory rollback.
9. **`/config.json`** is served by the `shell` container and written at container start by its POSIX `sh` entrypoint (no `jq`) from `PEOPLE_REMOTE_URL`, `DELIVERY_REMOTE_URL`, `FX_TABLE`, `DEFAULT_CURRENCY` and `USERS`. It holds `remotes`, `currencies` (`{ code, perEur }`), `defaultCurrency` and `users` (`{ id, name }`). The shell validates it with zod; remote URLs are never baked into the bundle, and a relative one is resolved against `location.origin`. In dev, `apps/shell/public/config.json` points at the dev servers.
10. **Deep links.** Shell asset URLs are absolute (`/static/…`). Each remote's built `index.html` carries `<base href="/remotes/<name>/">`, which its container entrypoint rewrites to `$BASE_PATH` when set; the dev server uses `/`. A remote's standalone `basePath` is the pathname of `document.baseURI` without the trailing slash, so the `<base href>` is the only place the path is written.
11. **Gateway routes.** `/api/people/` → `people-api:4001` and `/api/delivery/` → `delivery-api:4002` with the prefix kept; their `/events` locations turn buffering off with a 1 h read timeout, HTTP/1.1 and an empty `Connection` header. `/remotes/people/` → `people:80/` and `/remotes/delivery/` → `delivery:80/` with the prefix stripped. Everything else → `shell:80`.
12. **SPA fallback is done by each app container's nginx**: `try_files $uri /index.html` for page routes, `try_files $uri =404` for any file with an extension, so `remoteEntry.js`, chunks, `config.json` and `/api/*` never fall back to HTML. `index.html`, `remoteEntry.js` and `config.json` are sent with `Cache-Control: no-cache`.
13. **Reset to seed** has two methods: `infra/scripts/reset.sh` (runs `node dist/reset.js` in each service with `docker compose run --rm`, then restarts both) and `docker compose down -v`.
