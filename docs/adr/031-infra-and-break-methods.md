# ADR 031: Docker, gateway and break methods (T2.4, T2.6, T2.9)

Status: accepted

## Decision

**Runtime values** (names, ports, routes, `config.json` shape) are fixed by ADR 029. This ADR records the choices made on top of them.

**Gateway** (`infra/nginx/gateway.conf`, stock `nginx:1.29-alpine` with the file mounted, so it has no image of its own):

- Every upstream is held in a variable (`set $people_remote http://people:80; proxy_pass $people_remote;`) and resolved per request through Docker's DNS (`resolver 127.0.0.11 valid=5s`). With a literal host name nginx resolves once at start and refuses to boot if one container is missing. With variables the gateway starts with any subset of containers and recovers when one comes back (checked with fake upstreams: a stopped upstream gives `502` on its own routes within seconds and `200` again after it restarts). The compose file therefore has no `depends_on` on the gateway.
- `/remotes/<name>/` is a prefix location that cuts the prefix with `rewrite ^/remotes/<name>(/.*)$ $1 break;`, because a variable in `proxy_pass` turns off the automatic prefix replacement. nginx escapes the rewritten path again and keeps the query string. Building the target from a regex capture was tried first and rejected: the capture is the decoded path, so `a%20b` reached the remote as `a b` and `x%3Fy=1` was split into a path and a query. `/remotes/<name>` redirects to the slash form (query string kept) with a relative `Location` (`absolute_redirect off`): the gateway listens on 80 inside the container but is published on 8080, so an absolute redirect would name the wrong port. An unknown remote name is a 404.
- **Data services (Phase 3, ADR 032 and 033).** `/api/people/` goes to `people-pb:8090` and `/api/delivery/` to `delivery-pb:8090`, with the prefix cut by `rewrite ^/api/people(/.*)$ $1 break;` for the same reason as the remotes. The `pocketbase` SDK's base URL is the prefix and it adds its own `/api/…`, so a browser request reads `/api/people/api/collections/…` and PocketBase sees `/api/collections/…`. **The prefix is an allowlist**, not a pass-through (user decision, 2026-10-07). Per prefix only these are forwarded: `= /api/<p>/api/health`, `= /api/<p>/api/batch`, the records routes `/api/<p>/api/collections/<name>/records` and `/records/<id>` (a regex location, with `<name>` one of that instance's own collections by exact name: people `employees` and `rate_records`; delivery `projects`, `breakdown_items`, `allocations` and `employee_month_loads`, as in the migrations; the id is one path segment). A pattern such as "starts with a lowercase letter" was rejected: a collection can also be reached by its id, and the system collections (`_superusers` and the rest) have `pbc_…` ids, and PocketBase's default `users` auth collection also exists on both instances and the realtime location below. The SDK and the integration tests use nothing else (checked by searching the tests and hooks: collection list, view, create, update, delete, `createBatch`, realtime subscribe, and `health.check`). Everything else under `/api/<p>/` is a JSON 404 from the gateway, with `types {}` so a path ending in `.html` or `.png` is not sent under another content type: PocketBase's settings, logs, backups and crons, the schema routes (`/api/collections` and `/api/collections/<name>`), the auth routes (`/api/collections/<name>/auth-*`), files, the admin dashboard under `/_/`, and the records routes of any collection not listed. nginx takes an exact match first, then a regex location, then the longest prefix, so the two prefix locations only answer what the others did not take. The regex locations keep the mechanics of the remotes: `rewrite … break` on the decoded path (which only chooses the route) and nginx escapes the path again, so `a%20b` and `emp-001%3Fx=1` reach PocketBase still encoded and the query string is untouched; an id with `%2F` decodes to two segments and is a 404. `location = /api/people/api/realtime` and its delivery twin (exact matches, so they win over the rest) add `proxy_buffering off`, `proxy_cache off` and 1 h read and send timeouts: realtime is a long-lived SSE response, and `curl -N` shows `PB_CONNECT` at once. The upstreams are variables like the others, so a stopped `people-pb` gives `502` on `/api/people/…` only. Every other `/api/…` path is still a JSON 404, so it never reaches the shell's HTML fallback. **What the gateway cannot filter:** `/api/<p>/api/batch` is forwarded whole, and each request inside a batch carries its own path in the JSON body, which nginx never sees. A batch can name any collection, by name or id, and only PocketBase's API rules guard its contents (likewise the topics of a realtime subscription, which are in a POST body). The system collections are locked to superusers and there is no superuser. ADR 033 records what a batch can do to `users`. `services/*/test/integration/gateway.test.ts` holds the allowed and blocked shapes.
- `/healthz` answers from the gateway itself and is used only by the compose healthcheck.
- The gateway never does SPA fallback. The app containers do, with `try_files $uri /index.html` for page routes. A last path segment with an extension gets `try_files $uri =404`. `index.html`, `remoteEntry.js` and `config.json` are sent with `Cache-Control: no-cache`. Other files rely on content hashes and default validators.

**App images** (`infra/docker/{shell,people,delivery}.Dockerfile`, build context is the repo root): a `node:24` stage runs `corepack enable`, `pnpm fetch` (from `pnpm-lock.yaml` alone, so a source edit does not re-download), then `pnpm install --frozen-lockfile --offline`, then `pnpm --filter @baseline/<app> --fail-if-no-match build`. An `nginx:1.29-alpine` stage copies `apps/<app>/dist` and `infra/nginx/app.conf`. `--fail-if-no-match` makes a missing or renamed package fail the build, where pnpm would otherwise exit 0 and leave an empty image. A BuildKit cache mount holds the pnpm store between builds.

**Entrypoints** (`infra/docker/entrypoints/`) are installed as `/docker-entrypoint.d/40-<app>.sh`, the hook the official nginx image runs before nginx starts. POSIX `sh` only.

- `shell.sh` writes `/usr/share/nginx/html/config.json` from `PEOPLE_REMOTE_URL`, `DELIVERY_REMOTE_URL`, `FX_TABLE`, `DEFAULT_CURRENCY` and `USERS`, with the defaults from ADR 029. It stops the container with a message when an entry is malformed (a rate that is not a positive JSON number, a `DEFAULT_CURRENCY` missing from the table, a user id that is not `user-<digits>` or `user-<uuid>`). The checks mirror the shell's `ShellConfig` schema and `UserId` pattern, so a value the entrypoint accepts the browser accepts too, so a typo shows up at `docker compose up` and not as a blank page.
- `remote.sh` rewrites the `<base href>` in `index.html` to `$BASE_PATH` when it is set (compose passes `PEOPLE_BASE_PATH` and `DELIVERY_BASE_PATH`). It adds a trailing slash, accepts quoted, single-quoted or bare attribute values (a minifier may drop the quotes), and fails if there is no `<base>` to rewrite. The gateway only routes `/remotes/<name>/`, so another `BASE_PATH` also needs its own route.

**Compose**: only the gateway publishes a port (8080); every other container is reachable only through it. The healthchecks are `wget` against the app containers and `/healthz` on the gateway. No container waits for another: each app container only serves static files, and the gateway resolves its upstreams per request. The two PocketBase containers (`people-pb`, `delivery-pb`, one image, [ADR 033](033-pocketbase-runtime-and-checks.md)) check `/api/health` on 8090 and keep their data in the named volumes `people-data` and `delivery-data`.

## Break methods (T2.6)

Each leaves the gateway, the shell and the other remote running. The shell shows an in-place error with a retry for the broken remote (T2.5).

1. **Stop the container.** `docker compose stop people`. The gateway returns `502` for `/remotes/people/…` and the remote fails to load. Bring it back with `docker compose start people`, then use the retry button. The same works for `delivery`.
2. **Bad remote URL.** `PEOPLE_REMOTE_URL=/remotes/people/nope.js docker compose up -d shell`. This recreates the shell container with a different `config.json`, and the shell asks for a file that is a `404` (not HTML, because of the no-fallback rule). Undo with `docker compose up -d shell` without the variable. A URL without an extension, such as `…/nope`, also breaks the remote, but it is answered with the remote's `index.html` (`200`, a page route) and fails only when the browser tries to run it as a script. A URL on a dead host, for example `http://localhost:9/remoteEntry.js`, fails with a network error.
3. **In the browser.** `?break=people`, handled by the shell itself: no infrastructure involved.

## Reset to seed (T3.8)

PocketBase seeds in a migration, which runs once, on the first start against an empty `/pb_data`. Resetting therefore means emptying the volume and starting the service again. There are two ways, with the same result (both services back at their seed, every edit gone):

1. **`docker compose down -v`.** Removes all containers and both data volumes. Start again with `docker compose up -d`. Use it to go back to nothing, including the other containers.
2. **`infra/scripts/reset.sh`.** Keeps the gateway, the shell and the remotes running. It stops `people-pb` and `delivery-pb`, empties each volume with `docker compose run --rm --no-deps --entrypoint sh <service> -c 'rm -rf /pb_data/*'` (`--entrypoint sh` because the image's command would start PocketBase), and starts both again with `up -d --wait`, so it returns when they are healthy and seeded. The start is in an `EXIT` trap: when the script fails half way (a volume that can't be emptied) or is interrupted, the services are started again, with whatever data is left, and the script still exits non-zero. While the services are down their `/api/…` routes answer `502`. Checked by running it twice in a row, and with `docker compose run` made to fail.

`pnpm test:integration` expects a reset stack: run `infra/scripts/reset.sh` first.

## Alternatives

- A custom gateway image with the config baked in: it needs a rebuild to tweak a route, and adds a Dockerfile for one file.
- `upstream` blocks or literal `proxy_pass` hosts: shorter, but the gateway then fails to start when any container is down, which defeats break method 1.
- Templating `config.json` with `envsubst` or a Node script: `envsubst` cannot build the lists (FX table, users), and the nginx image has no Node.
- SPA fallback at the gateway: it would have to know which path belongs to which app's `index.html`, and it would make a missing `remoteEntry.js` look like a valid page.
- `depends_on: condition: service_healthy` from the gateway to everything: a slow or broken service would block the whole page.

## Why

Each container owns what it serves, and the gateway only routes. That is what lets one team's remote fail without taking the shell down, and it keeps the deep-link rules (D22) in one small file (`app.conf`) that all three apps share.

## Costs and limits

- Upstreams are looked up per request with a 5 s resolver validity, so a container that was just started again can take a few seconds to be reachable through the gateway.

## To verify

First with the built apps absent: `docker compose config` is valid, `nginx -t` passes for both configs in the stock image, the entrypoints give the right output in an nginx container, and the routes behave as above against fake upstreams. Then with the real apps through `localhost:8080`.
