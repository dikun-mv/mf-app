# Baseline — Implementation Plan

A step-by-step plan for the case study in [taks.md](taks.md). Phases are ordered so the highest-weighted, highest-risk work is proven first:

- the reference calculation (§3.4),
- then a walking skeleton of the three federated builds running in Docker,
- then features.

Each phase ends with an **exit check**. Don't start the next phase until it passes.

---

## Handover notes (read first)

**Starting point**
- This plan was written when the repository held only `docs/`: [taks.md](taks.md) is the brief, [data.json](data.json) the seed fixtures, and this plan. The ticks in plan §4 show what is done since; ADRs in [adr/](adr/) record what was decided on the way.
- [phases-4-6.md](phases-4-6.md) is the lead's handover for Phases 4–6: the order, the fixed values, the review and verification loop, and one `builder` brief per slice with its `verifier` check.
- [screens.md](screens.md) has schematic mockups of every screen (Phases 4–6), with seed values and the tasks and decisions each part implements. Its first table maps every screen to its tasks; its §6 records the points the mockups raised and how they were decided.
- Read the brief in full before starting. This plan doesn't restate all of it; plan §5 maps every brief requirement to a check.
- **References:** a bare `§n` (e.g. §3.4, §3.7) means a section of **the brief**. Sections of this plan are written as "plan §n".

**How to use this plan**
- **The data layer changed on 2026-10-07, after Phase 2 and before any Phase 3 work:** the Hono + lowdb services became one stock PocketBase instance per team (ADR 032). D4, D5, D6, D8 and D25 were rewritten, D9, D16, D18 and D21 got PocketBase notes, and Phase 3 was re-planned. The new rows are as settled as the rest.
- **The frontend decisions D26–D37 were added on 2026-10-07, after Phase 3 and before Phase 4:** server state, form state, app structure (Feature-Sliced Design), realtime into the cache, the data-access seam, client state, loading, errors, locale, the grid view model, grid accessibility and concurrent edits. T4.0a records them in ADRs and T4.0c restructures the existing app code before the app work of Phases 4–6.
- **Decisions D1–D37 are settled.** Implement them; don't re-open them. If one turns out to be unworkable (e.g. a library doesn't support an assumed feature), stop and report it rather than switching approach silently. Rows marked *Future option* are deliberately **not** built now.
- Phases 0–3 ran in order, each gated by its exit check; Phase 1's reference test (T1.7) gates everything. **Phases 4, 5 and 6 run in parallel lanes** (plan §4, *Parallel lanes*): a task starts when the tasks it needs have merged to `main`, not when a phase ends. **Phases 7, 8 and 9 then run one after another**, as Phases 0–3 did: Phase 7 starts when Phases 4, 5 and 6 have all passed their exit checks, and each later phase when the previous one has.
- **Dev tooling runs on the host; Docker only runs the suite.** Run every install, build, lint and test command directly with `pnpm` (Node 24 LTS plus Corepack on the host, set up in T0.0). There is no tooling container and no dev container. `docker compose up` must still work with no Node on the host, because Node runs inside the suite's own images.
- Commit per task with meaningful messages. A real history is a requirement (§6 of the brief).

**Assumptions to verify on the pinned versions** (written from memory and not yet tested; confirm each before relying on it)

| Assumption | Where it's used |
| --- | --- |
| Rstest supports separate projects, jsdom, coverage, `jest-dom` matchers and reuse of the Rsbuild config | D14, T0.3 |
| `@module-federation/rsbuild-plugin` exports `pluginModuleFederation`, and the runtime API (`init`, `registerRemotes`, `loadRemote`) works with it | D1, T2.2, T2.4 |
| `output.assetPrefix: 'auto'` makes a remote's chunks and CSS load relative to its `remoteEntry.js` | T2.4, T2.8 |
| Exposed remote modules bring their extracted CSS with them when hosted | T2.8 |
| An async bootstrap (`index.ts → import('./bootstrap')`) is still needed with MF 2.0 | T2.2 |
| `@rsbuild/plugin-typed-css-modules` generates `.d.ts` files for `*.module.css` | D13, T2.8 |
| PocketBase (pin the current release; v0.40.x when this was planned) lets a migration set the system `id` field's `pattern` and `max`, so seed ids (`emp-001`) and client ids (`alloc-<uuid>`, 42 characters) are stored as record ids. Fallback: keep PocketBase ids and store the entity id in a unique `key` field | D4, T3.1, T3.4 |
| The batch API (`POST /api/batch`, `pb.createBatch()` in the SDK) runs in one transaction, and a migration can enable it and raise `maxRequests` and the timeout through `app.settings()` | D5, D9, T3.4 |
| `onRecordCreateRequest` and `onRecordUpdateRequest` fire for every item of a batch (documented), and model hooks (`onRecordCreate`, `onRecordUpdate`, `onRecordDelete`, after `e.next()`) run inside the write's transaction through `e.app` | D8, D18, T3.6 |
| A JS migration can read the seed file with `$os.readFile`. Fallback: generate a CommonJS seed module from `docs/data.json` when the image is built | D5, T3.4 |
| PocketBase's JS engine (goja) loads a plain CommonJS file with ``require(`${__hooks}/lib/load.js`)`` inside a handler, and Rstest can import the same file in Node | D8, T3.6, T3.9 |
| The `pocketbase` JS SDK works with a base URL that has a path (`/api/people`), and its realtime `subscribe` reconnects and resubscribes on its own, through nginx with buffering off | D6, T3.4, T5.0a, T6.0a |
| `date-fns` v4 works with `@date-fns/utc`'s `UTCDate`, so the calendar functions run in UTC | D20, T1.2 |
| dependency-cruiser supports group matching (`$1`) in `to.pathNot`, detects type-only imports (`dependencyTypes: ['type-only']`), and resolves pnpm workspace symlinks to real `packages/…` paths with `tsConfig` set | D23, T0.2 |
| Rslint runs type-aware `@typescript-eslint` rules across pnpm workspace packages, and its built-in `react-hooks`, `rstest` and `jsx-a11y` plugins behave like the ESLint originals | D24, T0.2 |
| React Router v7: several `createBrowserRouter` instances from **separate bundled copies** can live on one page without the nested-router error, `basename` can be set at runtime, and a dispatched `popstate` makes a router re-read the URL | D22, T2.3a |
| TanStack Query v5 works with React 18, and supports `useSuspenseQuery`, `QueryErrorResetBoundary` and mutation `scope` (mutations with the same scope id run one at a time, in order) | D26, D32, T5.3 |
| `@hookform/resolvers` v5's `zodResolver` works with zod v4 schemas (D21), including branded output types | D27, T5.3 |
| dependency-cruiser can express the FSD rules: several capture groups in one rule (`$1`, `$2`, `$3` in `to.path` and `to.pathNot`), enough to say "another slice of the same layer" and "a file of another slice other than its `index.ts`" | D28, T4.0b |
| The SDK's `PB_CONNECT` subscription fires on the first connect and again after every reconnect, so it can trigger the refetch D6 requires | D29, T5.4 |

**Left to the implementer** (not discussed; choose the simplest option and record it in an ADR)
- The min-cost-flow implementation in `roundGrid` (hand-written; T1.9).

**Glossary**
- **PM**: person-month, the canonical allocation unit (D3). One PM = weekly hours × working days in the month ÷ 5.
- **WBS / breakdown item**: a node of a project's work breakdown tree. Leaves hold allocations.
- **Person row**: a grid row for one employee under one leaf, i.e. one `(breakdownItemId, employeeId)` pair.
- **Causer**: the allocation named as causing an over-capacity person-month (D18).
- **Display step / unit**: 0.01 for hours, PM and €; 0.1 for %.

---

## 0. Guiding principles

Each principle comes from the assessment weights.

| Weight | Principle |
| --- | --- |
| Architecture 35 | Domain logic is plain TypeScript in framework-free modules. React is a thin shell over it. Each remote owns its data and publishes a versioned contract. Nobody imports another app's source, and a lint rule enforces this. |
| Correctness 30 | The reference calculation is a test written on day one. Totals, rounding and unit round-trips are covered by invariant (property) tests, not only examples. |
| MF engineering 20 | Remote URLs come from a runtime config file, never the bundle. Each remote has one build that serves both standalone and hosted. React and react-dom are shared singletons. Every panel sits behind an error boundary. |
| Code quality 15 | Branded IDs and units, discriminated unions for cell states, `strict` plus `noUncheckedIndexedAccess`, `no-explicit-any` set to error, and no template leftovers. |

---

## 1. Facts from the fixtures (`docs/data.json`)

Checked against the file. These shape the design:

- Top-level keys: `meta`, `employees` (60), `rateRecords` (150), `projects` (4), `breakdownItems` (90), `allocations` (720).
- **`allocation.amount` is in person-months** (range 0.10–0.65). The reference cell is `alloc-001`: `wbs-012` × `emp-001` × `2026-03` × `0.5`.
- **`meta.gridHorizon` is `2026-04 … 2027-03`, but the reference cell is in `2026-03`.** Project `prj-1` starts on 2026-03-01, so grid columns must come from project dates (or horizon ∪ project span). Otherwise the cell we're checked on is invisible.
- Allocations exist only on leaves. Tree depth is 0–2, i.e. three levels. No allocation falls outside its project's span or before the employee's first rate.
- `(breakdownItemId, employeeId, month)` is unique. Treat it as the natural key of a cell.
- Seed allocations have **no edit timestamp**. "Most recently edited" therefore needs a rule for seed data: see D18.
- The file says field names aren't prescriptive: *"keep the ids and the values"*.
- **All 60 employees' first rate starts on the 1st of a month**, so the seed has no partially unpriced months (D17). They only arise through edits. The easiest trigger: delete the earlier rate of an employee with exactly two rate records whose later rate starts mid-month (emp-001, emp-028, emp-034, emp-041, emp-053). For emp-001 that's the 2025-01-01 record, which makes 12 Mar 2026 the first rate (T8.1).
- **10 employees change rate mid-month:** emp-001 (2026-03-12), emp-007 (2026-05-14), emp-012 (2026-06-11), emp-019 (2026-07-16), emp-023 (2026-09-10), emp-028 (2026-10-15), emp-034 (2026-11-12), emp-041 (2027-01-13), emp-047 (2027-02-11), emp-053 (2027-03-10).
- **6 person-months are over capacity at load**, each with exactly two contributing allocations from different projects: emp-002 2026-09 (alloc-280 + alloc-293), emp-003 2026-06 (alloc-050 + alloc-073; the brief's M. Brandt example), emp-012 2026-05 (alloc-028 + alloc-043), emp-023 2026-06 (alloc-054 + alloc-101), emp-031 2026-12 (alloc-588 + alloc-613), emp-043 2026-10 (alloc-380 + alloc-421). In 4 of the 6 the two amounts are equal. Under D18 the causer is the second id in each pair.
- Seed allocations are stored in id order, and every id is zero-padded (`alloc-001` … `alloc-720`).
- **The seed barely needs rounding:** only 2 of 720 cells have a remainder (hours and €). Rounding problems appear after edits, especially € edits. Test `roundGrid` with stress values, not only the seed (T1.14).

---

## 2. Decisions to make up front

Record each decision in `docs/adr/NNN-*.md` and summarise it in the README. Each row gives a recommendation and a viable alternative.

| # | Decision | Recommendation | Alternative | Why |
| --- | --- | --- | --- | --- |
| D1 | Bundler + MF | **Rsbuild/Rspack + `@module-federation/rsbuild-plugin`**, with `@rsbuild/plugin-react` and the MF 2.0 runtime API from `@module-federation/enhanced/runtime` (`init`, `registerRemotes`, `loadRemote`) | Vite + `@module-federation/vite` | MF is native to Rspack. Rsbuild bundles in dev too, so dev serves a real `remoteEntry.js` with the same sharing rules as production. That lowers the risk to the React-singleton requirement. CSS Modules and typed CSS Modules are first-party. Rstest (D14) reuses the Rsbuild config, so the app and its tests share one pipeline. Cost: less familiar than Vite. |
| D2 | Monorepo | pnpm workspaces. `apps/*` for the three builds, `packages/*` for per-team domain and contract packages plus the platform-owned `ui`, `services/*` for data APIs | Separate repos | One clone and one `docker compose up`. Ownership boundaries are enforced with dependency-cruiser (D23). |
| D3 | Canonical allocation unit | **Person-months** (unrounded `number`) | Hours | The seed and the reference input are already in PM, so import is lossless. Capacity becomes "Σ PM per person-month > 1". The other three units are pure functions of (PM, employee, month, rates). |
| D4 | Data layer | **One stock PocketBase instance per team** (`people-pb`, `delivery-pb`), each in its own container, configured only by the team's `pb_migrations/` (schema, API rules, seed) and a few `pb_hooks/`. **The schema enforces what it can** (field shapes, bounds, unique indexes, relations, locked API rules), and **the rest of the rules run in the team's app through its domain package** before a write. Apps read and write through the official `pocketbase` JS SDK behind their own adapter, and parse every record with the contract schemas (plan §3, Service design) | One small Hono + lowdb service per team, re-running every domain rule on the server (the first plan: a hand-written validate → decide → apply → persist → emit pipeline, write queue, SSE broadcaster and error mapping per team, each with its own tests); one shared PocketBase; json-server; browser-only stores | Almost no server code to write or test: REST, realtime, transactions, validation and persistence come with PocketBase. Ownership stays visible: each team has its own instance, data volume and migrations, and one can fail without the other. Standalone and hosted see the same data, and the suite still needs no host Node. Cost: the server doesn't re-check tree and rate-history rules, so a hand-made API call could break one; the invariant checker (T1.12b) shows any such state in the app, so nothing breaks silently. |
| D5 | Persistence | **PocketBase's embedded SQLite** in `/pb_data` on one named volume per instance (`people-data`, `delivery-data`). A JS migration seeds the team's slice of `data.json` on the first start only. **Logical transactions are batch requests**: the client sends a domain change set (T1.12) as one `POST /api/batch`, which commits or rolls back as a whole | lowdb JSON files behind a hand-written write queue (the first plan); `better-sqlite3` in a Node service | Transactions, serialised writes and crash safety come from SQLite, with no code of ours. Survives reload and container restart. Reset with `docker compose down -v` or a reset script that empties the volumes (T3.8). |
| D6 | Transport between remotes | **PocketBase realtime** (Server-Sent Events on `/api/realtime`), through the SDK's `subscribe('<collection>/*')`, plus REST reads. Each event carries the action (`create`, `update`, `delete`) and the whole record. Consumers patch their read model by id, and refetch after a reconnect, because missed events aren't replayed | Hand-written SSE endpoints with versioned events (the first plan); an in-page typed event bus provided by the shell, plus `BroadcastChannel`; polling | Works hosted, standalone and across tabs. No remote depends on the other remote's JS being loaded. Subscriptions follow the collections' list rules, so a team publishes an event stream just by publishing a collection. |
| D7 | Delivery pricing (the assessed question, §4) | **Delivery reads People's published rate records and computes cost itself** | Delivery asks People for computed cost | Pricing a plan is Delivery's job. A grid of about 720 cells reprices on every keystroke and on € edits that need the blended rate, so it must be local and synchronous. Delivery keeps pricing when the People remote is down. People's contract stays data-only and stable. Cost: Delivery must honour the effective-dating rule. Mitigate with a contract conformance fixture that People publishes and Delivery tests against. |
| D8 | Capacity flow | Delivery owns allocations, so **`delivery-pb` publishes an `employee_month_loads` collection**: per `(employeeId, month)`, `allocatedPersonMonths`, **`overCapacity`** (the T1.11 rule) and `causingAllocationId`. Anyone may read it and subscribe to it; nobody may write it through the API. A model hook rewrites the affected row inside every allocation write's transaction, using `pb_hooks/lib/load.js`, a plain-JS copy of `delivery-domain`'s rule for one group. **A property test holds the copy equal to `delivery-domain`** (T3.9). People shows oversubscription wherever `overCapacity` is true | People fetches raw allocations; a SQL view collection (no realtime events); bundling `delivery-domain` into the hooks (a build step for the JS engine, for about 20 lines) | Allocations stay private. People needs no calendar logic, because PM is already capacity-normalised. The rule is defined once in TypeScript, and its single JS mirror can't drift unnoticed. The load row changes in the same transaction as the allocation, so People never sees a stale flag after a committed edit. |
| D9 | Leaf gains a child | **Move the leaf's allocations onto the new child** as one change set applied atomically (one batch request, D5), and tell the user ("3 allocations moved to …") | Refuse with a message | Keeps the user's work. The domain function is easy to test, and the server applies its change set as a single unit. |
| D10 | Remote interface | Each remote exposes `./App` (a React component taking a `HostContext` prop) **and** `./mount` (`mount(el, ctx) → { update, unmount }`) | Component only | `mount` gives a framework-agnostic seam and is used by standalone bootstrap. The component path uses the shared React singleton. |
| D11 | Display currency | Rates are stored in EUR. The shell owns `{ code, perEur }` from a static FX table in runtime config and pushes it through `HostContext`. Cost edits convert the displayed-currency amount back to EUR before dividing by the blended rate. Only PM is stored. **People's rate editor takes input in the display currency too** and stores `amount ÷ perEur` in EUR, unrounded (decided 2026-10-07, [screens.md](screens.md) §6) | EUR only | Meets "shell owns display currency" with no hidden state in the remotes. |
| D12 | Shared UI primitives | **`packages/ui`** owned by the platform team: a workspace dependency that **each app bundles at build time**, with React as a `peerDependency` and compiled from source by each app's Rsbuild | Shell exposes `shell/ui` through MF; `@baseline/ui` in MF `shared` as non-singleton | Standalone keeps working, and the shell can't push a breaking UI change into a running remote, because changes arrive only when a team rebuilds. The duplicated copy costs a few KB. Runtime MF dedupe can come later if needed. |
| D13 | Styling | **CSS Modules** (built into Rsbuild), with **`clsx`** for conditional classes. Design tokens are CSS custom properties | Linaria; vanilla-extract; runtime CSS-in-JS | Static CSS with no runtime style injection, no extra MF singleton and no Babel transform. Plain CSS is easy to edit in the live walkthrough, and Rstest uses the same CSS settings through the shared Rsbuild config. Costs: token names aren't typed. Class names are typed with `@rsbuild/plugin-typed-css-modules`, and state-to-class maps are typed against the domain unions. |
| D14 | Test stack | **Rstest** (`@rstest/core`) for the domain, contracts, services, client adapters and components. Plus `fast-check` (property tests), `expect-type` and `@ts-expect-error` (type-level tests), `@testing-library/react`, `user-event` and `jest-dom` (components, jsdom), and **Playwright** (E2E, in its Docker image) | Vitest | Rstest reuses each app's Rsbuild config, so components are tested through the same CSS Modules and React transforms as the app. Its API is Jest-compatible (`describe`, `expect`, `rs.fn()`, fake timers). Cost: Rstest is younger than Vitest, so confirm multi-project config, jsdom, coverage, `jest-dom` matchers and reuse of the Rsbuild config on the pinned version in T0.3. The domain tests use only the core runner API, so moving them to Vitest would only mean changing the import. |
| D15 | Moving a WBS node across projects | **Forbidden.** The domain returns a `crossProjectMove` error, and the parent picker offers only nodes in the same project | Allow and move the allocations | Allocations, the project span and the grid months belong to a project. A cross-project move would silently re-date or orphan work. |
| D16 | Deleting an employee | **Forbidden.** The `employees` collection's create and delete API rules stay locked (superusers only), and People's UI has no delete action | People emits an event and Delivery marks the orphaned allocations | The brief doesn't require it, and forbidding it removes a whole class of cross-team orphan states. The invariant checker (T1.12b) still reports unknown employees, in case data is changed by hand. |
| D17 | Partially unpriced month (first rate starts mid-month) | **Days before the first rate cost 0; € edits are refused in that month.** Slicing treats the days before `validFrom` as an unpriced slice, just like a rate change. The cell is marked `partiallyPriced`, with a tooltip such as "8 of 22 working days are before the first rate (12 Mar) and aren't costed". It stays editable in hours, PM and %; a € edit is refused with that reason, as in fully unpriced months. The displayed rate is the blended rate over priced days only | **Future option: allow € edits too.** Costs are the same. A € edit divides by the *effective* rate over **all** working days, with unpriced days counting as 0 (e.g. €60.45/h instead of €95/h), so it round-trips exactly. The UI keeps showing the priced-days rate ("€95.00/h · 14 of 22 days costed") and the effective rate stays internal | Correct costs with no confusing diluted rate, and consistent with fully unpriced months, which must refuse € edits anyway. Cost: those cells can't be edited in €, which is a narrow exception to "every leaf cell editable" in all four units. The rule lives in one function, `euroEditRate(month, rates) → Result<Rate, 'unpriced' \| 'partiallyPriced'>`, so switching to the future option changes only that function and its tests. |
| D18 | "Most recently edited" (capacity causer, §3.9) | **`Allocation.editedAt: IsoDateTime`, never null.** Seeding gives every seed row the same `seededAt`. Each effort edit sets `editedAt = now` on the server, in a `delivery-pb` request hook (create, or a change of `amount`), as `toISOString()` (UTC, millisecond precision, fixed length, so string comparison sorts by time). Moves and D9 re-pointing **don't** change it. **The causer is the contributing allocation with the latest `editedAt`, ties broken by the highest `id`**, one ordering for every comparison. The seed causers are therefore the higher id in each pair (alloc-293, -073, -043, -101, -613, -421). Optional guard: `editedAt = max(now, lastIssued)`, so a clock jump can't reorder edits. No `editedBy` | **Future option: add `editedBy: UserId`**, stamped from the shell's active user carried on the request. It doesn't change the causer rule. It only enriches the tooltip ("… edited by A. Smith") and gives the active user a visible use in the remotes. Strictly increasing timestamps, or a revision counter, were considered and rejected: they need invented seed timestamps or an extra counter | Meets the brief's rule with one truthful field. All seed rows really were created together, there's no nullable special case, and the tiebreak is a general rule rather than seed-specific code. The brief doesn't require recording *who* edited. Residual risk: two user edits to the same person-month within one millisecond are ordered by id. That's practically unreachable, because edits are separate HTTP requests handled one at a time; it's deterministic anyway and documented. |
| D19 | Rounding scheme (§3.7) | **Controlled rounding across the whole grid**: `roundGrid(tree, months, exact, unit) → displayed`. Each leaf cell is rounded either down or up to the display step, chosen **jointly**, so that every displayed number is within one step of its exact value: leaf cells, parent cells, every row Total and the project row. Everything adds up **in both directions** (row Total = Σ month cells; parent cell = Σ displayed children). Solved as a **min-cost flow**: the two kinds of sum (each month down the tree, each row's Total up the tree) each form a tree of nested sums, which guarantees a solution always exists. The cost of rounding a cell up is `1 − 2·remainder`, so large remainders round up first; in a single row this reduces exactly to largest-remainder rounding | B, top-down largest remainder (round the project total, split it to child totals, split each row total across months; parent cells = Σ displayed children). Simpler (about 40 lines). Rejected: in a stress test (±10% edits, 20 runs, all projects and units) about **8% of parent cells** were off their exact value by more than one step, up to 0.05. Row-only largest remainder failed the down sums in about 22% of parent cells. (Method: every seed amount × a random factor in [0.9, 1.1], 20 seeds, all 4 projects and 4 units; repeat it as a property test in T1.14.) | The only option that meets §3.7 everywhere: 0 violations in about 224,000 checked cells in the same stress test. It's still largest-remainder rounding, generalised to both directions, so it matches the brief's wording. Cost: about 150–200 lines of pure TS in `delivery-domain`, harder to explain live than B. The graphs are tiny (a few hundred nodes per project), so recomputing per edit is cheap. Known effect: editing one cell can move a neighbour by one display step (neighbour jitter), which is inherent to largest-remainder rounding. |
| D20 | Date library | **`date-fns`** (v4) with **`@date-fns/utc`** (`UTCDate`) for all calendar maths: `parseISO`, `eachDayOfInterval`, `isWeekend`, `startOfMonth`, `endOfMonth`, `addMonths`, `format`. Dates cross the boundaries as strings (`IsoDate` `YYYY-MM-DD`, `Month` `YYYY-MM`) and become `UTCDate` only inside the domain package's calendar module | Native `Date` only; Temporal | Small, tree-shakeable pure functions that suit a framework-free domain package and run the same in Node and the browser. Doing the maths in UTC makes working-day counts independent of the browser's or container's time zone, so 12 Mar 2026 can't become 11 Mar. Keeping `date-fns` inside `delivery-domain`'s calendar module (and `people-domain` only if it needs date parsing) means the rest of the code never handles `Date` objects. |
| D21 | Schema validation | **`zod` v4** (`zod@^4`, imported from `'zod'`), pinned to **one version across the workspace** with a pnpm catalog (`catalog:` in each `package.json`). The `*-contract` packages declare `zod` as a `peerDependency`, and each consuming app (and each service's test package) provides it. Types are inferred from schemas (`z.infer`) and never written twice | zod v3; Valibot | v4 is the current major, faster and smaller than v3. PocketBase doesn't run zod: the apps parse every record with the contract schemas at the boundary. One pinned version means a schema built in a contract package is checked by the same zod that the consumer runs. Making it a peer dependency avoids two copies of zod inside one bundle. zod is not shared through MF: each app bundles its own copy, like `ui` (D12). |
| D22 | Routing | **React Router v7 (`react-router`), one router per app, never shared through MF.** The shell's router matches only the first path segment (`/people/*`, `/delivery/*`, and `/` redirects to `/people`). Each remote creates its **own** router with `createBrowserRouter(routes, { basename: ctx.basePath })` and `RouterProvider`, over the same `window.history`. Routes: People `index` (register) and `':employeeId'`; Delivery `index` (project picker) and `':projectId'`. `react-router` is **left out of MF `shared`**, so each app bundles its own copy. That keeps router contexts from crossing the boundary, and React Router refuses to render a router inside another router from the same module instance. A remote never navigates outside its own `basePath`. **Cross-app links** go through `HostContext.navigate(to)`. The shell implements it, and after any shell-initiated URL change it dispatches a `popstate` event, so a mounted remote's router re-reads the URL. Standalone, `navigate` opens the other app's standalone URL, or the link is hidden | A hand-written router per app (about 40 lines, no dependency; rejected in favour of a familiar, tested library); shell-only routing with remote state in React (no deep links or back button inside remotes); one router shared as an MF singleton (couples all three builds to one router version); the shell owns the whole URL and passes `path` into remotes (more plumbing, and standalone needs an adapter) | Deep links, reload and the back button work in both modes with the same code; standalone just uses a different `basename`. A well-known library is easy to discuss in the walkthrough, and `useParams`, `Navigate` and `createMemoryRouter` for tests come for free. Not sharing it through MF means no router version or state crosses the boundary, and each team can upgrade React Router on its own schedule. Costs: up to three copies of `react-router` on the page. Several routers listen to the same history, so the shell must never depend on more than the first segment, and must dispatch `popstate` after its own navigations. Deep links also need an SPA fallback in nginx and asset paths that don't depend on the current URL (T2.4, T2.9). |
| D23 | Boundary enforcement | **dependency-cruiser**, run as `pnpm lint:deps` inside `pnpm lint`, configured in `.dependency-cruiser.cjs` at the repo root. It enforces the T0.2 rules over the whole import graph, including type-only imports and cycles, and generates the dependency diagram for the README (T9.1). Rslint handles code-level rules (`no-explicit-any` and so on; D24) | `eslint-plugin-boundaries` (editor feedback as you type, but per-file only: cycles need `import/no-cycle`, type-only handling depends on version, and pnpm workspace resolution needs `eslint-import-resolver-typescript` set up in flat config) | The brief scores whether the remotes are "genuinely independent or quietly coupled" (Architecture, 35%). Whole-graph rules plus a generated diagram show that independence directly: Delivery reaches People only through `people-contract`. Type-only detection (`dependencyTypes: ['type-only']`) and `no-circular` are built in. Cost: no squiggles in the editor; violations show up when `pnpm lint` runs. |
| D24 | Code linter | **Rslint**, completing the Rstack toolchain (Rsbuild, Rstest, Rslint). Run as `pnpm lint:code` inside `pnpm lint`, with **built-in plugins only** (array form): `@typescript-eslint` (strict type-checked set, including `no-explicit-any` and the `no-unsafe-*` family), `react-hooks` (`rules-of-hooks`, `exhaustive-deps`), `rstest` (test files) and `jsx-a11y` (hand-written components and `ui` primitives). No `import` rules: dependency-cruiser owns the boundaries (D23). Formatting stays with **Prettier**; no formatting rules are enabled in Rslint | ESLint with flat config, typescript-eslint, `eslint-plugin-react-hooks` and `eslint-config-prettier`: the fallback. Switching means rewriting the `plugins` entry from Rslint's array form into ESLint's object form and installing the plugin packages; the rule selections stay the same | One toolchain family across build, test and lint. Every rule the plan needs is implemented natively: all typescript-eslint rules, all `@eslint/js` rules, and `react-hooks`, `rstest` and `jsx-a11y` built in, per the official docs. Type-aware linting is built in through the Go TypeScript compiler, so there's no `projectService` tuning, and it's fast. Cost: younger than ESLint and less familiar to interviewers, but its config follows ESLint's, so it's easy to explain. |
| D25 | Service build | **No service build.** One platform-owned `infra/docker/pocketbase.Dockerfile` downloads the pinned PocketBase release for the target architecture, checks its checksum, and copies one team's `pb_migrations/`, `pb_hooks/` and `docs/data.json` (build arg `SERVICE`). Hooks and migrations are plain JS that PocketBase loads at start. Logic sits in CommonJS files under `pb_hooks/lib/` with no PocketBase globals, so Rstest tests them in Node | Rslib bundles of Node services (the first plan); bundling TypeScript for PocketBase's JS engine | Nothing to compile, so nothing to keep in sync between a build and the runtime. Each team still owns its folder; the platform owns only the runtime image. Cost: hook code is untyped JS, so it's kept to a few small files, each with its own tests. |
| D26 | Server state | **TanStack Query v5 (`@tanstack/react-query`) in People and Delivery.** One `QueryClient` per mounted app, created in `App` (`useState(() => new QueryClient(…))`, so the `./App` and `./mount` paths both get one) and cleared when it unmounts. **Realtime keeps the cache fresh** (D29): `staleTime: Infinity`, `refetchOnWindowFocus: false`. **One query per collection**, each the whole collection (`getFullList`; the largest is 720 allocations), keyed by a typed key factory per collection in `shared/api` (D28). The cache holds parsed contract records, never derived values: `PlanState` and the grid come from the domain functions (D35). **Writes go through one hook per app, `useApplyChangeSet`:** `onMutate` applies the change set to the cached collections with `applyChangeSet` and keeps the touched records; `onSuccess` parses the batch response and writes its records into the cache, so the cache is right even while realtime is down (the realtime echo of the same records changes nothing); `onError` puts the touched records back and invalidates their collections. Every mutation has `scope: { id: '<app>-writes' }`, so an app's writes reach the server one at a time, in order. Not in MF `shared` and not in the pnpm catalog: each app bundles and upgrades its own copy, like `react-router` (D22). The shell doesn't use it, because it reads `config.json` once at boot | SWR; RTK Query; a hand-written read model over the repository | Caching, deduplication, loading and error states, and optimistic updates with rollback are written once and widely known. The plan's change sets map straight onto `onMutate`, and `applyChangeSet` stays the one place a change set is applied. Patching by id and structural sharing keep unchanged records' references stable, which the grid's memoisation relies on (D35). Costs: one more library per remote. `@tanstack/eslint-plugin-query` isn't among Rslint's built-in plugins (D24); the key factories stand in for its query-key rules. |
| D27 | Form state | **react-hook-form v7, for real forms only:** the rate editor (add, correct), WBS create, rename and move, and assign-person. Fields are checked in three layers: (1) `zodResolver` (`@hookform/resolvers` v5) with a form schema built from the contract schemas checks shapes; (2) on submit, the domain function's `Result` maps its `DomainError` to `setError` on the field it concerns; (3) a server `conflict` maps to `setError('root.server')`. `ui`'s `TextField` and `Select` forward refs to the native element, so `register` works on every field. Amounts are text fields (`inputMode="decimal"`) whose text the form schema parses with `parseAmount` (D34), so no field needs `Controller`. **Grid cells don't use it:** a cell is one input that saves on Enter or blur and cancels on Esc, and there are about 720 of them, so `GridCell` keeps a small local draft (D37). Not in MF `shared` or the catalog | Controlled inputs with `useState` per form; Formik; TanStack Form | Registration, dirty and touched state, submit handling and error placement come for free, and inputs stay uncontrolled, so typing doesn't re-render the form. Each rule stays where it already lives: shapes in the contracts, rules in the domain packages. The brief's ban on "headless primitives" is about UI components; a form-state library renders nothing, and the README says so. Cost: a second way of handling input next to the grid's local draft; the rule above says which applies where. |
| D28 | App structure | **Feature-Sliced Design (v2.1) inside each of the three apps**, with the same layer names in all three: `app/` (bootstrap, `mount`, `App`, router, providers), `pages/` (one slice per route), `widgets/` (e.g. shell `top-bar`, `remote-panel`, `status-strip`; People `employee-register`, `employee-profile`, `rate-history`; Delivery `project-list`, `staffing-grid`, `cell-details`. The WBS tree is the grid's first column, not a widget of its own), `features/` (user actions, e.g. shell `switch-currency`, `pick-user`; People `search-employees`, `add-rate`, `correct-rate`, `remove-rate`; Delivery `switch-unit`, `edit-cell`, `add-item`, `rename-item`, `move-item`, `delete-item`, `assign-person`), `entities/` (`employee`, `rate-record`, `employee-month-load`, `project`, `breakdown-item`, `allocation`: query hooks and small entity UI) and `shared/` (`api`: PocketBase clients, repository, query keys, `useApplyChangeSet`, error mapping; `lib`, `config`, `testing`). Segments inside a slice: `ui`, `model`, `api`, `lib`. **The domain packages stay outside FSD:** entities hold no business rules and call `*-domain`. `packages/ui` holds the generic primitives; an app's own `shared/ui` holds only app-specific pieces that several slices use (e.g. the not-found view). A layer, slice or segment is created only with its first file. **Relative imports, no `@/` alias.** **Enforced by dependency-cruiser** (D23) with three new rules: `fsd-layers-import-down` (app → pages → widgets → features → entities → shared; a layer imports only layers below it), `fsd-no-cross-slice` (slices of one layer don't import each other, and there are no `@x` cross-imports: entities are combined in features and widgets) and `fsd-public-api` (code outside a slice imports it only through its `index.ts`) | The current flat `screens/`, `routing/`, `host/` per app; FSD checked by Steiger; FSD with `@x` entity cross-imports | One structure in all three apps, which the brief scores ("consistency across the three apps"), and a known convention for the walkthrough: you know where a change goes before opening a file. Layer and slice rules make "what may this import" checkable, the same way the team boundaries already are, in the same tool and the same diagram. No alias, because dependency-cruiser resolves with the one root `tsConfig`, and three apps would each need their own `@/`. Cost: more folders than an app of this size strictly needs; creating them only with their first file keeps them from becoming scaffolding. T4.0c restructures the existing code. |
| D29 | Realtime into the cache | **One `RealtimeProvider` per PocketBase instance an app reads, in `app/`.** On mount it subscribes to each collection the app queries (`subscribe('<collection>/*')`), parses each event's record with the contract schema, and patches that collection's query by id: `create` and `update` replace or add the record, `delete` removes it. An event that fails to parse is logged and dropped, never cached. **After a reconnect** (`PB_CONNECT` after the first) it invalidates that instance's queries, because missed events aren't replayed (D6). On unmount it unsubscribes and cancels the instance's queries, so an MF unmount leaves no open connection. It exposes the connection status (`connecting \| live \| down`) through context; widgets that read the other team's data show their degraded state from it (T5.5, T7.4) | Invalidate on every event (refetches the whole collection for each edit anywhere); a subscription inside each query hook (one subscription per component) | Patching is cheap and keeps unchanged references stable (D35). One subscription per collection per app, owned by the app root, ties its lifetime to `mount` and `unmount`. Cost: realtime patches and D26's optimistic updates meet in one cache; serial writes and "the server's record wins" keep it consistent. |
| D30 | Data-access seam | **Each app's repository interface (T5.0a, T6.0a) reaches components through a React context set in `app/`.** Query and mutation hooks call the repository, never the SDK, and only `shared/api` imports `pocketbase`. Tests render with the in-memory fake of the same interface and a fresh `QueryClient` (`retry: false`) per test, through one `renderWithApp` helper in `shared/testing` | Module-level singletons replaced with `rs.mock`; HTTP mocking (MSW) | One seam for production, tests and the walkthrough. The fake is typed against the same interface, so it can't drift silently, and no test depends on module mocking or network stubs. |
| D31 | Client and UI state | **No global client store.** State a user would want to reload or share lives in the URL, parsed with zod and defaulted when invalid: Delivery's unit (`?unit=hours\|personMonths\|percent\|cost`, the `DISPLAY_UNITS` values, default `personMonths`) and People's register search (`?q=`). The open employee and project are already path segments (D22). Short-lived state stays local to its widget or feature: the cell being edited and its draft, expanded tree nodes (all expanded on load), open dialogs, and a person row assigned to a leaf but with no value saved yet (T6.7). The display currency and active user come only from `HostContext` (D11), never copied into state | Zustand or Redux; one React context per concern; the unit in `localStorage` | Each piece of state has one owner, as the brief's "State ownership" asks, and reload and deep links keep what matters. Server state lives in the query cache (D26) and form state in react-hook-form (D27), which leaves nothing for a store to do. |
| D32 | Loading | **An app's own data loads with `useSuspenseQuery`, under a `Suspense` and an error boundary per page, inside the remote.** The page shows its own loading state, and a failed load shows an inline message with retry (`QueryErrorResetBoundary` with `ui`'s `ErrorBoundary`). The shell's panel `Suspense` (T2.5) only ever covers loading the remote's code. **The other team's data never suspends or throws:** it uses `useQuery`, and the widget renders a degraded state while it's pending or failed. People shows "capacity unknown" (T5.5). Delivery without `people-pb` still shows PM and %, shows employee ids instead of names, and marks hours and cost unavailable | `isPending` branches in every component; one boundary for the whole remote | Components that read data can assume it's there, which keeps them short. A boundary inside the remote stops the shell's panel fallback from covering an app that has already loaded. Keeping the other team's data optional is what makes T7.4 pass: one service down never blanks the other team's screens. |
| D33 | Errors and feedback | **Each kind of error has one place.** A `DomainError` refused before sending shows next to its field or cell (`InlineMessage`). A server `conflict` refetches the affected collections and says the data changed. A network or 5xx failure on a write rolls back (D26) and shows an `InlineMessage` at the top of the widget (the plan has no separate `Banner`). A failed load goes to the page boundary (D32). **Results of an action** ("3 allocations moved to …", D9; "deleted 2 items and 14 allocations") go to the widget's `role="status"` region, which keeps the last message until the next action. No toasts. One function per app, `describeError(error) → string`, turns codes into text. Retries: queries 1, mutations 0 | Toasts (a new `ui` primitive with timing, stacking and focus rules); `alert()` | Messages appear next to what caused them, and screen readers announce them through `role="status"`. Mutations aren't retried: a retried batch could clash with its own first attempt on client-generated ids, and the user can simply repeat the edit. One `describeError` keeps the wording consistent and testable. |
| D34 | Locale and number input | **One display locale, `en-GB`, in every app**, a constant next to each domain package's formatters, with `currencyDisplay: 'narrowSymbol'` (`€7,880.00`, `$…`, `£…`). Dates show as `12 Mar 2026`. **Input is parsed by one pure function per domain package,** `parseAmount(text) → Result<number, 'empty' \| 'notANumber' \| 'negative'>`. It trims, drops a leading currency symbol and a trailing `%` or `h`, accepts `.` as the decimal point and `,` only between groups of three digits (`7,880.5` is accepted, `0,5` is refused as ambiguous). `delivery-domain` and `people-domain` each have their own copy (T0.2 rule 2) | The browser's locale (E2E strings and reference values would change by machine); `,` as a decimal comma (`7,880` becomes ambiguous) | E2E tests and the reference values read the same on every machine. In a cost grid, refusing ambiguous input is safer than guessing. The function is pure and tested next to the units. |
| D35 | Grid view model | **A pure `gridView(plan, people, projectId, unit, currency)` in `delivery-domain`**, built on the existing `buildGrid` layout, `rollUp` and `roundGrid`, returns everything the grid shows: rows, exact and displayed values from `roundGrid`, cell states and markers. `widgets/staffing-grid/model` only reads the cached collections and memoises it: per-cell exact values by the `(allocation, employee's rates)` references, and `roundGrid` by `(project, unit, currency, input references)`. Patched caches keep unchanged records' references (D26, D29), so a rate event recomputes only that employee's cells before re-rounding. Rows are `React.memo` components with primitive props and a stable callback per row | Deriving inside each `GridCell`; a `select` per query (can't combine queries); a derived-data store | Everything the grid shows is calculated without mounting React, where the brief looks hardest, and tested in the domain project with its coverage. T6.11's memoisation follows from it. Cost: `roundGrid` reruns for the whole open project after any change, which is cheap at this size (D19). |
| D36 | Grid keyboard and accessibility | **A plain `<table>` with native semantics and Tab order.** Row and column headers are `<th scope>`. Each editable leaf cell shows its value in a `<button>` whose accessible name includes the row, month and unit. Enter or a click opens the editor (an `<input inputMode="decimal">`); Enter or blur saves, Esc cancels, and focus returns to the button. Derived rows' value cells aren't focusable; only the controls in a row's label are (expand or collapse, and `⋯` on WBS rows). Markers (`†`, unpriced, partially priced) have visible text, and their tooltip text is linked through `aria-describedby`, not only `title`. No arrow-key navigation. **WBS row actions are a minimal `⋯` disclosure per row** (decided 2026-10-07, [screens.md](screens.md) §3.4): a button (`aria-expanded`, `aria-label="Actions for <name>"`) shows or hides plain buttons (Rename, Add child, Move…, Delete…, and Assign person… on leaves) inside the row's label cell, in normal flow under the name, so nothing is positioned or clipped by the scrolling grid. One menu is open at a time (local state, D31); choosing an action or pressing `⋯` again closes it. A disabled action shows its reason as text next to it. No `role="menu"`, arrow keys, Esc or outside-click handling, and no focus management: native buttons already work with Tab and Enter | **Future option:** `role="grid"` with a roving tabindex and arrow keys (one tab stop for the whole grid) | Native table semantics cost nothing and screen readers already understand them; `jsx-a11y` (D24) checks the markup. Tabbing across a row of months is slow but correct. Arrow keys can be added later inside `widgets/staffing-grid` without changing `GridCell`'s props. |
| D37 | Concurrent edits | **Last write wins**, across tabs and users. While a cell or form is being edited, realtime changes update the cache but not the draft: the input keeps what the user typed, and the new stored value shows after save or cancel. "An unchanged value causes no write" (T6.6) compares the draft with the stored value **at save time**. A form whose record is deleted underneath it says "this record was removed" and disables submit | Optimistic locking with a version field (needs a server-side check, which D4 keeps off the server); merging edits | The brief doesn't ask for conflict handling, and nothing is lost silently: the other edit shows as soon as the draft closes. Cost: when two people edit the same cell at once, the later save wins; the README lists it as a known limitation (T9.2). |

---

## 3. Target architecture

```text
browser ── localhost:8080 ── gateway (nginx)
                               ├── /                    → shell      (static)
                               ├── /config.json         → generated at container start from env
                               ├── /remotes/people/     → people     (static: remoteEntry + standalone index.html)
                               ├── /remotes/delivery/   → delivery   (static: remoteEntry + standalone index.html)
                               ├── /api/people/*        → people-pb    (PocketBase: REST + realtime, owns employees & rates)
                               └── /api/delivery/*      → delivery-pb  (PocketBase: REST + realtime, owns projects, WBS, allocations, loads)
```

### Ownership and published contracts

| Owner | Owns | Publishes (versioned) | Consumes |
| --- | --- | --- | --- |
| Shell (platform) | navigation, currency, active user, remote config, shared UI primitives | `host-contract`: `HostContext { currency, activeUser, basePath, navigate }` and the remote `mount` signature. `ui`: presentational primitives and design tokens | — |
| People team | employees, rate records | `people-contract` v1: `Employee`, `RateRecord`, the `employees` and `rate_records` collections (names, record schemas, realtime topics) under `/api/people`, effective-dating semantics, conformance fixture | `delivery-contract` load feed, `host-contract` |
| Delivery team | projects, breakdown tree, allocations, calendar, pricing | `delivery-contract` v1: `EmployeeMonthLoad` as the `employee_month_loads` collection (record schema, realtime topic) under `/api/delivery` | `people-contract`, `host-contract` |

Contract packages hold only **types, runtime schemas (zod, D21), constants (base paths, collection names) and fixtures**. They contain no behaviour. Consumers validate payloads at the boundary.

### Shared UI (`packages/ui`)

**What goes where**

| Location | Contents |
| --- | --- |
| `packages/ui` | Generic, presentational primitives used by at least two apps. Built: `Button`, `InlineMessage` (also the message at the top of a widget, D33), `Spinner`, `ErrorBoundary`. Planned in T4.6, each with two consuming apps in [screens.md](screens.md): `TextField`, `Select`, `Dialog`, `StatusMessage`, `Table`, `PageHeader`. Plus design tokens (`tokens.css`) |
| `apps/shell` | `top-bar` (`Nav`, currency and user selects), `remote-panel`, `status-strip` |
| `apps/people` | `employee-register`, `employee-profile` (with its `CapacityBadge`, People's only badge), `rate-history` and the rate forms |
| `apps/delivery` | `project-list`, `staffing-grid` (tree column, `GridCell`, `UnitSwitcher` radio group, row-actions disclosure), `cell-details`, the WBS dialogs |
| `delivery-domain` | `formatUnit` and money formatting for the grid. These are pure functions, not components. People has its own small money formatter in `people-domain` (T5.6) |

**Rules**

- **Presentational only.** No domain types, data fetching or contracts. `ui` imports nothing but React and `clsx`, and a lint rule enforces it.
- **No React context or global state**, so two copies at different versions on one page can't interfere.
- **Only build what's used.** Add a component when a second app needs it or the same pattern repeats; until then it lives in the app. Unused components count as dead scaffolding. The T4.6 primitives are built ahead of their screens so the app lanes can run in parallel; each is listed with its two consumers, and T8.2a removes any that ends up with fewer.
- **Hand-written on native elements** (`<button>`, `<input>`, `<label>`, `<dialog>`). The brief bans kits and headless primitive libraries.
- **Layout:** component code lives under `src/components/`, one folder per component holding its `.tsx`, its `*.module.css` with the generated `.d.ts`, and its test. Only the package-wide files stay at `src/`: `index.ts` (the public API, the only barrel: it re-exports each component from its folder), `tokens.css` and `vars.ts`. The package `exports` don't change (`.` → `src/index.ts`, `./tokens.css` → `src/tokens.css`), so no app import changes.

  ```text
  packages/ui/src/
    index.ts
    tokens.css
    vars.ts
    components/
      Button/
        Button.tsx
        Button.module.css
        Button.module.css.d.ts
        Button.test.tsx
      ErrorBoundary/
      …
  ```
- **Component shape:**
  - `forwardRef`
  - props typed as `ComponentPropsWithoutRef<'element'>` plus a variant union type
  - `type="button"` as the default for buttons
- **Styling (CSS Modules + `clsx`, D13):**
  - **One `*.module.css` next to each component.**
  - **Conditional classes go through `clsx`.** For multi-property states, use a class map typed by the domain union, so adding a new state kind fails to compile until it has a style:

    ```ts
    import { clsx } from 'clsx';
    import styles from './GridCell.module.css';

    const byState = {
      priced: styles.priced,
      partiallyPriced: styles.partiallyPriced,
      unpriced: styles.unpriced,
    } satisfies Record<CellState['kind'], string>;

    <td className={clsx(styles.cell, byState[cell.kind], {
      [styles.overCapacity]: cell.overCapacity,
      [styles.editing]: isEditing,
    })} />
    ```
  - **Variant props** (`variant: 'primary' | 'secondary' | 'danger'`) map to classes the same way, through a `Record<Variant, string>`.
  - **ARIA or data attributes only where they carry meaning anyway**, such as `aria-invalid`, `aria-busy` or E2E selectors. Never add them only for styling.
  - **Typed class names:**
    - `@rsbuild/plugin-typed-css-modules` generates a `.d.ts` file next to each `*.module.css`.
    - Without them, the generic `*.module.css` declaration types every class as an index signature. Under `noUncheckedIndexedAccess` that's `string | undefined`, and typos go unnoticed.
    - Use `output.cssModules.exportLocalsConvention: 'camelCaseOnly'`.
  - **Per-app class-name prefix** through `output.cssModules.localIdentName` in each app's Rsbuild config: `bl-shell-[local]-[hash:base64:5]`, `bl-people-…`, `bl-delivery-…`. Each app compiles `ui` from source, so `ui` classes get the consuming app's prefix too. Two remotes built with different `ui` versions can then never emit the same class name with different rules.
  - **Tokens** are CSS custom properties in `ui/src/tokens.css`, scoped to `[data-baseline-root]` rather than `:root`. Every app's root element sets that attribute, both standalone and hosted.
    - Module CSS uses tokens through `var(--bl-…)`.
    - For the rare token needed in TS, `ui` exports a small typed `vars` map of `var(--bl-…)` strings.
  - **The shell can re-theme a panel** by overriding custom properties on its container.
  - **No global resets or element selectors,** apart from the scoped token block.
- **Versioning:** consumed as `workspace:^`. Changes must be backward compatible: add props and components, don't remove them. The README notes that in a multi-repo setup this would be a semver-published package each team upgrades on its own schedule.

### Service design (PocketBase)

Each team runs its own stock PocketBase, `people-pb` and `delivery-pb` (D4). Nothing is compiled. A team's service is a folder that PocketBase loads at start:

- `pb_migrations/`: the schema (collections, fields, indexes, API rules), the batch settings and the seed. Each migration runs once, in a transaction, on the first `serve`; PocketBase records which ones ran, so a restart keeps edits.
- `pb_hooks/`: the few server rules the schema can't express. The logic lives in plain CommonJS files under `pb_hooks/lib/` that use no PocketBase globals, so Rstest imports them in Node; the `*.pb.js` files only wire them to hooks.

**What the server enforces, and where**

| Rule | Where |
| --- | --- |
| Required fields, string shapes (`IsoDate`, `Month`, ids), numeric bounds (`amount ≥ 0`, `hourlyCost` above 0) | collection fields |
| One allocation per `(breakdownItemId, employeeId, month)`, one rate per `(employeeId, validFrom)` | unique indexes |
| `projectId`, `parentId` and `breakdownItemId` point at existing records | relation fields, with no cascade: a change set deletes children first |
| Employees are read-only (D16); no API writes to `projects` or `employee_month_loads` | API rules left locked (superusers only) |
| Records that change together (D9, tree operations, rate corrections) | one batch request: one transaction |
| `editedAt` is stamped on effort edits only (D18) | `delivery-pb` request hook on `allocations` |
| `employee_month_loads` follows the allocations (D8) | `delivery-pb` model hook, inside the same transaction |

**What stays in the apps.** Tree rules (depth ≤ 3, no cycles, allocations on leaves only, D9, D15), the allocation validator (T1.12a: month within the project span) and rate-history rules (T1.13) run in the team's app through its domain package, which returns `Result<ChangeSet, DomainError>`. A refusal is shown inline and never reaches the server. The server doesn't re-check these rules, so a hand-made API call could break one. The invariant checker (T1.12b) runs on every load and marks such rows, so nothing is lost silently.

Request flow for a write:

1. **Decide:** the domain function returns `Result<ChangeSet, DomainError>`, and the app applies the change set optimistically.
2. **Send:** the adapter sends the change set as one batch: creates parent-first, deletes children-first.
3. **Commit:** PocketBase validates the fields, indexes and relations, runs the hooks, then commits or rolls back the whole batch.
4. **On failure:** the adapter rolls back the optimistic update and maps the PocketBase error to `DomainError` codes in one place: 400 validation, 404 missing, and a unique-index failure (`validation_not_unique`) or a duplicate client-generated id (`validation_pk_invalid` on `id`) to `conflict`.
5. **Notify:** after the commit, PocketBase pushes a realtime event for every changed record, load rows included.

**Records**

- **Record ids are the entity ids** (`emp-001`, `alloc-<uuid>`): a migration widens the system `id` field's pattern and maximum length. Client-generated ids (T1.1) are sent as `id` on create.
- **Fields are named like the contracts** (`employeeId`, `validFrom`, `hourlyCost`, …). Dates and months are text fields with the contracts' patterns, not PocketBase `date` fields, which store `YYYY-MM-DD HH:MM:SS.sssZ`.
- **PocketBase has no null:** an empty relation is `""`. The record schemas map `parentId: ""` to `null` and drop PocketBase's system fields (`collectionId`, `collectionName`, `created`, `updated`), so the rest of the code sees only the T1.1 entities. Published collections get their schema in the contract (T3.1, T3.2); a team's private ones get it in its app adapter (T6.0a).
- **Seeds:** a migration reads `SEED_FILE` (`/pb/seed/data.json`, copied into the image) and inserts the team's slice. Seed allocations all get the same `seededAt` as `editedAt` (D18), and `delivery-pb` fills `employee_month_loads` from the same `load.js`.

**Capacity load (D8).** `employee_month_loads` has a unique `(employeeId, month)` index, public list and view rules, and locked write rules. After every allocation create, update or delete, a model hook recomputes that pair's row with `pb_hooks/lib/load.js`: the sum in id order, `overCapacity = sum > 1 + 1e-9`, and the causer by `(editedAt, id)`. It upserts the row, or deletes it when no effort is left. A move (D9 re-pointing) changes neither the sum nor `editedAt`. People reads and subscribes to the collection and never sees allocations.

**Access.** Auth isn't scored, so there is no login. The collections a team writes from its app have public API rules; everything else stays locked. Each team's app is the only code that writes to its instance, and the other team reads only the collections its contract publishes.

**Runtime.**

- **Image:** `infra/docker/pocketbase.Dockerfile` (D25) runs `pocketbase serve` on 8090 with `/pb_data` as its data directory and automigrate off (the full command is in [phase-3.md](phase-3.md) §3), with the healthcheck `wget` against `/api/health`.
- **Gateway:** it routes `/api/people/` to `people-pb:8090` and `/api/delivery/` to `delivery-pb:8090`, cutting the prefix with `rewrite … break` the same way it does for the remotes. The two `…/api/realtime` locations turn buffering off and use a long read timeout.
- **Clients:** the SDK base URLs are `/api/people` and `/api/delivery` on the page's origin, standalone and hosted alike.
- **Dev:** the Rsbuild dev servers proxy `/api` to the gateway on 8080, so dev runs PocketBase in Docker too (`docker compose up -d gateway people-pb delivery-pb`). PocketBase's admin dashboard isn't routed.

**Pricing stays client-only (D7).** `delivery-pb` stores person-months and never reads rates. Delivery's app reads `rate_records` and `employees` from `people-pb` and subscribes to `rate_records`.

### Repository map (target)

```text
apps/
  shell/            # host: nav, currency, user, runtime remote loader, error boundaries, first-segment routing
                    # every app is laid out by Feature-Sliced Design (D28): src/app, pages, widgets, features,
                    # entities, shared (each layer only once it has a slice); its own React Router instance
                    # in src/app (D22), and its client adapters over the pocketbase SDK in src/shared/api (T5.0a, T6.0a)
  people/           # remote: register, employee detail, rate history editor
  delivery/         # remote: WBS tree, staffing grid
packages/
  host-contract/    # HostContext, RemoteModule, Currency, ActiveUser + shared primitives (IsoDate, IsoDateTime, Month)
  people-contract/  # EmployeeId, RateRecordId, WeeklyHours, schemas, events, conformance fixture
  delivery-contract/ # ProjectId, BreakdownItemId, AllocationId, EmployeeMonthLoad, events
  delivery-domain/  # pure TS: calendar, rates timeline, pricing, units, rounding, roll-up, capacity, tree ops,
                    # grid view model (D35), input parsing (D34)
  people-domain/    # pure TS: rate-history validation, search, input parsing (D34)
  ui/               # platform-owned presentational primitives in src/components/<Name>/ + tokens.css,
                    # CSS Modules (bundled into each app)
services/
  people-pb/        # PocketBase config: pb_migrations (employees, rate_records, seed), pb_hooks, tests
  delivery-pb/      # PocketBase config: pb_migrations (projects, breakdown_items, allocations,
                    # employee_month_loads, seed), pb_hooks (editedAt, load), tests
infra/
  nginx/            # gateway config
  docker/           # Dockerfiles (three apps, one shared PocketBase image), entrypoints (config.json, <base href>)
  scripts/          # reset.sh (T3.8)
docker-compose.yml  # apps, services, gateway (T2.9)
package.json, pnpm-workspace.yaml (catalog), tsconfig.base.json
rslint config (D24), .prettierrc, .nvmrc, .dependency-cruiser.cjs (D23) and its test
docs/               # brief, plan, ADRs
```

---

## 4. Phased plan and task list

### Phase 0 — Foundation

- [x] **T0.0** **Host tooling, before anything else.** Node 24 LTS on the host (pinned by `.nvmrc`, so `nvm use` picks it), with pnpm through Corepack (`corepack enable`; the pnpm version comes from `packageManager`, T0.1). No tooling container and no dev container: Docker is only for running the suite (T2.9), which adds `docker-compose.yml`.
- [x] **T0.1** Pin versions: `"packageManager": "pnpm@<current stable, exact version>"` and `"engines": { "node": ">=24" }` in the root `package.json`, and `node:24` base images in every Dockerfile. Initialise the pnpm workspace with root `tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`. Define a pnpm catalog in `pnpm-workspace.yaml` for the versions every package must share: `zod` (D21), `react`, `react-dom` and `date-fns`.
  - **Workspace packages ship TypeScript source, with no build of their own:** each `packages/*` `package.json` has `"exports": { ".": "./src/index.ts" }`. Rsbuild compiles them inside each app (T2.8a), and Rstest in tests. PocketBase services don't use them (D25).
  - **`pnpm typecheck`** = `pnpm -r typecheck`. Every package and app has `"typecheck": "tsc --noEmit"`, with a `tsconfig.json` that extends `tsconfig.base.json`.
- [x] **T0.2** Set up **Rslint** (D24), **Prettier** and **dependency-cruiser** (D23). `pnpm lint` runs `lint:code` (Rslint), `format:check` (Prettier) and `lint:deps` (dependency-cruiser).
  - **Rslint config:** the built-in plugins `@typescript-eslint`, `react-hooks`, `rstest` and `jsx-a11y`, in array form.
    - `@typescript-eslint`: the strict type-checked set, with `no-explicit-any` and `no-unsafe-*` as errors.
    - `react-hooks`: `rules-of-hooks` and `exhaustive-deps` as errors.
    - `rstest`: for `*.test.ts(x)`.
    - `jsx-a11y`: recommended rules.
    - No `import` rules, and no formatting rules (Prettier formats).
  - **Prove Rslint works here.** Add purposely bad code, confirm each rule fires, then remove it:
    1. `any` and an unsafe member access inside a **workspace package**. This shows type information works across pnpm's workspace links.
    2. A conditional hook call, and a missing effect dependency.
    3. The VS Code extension shows the same errors in the editor.

    If one fails and can't be fixed in config, switch to the ESLint fallback (D24) and record why in the ADR.
  - **dependency-cruiser** for the boundary rules:
    - **Who owns what**, by path:
      - **People team:** `apps/people`, `services/people-pb` (`services/people-api` before ADR 032), `packages/people-domain`, `packages/people-contract`
      - **Delivery team:** `apps/delivery`, `services/delivery-pb` (`services/delivery-api` before ADR 032), `packages/delivery-domain`, `packages/delivery-contract`
      - **Platform:** `apps/shell`, `packages/ui`, `packages/host-contract`
    - **The rules**, each a `forbidden` rule with severity `error` and a name that explains itself in the failure message:
      1. **`no-cross-app`:** an app never imports another app. Use group matching, e.g. `from: { path: '^apps/([^/]+)/' }`, `to: { path: '^apps/', pathNot: '^apps/$1/' }`.
      2. **`no-cross-team-internals`:** People's paths never import `packages/delivery-domain`, `services/delivery-pb` or `apps/delivery`, and Delivery's paths never import People's equivalents. Only `*-contract` packages and `ui` cross team lines.
      3. **`shell-no-team-internals`:** `apps/shell` imports no team's domain package, service or app. It loads remotes only at runtime through MF.
      4. **`app-to-own-service-types-only`:** `apps/people` → `services/people-api` (and the Delivery equivalent) is allowed only as a type-only import, for Hono's typed client: forbid it with `dependencyTypesNot: ['type-only']`. *Dropped by ADR 032: PocketBase services have no TypeScript types to import, so apps never import `services/` at all. T3.4 replaces it with a plain `apps-no-services` rule.*
      5. **`contracts-are-leaves`:** `packages/*-contract` import only `zod` and other contract packages. For example, `delivery-contract`'s `EmployeeMonthLoad` uses `EmployeeId` from `people-contract`, and every contract may use `host-contract`'s primitives. Never a domain package, service, app or `ui`. `no-circular` keeps the contracts acyclic.
      6. **`domain-is-framework-free`:** `packages/*-domain` never import `react`, `apps/` or `services/`.
      7. **`services-no-ui`:** `services/` never import `apps/` or `packages/ui`.
      8. **`ui-deps`:** `packages/ui` imports no workspace package and no npm package except `react`, `react-dom` and `clsx`.
      9. **`no-circular`:** no import cycles anywhere.
      10. **`not-to-unresolvable`:** every import resolves.
    - **Resolve against real paths:** set `tsConfig` to the root `tsconfig.base.json` and keep `preserveSymlinks: false` (the default), so pnpm's workspace symlinks resolve to `packages/…` and the path rules match.
    - **Prove each rule fails:** a fixture test (or a one-off check recorded in the ADR) adds a forbidden import for each rule and confirms `pnpm lint:deps` exits non-zero with that rule's name.
- [x] **T0.3** Set up Rstest (`@rstest/core`) as separate projects:
  - `domain` (domain and contract packages, plus each app's `src/data/` adapters, which need no DOM; `src/shared/api/` since T4.0b, D28) and `services`, in Node with no DOM.
  - `components` later, in jsdom, reusing each app's Rsbuild config so the React plugin and CSS Modules settings apply.
  - **Confirm on the pinned Rstest version:**
    - multi-project config, or one config per package run from the root
    - jsdom
    - coverage
    - `@testing-library/jest-dom` matchers through `expect.extend`
    - reuse of the Rsbuild config

    If any of these is missing, record the workaround in D14.
  - Add `expect-type` for type-level tests.
- [x] **T0.4** Write ADRs D1–D25, in brief.
- [x] **T0.5** Make the first real commit. From here on, commit per task with meaningful messages.

**Exit check:** `pnpm lint`, `pnpm typecheck` and `pnpm test` run green on the host.

### Phase 1 — Domain core (pure TS, test-first)

This phase delivers the reference calculation first. Domain logic goes in `packages/delivery-domain` or `packages/people-domain` (T1.13). The shared basic types go in the contract packages (T1.1). Nothing imports React.

- [x] **T1.1** **Primitive types**, each with a zod schema that parses into the branded type. They're placed by owner, so no team imports another team's domain package (T0.2). Create the three contract packages now with just these types; T3.1–T3.3 complete them.
  - **`host-contract`** (platform, used by everyone): `IsoDate` (`YYYY-MM-DD`), `IsoDateTime`, `Month` (`YYYY-MM`), `CurrencyCode`.
  - **`people-contract`**: `EmployeeId`, `RateRecordId`, and `WeeklyHours = 40 | 32 | 20` as a const tuple, so it's easy to extend live.
  - **`delivery-contract`**: `ProjectId`, `BreakdownItemId`, `AllocationId`.
  - **`delivery-domain`**: the branded units `PersonMonths`, `Hours`, `Money` (EUR), `Percent`. They're Delivery's concern and never leave its domain.
  - **Done beyond the list above:** the contracts also hold the entity schemas (`Employee`, `RateRecord`, `Project`, `BreakdownItem`, `Allocation`, `EmployeeMonthLoad`), because the domain code can't be typed without them (ADR 028).
  - **New ids:** keep the seed ids as they are. New records get `<prefix>-<uuid>` (`rate-`, `wbs-`, `alloc-`, using `crypto.randomUUID()`; employees are never created or deleted, D16), **generated by the client**, so an optimistic change set (T1.12) can reference a record before the server confirms it. The id schemas accept both forms, and services reject duplicates with 409. Id order is only D18's deterministic tiebreak, so mixing seed ids and UUIDs is fine.
- [x] **T1.2** **Calendar.**
  - `workingDaysIn(month)` counts Mon–Fri with no holidays.
  - `workingDaysBetween(from, toExclusive)`.
  - `monthsBetween(start, end)`.
  - Use `date-fns` with `@date-fns/utc` (D20), confined to this calendar module. Its inputs and outputs are `IsoDate` and `Month` strings, never `Date` objects.
  - Tests run under at least two `TZ` settings (e.g. `UTC` and `Pacific/Auckland`) and must give identical working-day counts, including the reference 22 / 8 / 14 split.
- [x] **T1.3** **Rate timeline.**
  - `sliceMonth(month, rates) → RateSlice[]`, where `RateSlice = { from, toExclusive, workingDays, hourlyCost | null }`.
  - Rules: `validFrom` is inclusive, the last rate is open-ended, and N changes give N+1 slices.
  - Days before the first rate are unpriced slices.
- [x] **T1.4** **Person-month and units.**
  - `personMonthHours(weeklyHours, month) = weeklyHours × wd / 5`.
  - Conversions between PM, hours, % and cost. Note that **% of capacity = PM × 100** for every person, because a PM is already person- and month-specific. So % is additive across rows just like PM.
  - `blendedRate(month, rates) = Σ(wdᵢ × rateᵢ) / Σwd` over the priced days. It's defined even for empty cells. This is the displayed rate.
  - Unpriced slices (days before the first rate) cost 0 (D17).
  - Cell cost = Σ slices of `wdᵢ × hoursPerDay × rateᵢ`.
- [x] **T1.5** **€ edit inverse.** Convert the entered amount from the display currency to EUR (`amount ÷ perEur`, D11). Then EUR ÷ blended rate gives hours, which convert to PM.
  - Reject the edit with a reason when the month is fully unpriced (rate 0, which would divide by zero).
  - Reject it too when the month is partially unpriced (D17). Put both rules in `euroEditRate(month, rates) → Result<Rate, 'unpriced' | 'partiallyPriced'>`, the single place the future option would change.
- [x] **T1.6** **Cell state as a discriminated union**: `{ kind: 'priced' } | { kind: 'partiallyPriced' } | { kind: 'unpriced' }`, plus an `overCapacity` flag. The UI renders the marker from this state.
  - `partiallyPriced`: the first rate starts inside the month, and the days before it cost 0 (D17).
  - `unpriced`: the whole month is before the first rate, so it costs 0.
- [x] **T1.7** **Reference test**, the gate for everything else. For A. Okafor, March 2026, 0.5 PM, assert:
  - 22, 8 and 14 working days
  - 176.00 h per PM
  - 88.00 h
  - 4.00 h per day
  - €7,880.00
  - 50.0%
  - €89.5455/h blended rate
  - a € edit of 7,880 that round-trips to 0.5 PM (within 1e-9, the floating-point allowance) and displays as `0.50`
- [x] **T1.8** **Rounding.**
  - `formatUnit(units, unit)` formats a value **already rounded** to whole display units (from `roundGrid`, or from single-value rounding outside the grid). It never rounds grid numbers itself. Precision: hours 2 dp, PM 2 dp, % 1 dp, cost 2 dp.
  - Rates display at **4 dp** (`€89.5455/h`), as the reference calculation requires.
  - `largestRemainder(values, dp, targetTotal) → rounded[]`, whose sum equals the rounded target exactly. This is the 1-D reference: `roundGrid` on a single row must give the same result.
  - Work in **integer display units** (0.01 for hours, PM and €; 0.1 for %). Snap float noise before taking floor or ceil: if a value is within 1e-6 display units of an integer, treat it as that integer. A typed `0.33` then displays as `0.33`.
  - Round each unit's **own exact values**. Never convert rounded PM into hours.
  - **Cost is rounded in the display currency:** convert the exact EUR values with the shell's `perEur` (D11) **before** `roundGrid`, never after. Converting rounded EUR would break both the totals and the one-step guarantee.
- [x] **T1.9** **Grid reconciliation: `roundGrid` controlled rounding (D19).**
  - **Inputs:** the project tree (WBS nodes, with person rows under leaves), the months, the exact values in display units, and the unit.
  - **Constraints:** for every node and month, and for every node's Total, the number of leaf cells rounded up must make the displayed sum the floor or ceil of the exact sum.
  - **Network:** source → month-wise tree (project-month → parent-month → … → leaf cell) → row-Total tree (leaf row → parent Total → project Total) → sink. Each sum is an edge with lower and upper bounds, and each leaf cell is a 0/1 edge (0/0 when the value is exact).
  - **Solve** a min-cost feasible flow with lower bounds (successive shortest paths; the graph is tiny). The cost of rounding a cell up is `1 − 2·remainder`. Break ties deterministically by row order and then month, so the display doesn't flicker.
  - **Output:** displayed leaf cells. Parent cells and Totals are their sums, and by construction each is within one step of its exact value.
  - **Done as:** the cost above needed a first level, "a sum that isn't at its nearest step costs 1", for a single row to equal `largestRemainder` (ADR 027).
  - **Fail loudly:** if no solution is found, throw. That would mean a bug in the network, since a solution always exists.
  - **Tests:**
    - the §3.6 example table (all additions hold)
    - a single row equals `largestRemainder`
    - hand-made cases where B drifts (D19 rationale), which `roundGrid` must get right
    - property tests in T1.14
- [x] **T1.10** **Roll-up.** Derive parent rows from children. They are read-only. Exact values are summed, never rounded ones. The displayed parent values come from `roundGrid` (T1.9), not from rounding these exact sums one by one.
- [x] **T1.11** **Capacity.**
  - Σ PM per `(employee, month)` across **all projects**.
  - `overCapacity = sum > 1 + ε`, with ε = 1e-9 PM. It's a floating-point allowance only, as the brief says of its 0.01 tolerance.
  - `causingAllocation` is the contributing allocation with the latest `editedAt`, ties broken by the highest `id` (D18). One comparator, used by the grid and mirrored once by `delivery-pb`'s load hook (D8).
- [x] **T1.12** **Tree operations** as pure functions returning `Result<ChangeSet, DomainError>`. A `ChangeSet` lists the records to create, update and delete, so the server applies it atomically and the client applies the same set optimistically. Add `applyChangeSet(state, changeSet)`.
  - create, rename, move (with cycle and depth ≤ 3 checks), delete.
  - A move to another project returns a `crossProjectMove` error (D15).
  - Delete reports how many allocations it removes.
  - Add-child-to-leaf moves the allocations (D9).
  - Moving onto a leaf that has allocations follows the same rule.
- [x] **T1.12a** **Allocation rules** as a pure validator, run by the grid before every allocation write (the unique index and `amount ≥ 0` are also enforced by `delivery-pb`): leaf only, month within the project span, `amount ≥ 0`, one per `(item, employee, month)`.
- [x] **T1.12b** **Invariant checker**: report allocations on non-leaf or missing items, references to unknown employees, and depth or cycle violations. The service runs it at startup and the UI uses it to show "orphaned" rows.
- [x] **T1.13** **People domain.** Rate-history validation:
  - unique `validFrom` per employee
  - `hourlyCost > 0`
  - retroactive add, correct and remove are all allowed
  - flag when a removal or change would leave allocated months unpriced. People doesn't see allocations (D8), so this check takes the employee's allocated months from the `delivery-contract` load feed as input.
- [x] **T1.14** **Property tests** with fast-check:
  - unit round-trip leaves stored PM unchanged
  - largest remainder always sums to the target
  - `roundGrid` on random trees and values (including ±10% stress values like € edits): every displayed number is within one step of its exact value, every row Total equals the sum of its cells, every parent cell equals the sum of its displayed children, and the result is deterministic
  - the causer is always a contributor, and no contributor has a later `(editedAt, id)` (D18)
  - slices' working days sum to the month's working days
  - in fully priced months, Σ slice costs equals hours × blended rate
  - in partially unpriced months, cost equals the cost of the priced slices alone, and `euroEditRate` returns `partiallyPriced`

**Exit check:** all domain tests pass, the reference test is green, and coverage of `delivery-domain` is about 100% of branches.

### Phase 2 — Walking skeleton: three federated builds in Docker

This proves the micro-frontend mechanics before any features are built.

> **Runtime interface.** The values the apps, the containers and the data services share (names, ports, routes, volumes, `config.json`) are fixed up front in ADR 029; its service rows were replaced by ADR 032 when Phase 3 was re-planned on PocketBase. T3.3 was finished with the skeleton, which needed it. T3.7 (client adapters) moved to T5.0a and T6.0a, where the screens that use them are built. T2.9 has no stub services: the gateway answers every `/api/…` path with a JSON 404 until T3.4 adds the PocketBase routes.

- [x] **T2.1** Scaffold `apps/shell`, `apps/people` and `apps/delivery` with Rsbuild, React 18, `@rsbuild/plugin-react` and `@module-federation/rsbuild-plugin`. Remove all template boilerplate.
- [x] **T2.2** Configure MF in the remotes:
  - Use `pluginModuleFederation({ name, filename: 'remoteEntry.js', exposes, shared })`, exposing `./App` and `./mount`.
  - Share `react` and `react-dom` with `singleton: true` and `requiredVersion`. **Don't** share `react-router` (D22).
  - Bootstrap asynchronously through `index.ts → import('./bootstrap')`, so shared modules are negotiated before React loads.
  - **The shell** also uses `pluginModuleFederation`, with **no `remotes`** (they're registered at runtime, T2.4) but the same `react` and `react-dom` singleton `shared` config, and the same async bootstrap.
- [x] **T2.3** **Standalone and hosted from one build.**
  - First write `host-contract`'s `HostContext` and `RemoteModule` (the T3.3 content), because the skeleton needs them. T3.3 then only reviews and finalises them.
  - The remote's `index.html` boots `mount()` with a standalone `HostContext`: default currency, a stub user, `basePath` set to the remote's own path (e.g. `/remotes/people`), and a `navigate` that opens other apps' standalone URLs (D22).
  - The same build's `remoteEntry.js` is what the shell loads.
- [x] **T2.3a** **React Router in each app (D22).**
  - Add `react-router` (v7) to each app separately. It's deliberately **not** in the shared pnpm catalog and **not** in MF `shared`, so each app bundles and upgrades its own copy.
  - **Shell:** `createBrowserRouter` with `/people/*` and `/delivery/*` (each renders that remote's panel host) and `/` → `<Navigate to="/people" replace />`. It reads only the first segment.
  - **Remotes:** `createRouter(basePath)` in `src/routing/` returns `createBrowserRouter(routes, { basename: basePath })`. The app renders `<RouterProvider>` in both modes. Hosted, the `basePath` comes from `HostContext`; standalone, it's the remote's own path.
  - **Typed params:** parse `useParams()` values with the contract schemas into branded ids (`EmployeeId`, `ProjectId`). An invalid or unknown id renders an inline "not found" view, never a crash.
  - **Shell navigation:** `HostContext.navigate(to)` uses the shell router's `navigate`, then dispatches `new PopStateEvent('popstate')`. A remote that's already mounted then re-reads the URL, e.g. when the nav link `/people` is clicked while `/people/emp-003` is open. The shell's own nav links go through the same function.
  - Remotes never call `pushState` or their router's `navigate` outside their `basePath`; they use `HostContext.navigate` instead.
  - **Tests** (Rstest + Testing Library, the first use of the `components` project from T0.3, so set it up here): `createMemoryRouter` with the same route objects. Cover register → detail → back, an unknown id, and that the shell's `navigate` resyncs a mounted remote.
- [x] **T2.4** **Runtime remote resolution.**
  - The shell has no remotes in its bundle config.
  - At boot it fetches `/config.json`, then calls `registerRemotes` and `loadRemote('people/App')`.
  - The container entrypoint writes `config.json` from env (`PEOPLE_REMOTE_URL`, `DELIVERY_REMOTE_URL`, FX table).
  - **The public path is resolved at runtime too.** A remote's chunks and CSS must resolve relative to wherever its `remoteEntry.js` was loaded from, not a prefix baked in at build time. Use `output.assetPrefix: 'auto'` in each remote. Verify by serving one remote build from a different path than it was built for.
  - **Deep-link reloads must load assets too (D22).** At `/people/emp-003` or `/remotes/people/emp-003`, script and CSS URLs in `index.html` must not resolve relative to the current path; a reference like `./static/…` would become `/people/static/…`. Use absolute asset URLs for the shell. For a remote's standalone `index.html`, set a `<base href>` at container start from the runtime config (the entrypoint already writes `config.json`), so the build stays path-independent. Verify a reload on a deep link in both modes, together with the different-path check above.
- [x] **T2.5** **Isolation on failure.**
  - Wrap each panel in `Suspense` and an `ErrorBoundary`, covering both load failures (network or 404 on `remoteEntry`) and render or runtime errors.
  - Show an in-place message with a retry. The nav and the other panel keep working.
  - Add a load timeout.
- [x] **T2.6** **Break switch.** Give at least two ways to trigger failure:
  1. `docker compose stop people`
  2. `?break=people`, or a shell dev toggle that registers a bogus URL
  3. optionally, `PEOPLE_REMOTE_URL=…/nope` in env
- [x] **T2.7** **Singleton proof.** Show a shell debug readout or log of `React.version` and an identity check across the three apps. Add a test or check that hooks work across the boundary.
- [x] **T2.8** **CSS Modules in all three apps.**
  - Configure each app's Rsbuild config:

    ```ts
    // apps/people/rsbuild.config.ts
    plugins: [pluginReact(), pluginTypedCSSModules(), pluginModuleFederation({ /* … */ })],
    output: {
      assetPrefix: 'auto',
      cssModules: {
        localIdentName: 'bl-people-[local]-[hash:base64:5]',
        exportLocalsConvention: 'camelCaseOnly',
      },
    },
    ```
  - Add `clsx` to each app and to `ui`.
  - Commit the `.d.ts` files generated by `@rsbuild/plugin-typed-css-modules`, or generate them before `typecheck` runs.
  - Verify all of these:
    1. Production builds extract the CSS to files.
    2. **When hosted, an exposed remote module brings its CSS with it**, and the CSS loads from the remote's own origin and path.
    3. Class names carry the app prefix, including classes from `ui`.
    4. A typo in a class name fails `typecheck`.
- [x] **T2.8a** **Create `packages/ui`.**
  - Set up `package.json` (React as a `peerDependency`, `clsx` as a dependency), `tokens.css` scoped to `[data-baseline-root]`, and the typed `vars` map.
  - Wire it into the three apps as `workspace:^`, compiled from source by each app's Rsbuild. Check that the workspace sources get the JS and CSS Modules rules; add them to `source.include` if they don't.
  - Start with only what the skeleton uses: `Button`, `InlineMessage`, `Spinner`, `ErrorBoundary`.
  - Prove four things:
    1. A remote using `ui` renders identically standalone and hosted.
    2. The shell can override a token on a panel container.
    3. People's and Delivery's copies of `ui` emit **different** class names.
    4. No styles leak between apps.
- [x] **T2.9** **Docker.**
  - Multi-stage Dockerfiles for the apps: a `node:24` build stage, then `nginx` serving the static output. The build context is the repo root, because the apps compile workspace packages from source.
  - The data services' image, volumes and routes come with them in T3.4 (ADR 032).
  - Gateway nginx on 8080 with the app routes from the plan §3 diagram.
  - **SPA fallback (D22):** `/`, `/people/*` and `/delivery/*` fall back to the shell's `index.html`; `/remotes/people/*` and `/remotes/delivery/*` fall back to that remote's own `index.html` (`try_files $uri /…/index.html`). `remoteEntry.js`, chunks, `config.json` and `/api/*` must never fall back.
  - `docker-compose.yml` with healthchecks.
  - No Node on the host.

**Exit check:** from a clean clone, `docker compose up` serves the shell at `localhost:8080` with both remotes mounted, and each remote opens standalone. Stopping one remote leaves the shell alive with an in-place error.

### Phase 3 — Data services, contracts and transport

Built from [phase-3.md](phase-3.md): the exact collections, hooks and values, and the three `builder` briefs (runtime, People, Delivery), run one after another.

- [x] **T3.1** Write `people-contract` v1:
  - the base path (`/api/people`), collection names (`employees`, `rate_records`) and realtime topics
  - record schemas that parse a PocketBase record into `Employee` and `RateRecord`, dropping system fields. Writes send the entity's own fields, so there are no separate write schemas
  - the effective-dating rule in prose, and a conformance fixture: A. Okafor's records and the expected slices
- [x] **T3.2** Write `delivery-contract` v1: the base path (`/api/delivery`), the `employee_month_loads` collection and topic, and a record schema that parses into `EmployeeMonthLoad` (`employeeId`, `month`, `allocatedPersonMonths`, `overCapacity`, `causingAllocationId`). Only `employee_month_loads` is published. Delivery's own collections (`projects`, `breakdown_items`, `allocations`) are parsed in its app adapter (T6.0a), which maps `parentId: ""` to `null`.
- [x] **T3.3** Finalise `host-contract` (started in T1.1 and T2.3): `HostContext` (`currency`, `activeUser`, `basePath`, `navigate(to)`), `RemoteModule` (`mount`, `update`, `unmount`), `RemoteAppProps` (`{ ctx: HostContext }`), `Currency`, `ActiveUser`. The contract has **no React dependency** (T0.2 rule 5): the shell types the loaded `./App` as `ComponentType<RemoteAppProps>`, and each remote types its own `App` the same way. Document that a remote's own navigation stays under `basePath`, and that anything outside it goes through `navigate` (D22).
- [x] **T3.4** Add the **PocketBase runtime** (platform, D25). It starts by checking the PocketBase rows of the assumptions table on the pinned release, and records the results in ADR 033:
  - `infra/docker/pocketbase.Dockerfile`: the pinned release for `TARGETARCH`, checksum checked, build arg `SERVICE`, `docs/data.json` copied to `/pb/seed/data.json`, and the `serve` command from phase-3.md §3
  - compose services `people-pb` and `delivery-pb` with volumes `people-data` and `delivery-data` at `/pb_data`, and a healthcheck on `/api/health`. Nothing is published except the gateway
  - gateway routes `/api/people/` and `/api/delivery/` with the prefix cut, and the realtime locations with buffering off and a 1 h read timeout; ADR 031's `/api` note is updated to match (ADR 032 already records the change to ADR 029)
  - each service's first migration, `001_settings.js`: enable the batch API with room for the largest change set (a subtree delete). Each collection widens its own `id` field when it is created (T3.5, T3.6)
  - `services/people-pb` and `services/delivery-pb` as private workspace packages, for their tests only. Update `.dependency-cruiser.cjs`: the new paths in the ownership groups, rule 4 replaced by `apps-no-services`, and `services-no-ui` kept. Update the `services` Rstest project to `services/*/test/**/*.test.ts` (without `test/integration/`), add `rstest.integration.config.ts` and `pnpm test:integration`, and make `pnpm lint` accept the PocketBase globals in the services' JS
- [x] **T3.5** Build **`people-pb`**:
  - Collections `employees` (`name`, `role`, `weeklyHours`; read-only through the API, so no employee is created, changed or deleted, D16) and `rate_records` (`employeeId` relation, `validFrom`, `hourlyCost`; unique `(employeeId, validFrom)`).
  - Seed from `data.json`: employees and rateRecords only.
  - No hooks: every People rule is a field, an index or a `people-domain` check in the app.
- [x] **T3.6** Build **`delivery-pb`**:
  - Collections `projects` (read-only through the API), `breakdown_items` (`projectId`, `parentId` relations, `name`), `allocations` (`breakdownItemId` relation, `employeeId` text, `month`, `amount ≥ 0`, `editedAt`; unique `(breakdownItemId, employeeId, month)`) and `employee_month_loads` (D8).
  - Seed from `data.json`: projects, breakdownItems and allocations with `editedAt = seededAt`, then the load rows.
  - Hook `editedAt` (D18): on create, and on an update that changes `amount`, set it to the server's `new Date().toISOString()`. Otherwise keep the stored value, whatever the client sent. Moves and D9 re-pointing don't change it.
  - Hook load (D8): recompute the `(employeeId, month)` row after each allocation write, inside the transaction, with `pb_hooks/lib/load.js` (the rule) and `pb_hooks/lib/refresh.js` (the read and upsert). Update the header comment of `delivery-domain`'s `capacity.ts`, which still names `delivery-api`'s /load.
  - No other server logic: clients send every tree and allocation write as one batch of a domain change set (plan §3, Service design; the adapter does this in T6.0a).
- **T3.7** *Moved out of Phase 3 on 2026-10-07, so Phase 3 is complete:* the client adapters are built per app, next to the screens that use them, as T5.0a (People) and T6.0a (Delivery).
- [x] **T3.8** Add **reset to seed**: `docker compose down -v`, plus `infra/scripts/reset.sh`. The script stops `people-pb` and `delivery-pb`, empties each `/pb_data` volume with `docker compose run --rm --no-deps --entrypoint sh <service> -c 'rm -rf /pb_data/*'`, and starts them again from an `EXIT` trap, so a failed reset doesn't leave them down. The migrations re-seed on that start. Document both in ADR 031.
- [x] **T3.9** Write **service tests**:
  - **Unit (Rstest `services` project, Node):** `pb_hooks/lib/*` on its own. The key one is a fast-check property test, over random allocations with ties in `editedAt`, that `load.js` gives the same rows as `delivery-domain`'s `loadsOf` (D8, D18).
  - **Integration (`pnpm test:integration`, a separate Rstest project against the compose stack through the gateway, using the SDK):**
    - seed counts match the brief's Fixtures section
    - a unique-index clash returns the error ADR 033 recorded (the adapter maps it to `conflict` in T5.0a and T6.0a)
    - a batch with one failing operation leaves nothing behind
    - adding a child under a leaf and re-pointing its allocations commits as one batch (D9)
    - a write reaches a realtime subscriber
    - `editedAt` changes on an effort edit and not on a move, and a user edit beats the seed rows as causer in `employee_month_loads` (D18)

**Exit check** ([phase-3.md](phase-3.md) §6): editing a rate through the PocketBase API (via the gateway) emits a realtime event that a test subscriber receives, an allocation edit updates `employee_month_loads` in the same transaction, and the data survives `docker compose restart`.

### Parallel lanes (Phases 4–6)

Phases 4, 5 and 6 run in parallel lanes, each one `builder` in its own worktree, branched from the latest local `main`. A task starts as soon as everything in its *Needs* column has merged. At most four subagents run at once ([phases-4-6.md](phases-4-6.md) §2). Each phase still has its exit check. Phases 7, 8 and 9 don't use lanes: they run one after another once all three exit checks have passed.

**Lanes and the paths each owns.** A lane changes only its own paths, so lanes rarely conflict.

| Lane | Owns | Tasks |
| --- | --- | --- |
| **PL** Platform | root configs (`.dependency-cruiser.cjs` and its test, `rstest*.config.ts`, Rslint config), `docs/adr/`, `packages/host-contract`; for T4.0c only, the three apps' `src/` and Rsbuild configs | T4.0a, T4.0b, T4.0c (all three apps, one builder) |
| **UI** Shared UI | `packages/ui`, and the `components-ui` project in `rstest.config.ts` | T4.6 |
| **SH** Shell | `apps/shell` | T4.1–T4.5 |
| **PD** People domain | `packages/people-domain` | T5.0, T5.6 |
| **PA** People app | `apps/people` | T5.0a, T5.1–T5.5 |
| **DD** Delivery domain | `packages/delivery-domain` | T6.0 |
| **DA** Delivery app | `apps/delivery` | T6.0a, T6.1–T6.13 |

**Files every lane may touch,** kept to small, rebase-friendly edits: `pnpm-lock.yaml` (on a conflict, rebase and run `pnpm install`), `docs/plan.md` (each lane ticks only its own tasks) and `docs/screens.md` (only to record a change agreed with the user).

**What each task needs**

| Task | Needs | Can start |
| --- | --- | --- |
| T4.0a ADRs, T4.6 `ui`, T5.0 + T5.6, T6.0 | — | now, all in parallel |
| T4.0c + T4.0b (restructure and FSD rules, one builder) | — | now |
| T4.1, T4.3, T4.4 | T4.0c | |
| T4.2, T4.5 | T4.0c, T4.6 | |
| T5.0a | T4.0c | |
| T5.1 | T5.0a, T4.6, T5.0 | |
| T5.2, T5.4 | T5.1 | in parallel with each other |
| T5.3 | T5.2, T5.6 | |
| T5.5 | T5.4 | |
| T6.0a | T4.0c | |
| T6.1 | T6.0a | |
| T6.2 | T6.1, T4.6 | |
| T6.4 | T6.2, T6.0 | |
| T6.3, T6.5–T6.10, T6.12, T6.13 | T6.4 | in parallel with each other |
| T6.11 | T6.5–T6.10 | |

**Rules that make the lanes work**

- **Domain first, outside the apps.** T5.0, T5.6 and T6.0 put every calculation the screens need into the domain packages, tested without React, so the app lanes only wire them up.
- **The grid leaves slots.** T6.4 builds the staffing grid with named slots: a cell renderer, a row-actions slot, a toolbar slot and a details slot. Each later Delivery task then adds its own FSD slice (`features/edit-cell`, `features/move-item`, `widgets/cell-details`, …) plus one wiring line, so parallel worktrees don't edit the same files.
- **Same plumbing, written twice to one spec.** People and Delivery each build their own query client, `RealtimeProvider`, repository context and `renderWithApp` (D26, D29, D30), in parallel. ADRs 036, 039 and 040 from T4.0a (D26, D29, D30) are the spec both follow (T5.0a, T6.0a); the lead compares the two once both have merged.
- **Definition of done for a screen task:** it matches its [screens.md](screens.md) section, including every state shown there, and `pnpm lint`, `pnpm typecheck` and `pnpm test` stay green. E2E scenarios come later, in Phase 8 (T8.1).

### Phase 4 — Shell

- [x] **T4.0a** **ADRs 036–047** for D26–D37, in brief (lane PL). Add them to the README's decision summary when T9.1 writes it.
- [x] **T4.0b** **FSD rules in `.dependency-cruiser.cjs`** (lane PL): `fsd-layers-import-down`, `fsd-no-cross-slice` and `fsd-public-api`, each scoped to `^apps/([^/]+)/src/`, each proved to fail in `.dependency-cruiser.test.ts` like the T0.2 rules. In the same change, move the root `rstest.config.ts` globs for the adapters from `apps/*/src/data/` to `apps/*/src/shared/api/` (the `domain` project includes them, each `components-<app>` project excludes them), since all three apps share that file. The same builder writes them right after T4.0c, once all three apps are restructured. If dependency-cruiser can't express one (see the assumptions table), stop and report it.
- [x] **T4.0c** **Restructure each app into FSD layers (D28)**, moving code without changing behaviour. One builder does all three apps (one commit per app), together with T4.0b, before the app lanes start:
  - `App.tsx`, `mount.tsx`, `bootstrap.ts(x)`, `index.ts`, `standalone.ts`, `routing/`, `host/` and the shell's `ShellContext.tsx` → `app/`
  - `screens/*Screen.tsx` → one `pages/<name>/` slice each; `RouteError` and `NotFoundScreen` → `shared/ui` (one slice can't import another, and every page uses them)
  - the shell's `layout/Nav` → `widgets/top-bar`, `remotes/RemotePanel` and `RemoteRoute` → `widgets/remote-panel`, `debug/ReactReadout` → `widgets/status-strip`, `remotes/remoteLoader` and `federation` → `shared/federation`, `config/` → `shared/config`
  - `testing/` → `shared/testing`, `debug/` (the rest) → `shared/debug`
  - Update the MF `exposes` paths, the Rsbuild `source.entry` and the T2.3a route tests. The shared Rstest globs change once, in T4.0b. Each layer and slice gets its `index.ts`; nothing else is created ahead of use.
  - Add `@tanstack/react-query`, `react-hook-form` and `@hookform/resolvers` only in the task that first uses each (T5.0a, T5.3, T6.0a, T6.3), to each app separately, and not to the catalog (D26, D27).
  - **Exit, per app:** `pnpm lint`, `pnpm typecheck` and `pnpm test` green; `docker compose up` still serves the app hosted and standalone, with deep-link reloads working.
- [ ] **T4.1** ([screens.md](screens.md) §1.1, §1.3) Add top-level navigation (People / Delivery) with the shell's React Router, matching **only the first path segment**; `/` redirects to `/people`. Pass each remote its `basePath` (`/people`, `/delivery`) and `navigate(to)` (T2.3a: router `navigate`, then a `popstate` event). The active nav item follows the first segment, including on back and forward (D22). An unknown first segment shows the shell's not-found message (screens 1.3; exists since T2.3a, keep it).
- [ ] **T4.2** ([screens.md](screens.md) §1.1) Add a display-currency switcher and an active-user picker, both `ui` `Select`s. Push changes through `update(ctx)` or props with no remount.
  - Both lists come from runtime `config.json`: the FX table (e.g. EUR, USD, GBP with fixed `perEur` values) and a short static list of users (`{ id, name }`). Auth isn't scored, so there's no login.
  - The choice is kept in `localStorage`, so it survives a reload.
- [ ] **T4.3** ([screens.md](screens.md) §1.2) Add a panel host component: loader, timeout, error boundary and retry. Reuse it for both remotes. Most of it exists since T2.5; match the mockup's wording.
- [ ] **T4.4** ([screens.md](screens.md) §1.1) Show a minimal status strip: each remote's load status and the `remoteEntry.js` URL it was loaded from (from `config.json`, so the strip shows runtime resolution at work), plus the React singleton readout from T2.7. Remote versions are left out: nothing publishes them, and adding one would change `host-contract`.
- [ ] **T4.5** Build the shell UI (nav, switchers, panel host) from `ui` primitives. Add any missing primitive to `ui` only if a remote will reuse it too.
- [ ] **T4.6** **`ui` primitives for Phases 4–6** (lane UI), built ahead so the app lanes can run in parallel. Each follows the plan §3 component rules (native element, `forwardRef`, CSS Module, `clsx`, tokens) and its layout (`src/components/<Name>/`), and has a component test of its behaviour and roles.
  - **First, the layout:** move the four existing components (`Button`, `ErrorBoundary`, `InlineMessage`, `Spinner`) into `src/components/<Name>/` with their CSS Modules and generated `.d.ts`, and point `src/index.ts` at them. `tokens.css` and `vars.ts` stay at `src/`.
  - **A place to run the tests:** today only the apps have jsdom projects, and `packages/*` runs in the Node-only `domain` project (`.test.ts`). Add a `components-ui` Rstest project for `packages/ui/src/components/**/*.test.tsx` in jsdom, with the React transform and CSS Modules settings. `ui` has no Rsbuild config of its own, so reuse the shell's, without Module Federation, like the app projects do; class names then carry the shell's prefix, so the tests assert on behaviour and roles, never class names (as T8.2 says). Add tests for the four existing components too. Two consuming apps each, from [screens.md](screens.md):

  | Primitive | What it is | Used by |
  | --- | --- | --- |
  | `TextField` | `<label>` + `<input>` with `hint`, `error` and `hideLabel`; sets `aria-invalid` and `aria-describedby`; forwards its ref to the input, so `register` works (D27). Amounts are `inputMode="decimal"` text, parsed by `parseAmount` (D34); dates use `type="date"`, search `type="search"` | People: search (screens 2.1), rate forms (screens 2.3, screens 2.4). Delivery: item name (screens 3.4), rename in place and the cell editor, both with `hideLabel` (screens 3.2, screens 3.4) |
  | `Select` | `<label>` + native `<select>`, with the same `hint`, `error` and ref forwarding | Shell: currency and user (screens 1.1). Delivery: assign person (screens 3.5) |
  | `Dialog` | native `<dialog>` opened with `showModal()` while `open` is true: title, body, actions; Esc and the close button call `onClose`, and the browser returns focus | People: remove rate (screens 2.5). Delivery: add item, move, delete, assign person (screens 3.4, screens 3.5) |
  | `StatusMessage` | an always-rendered `role="status"` line that shows the last action's result until the next one (D33) | People: rate saved (screens 2.3). Delivery: cell saved, allocations moved (screens 3.2, screens 3.4) |
  | `Table` | a styled `<table>` for lists, with a numeric-column class; not used by the staffing grid | People: register, rate history (screens 2.1, screens 2.3). Delivery: project list (screens 3.1) |
  | `PageHeader` | title, subtitle, a `back` slot and an `aside` slot. The app passes its router `Link` into `back`, because `ui` can't import `react-router` (T0.2 rule 8) | People: employee page (screens 2.3, screens 2.6). Delivery: project page (screens 3.2) |

  Not in `ui`, because only one app uses them: `CapacityBadge` (People), the unit radio group, the row-actions disclosure and everything in the grid (Delivery), and the shell's top bar and status strip.

**Exit check:** [screens.md](screens.md) §1 works hosted: nav, currency and user reach both remotes without a remount, a broken remote fails in place with a working retry, and the status strip shows each remote's URL and status. Every `ui` primitive in T4.6 has its test. The exact steps are in [phases-4-6.md](phases-4-6.md) §6.

### Phase 5 — People remote

Build the screens in [screens.md](screens.md) §2 from `ui` primitives (`PageHeader`, `Table`, `TextField`, `Button`, `Dialog`, `StatusMessage`, `InlineMessage`). Add a primitive to `ui` only when a second app needs it; until then it stays in People (`CapacityBadge` does).

- [x] **T5.0** **People domain additions** (lane PD), pure and tested, so the People screens only wire them up:
  - `rateOn(rates, date)`: the rate in effect on a date, or none (the register's *Rate today*, screens 2.1; "today" is passed in, never read inside)
  - `parseAmount(text)` (D34)
  - `formatDate` (`12 Mar 2026`, `en-GB`, D34)
  - `capacitySummary(loads)`: per employee, the months over capacity with their percent and PM (screens 2.1, screens 2.6), or "within capacity"
  - `searchEmployees(employees, query)`: case-insensitive match on name or role (screens 2.1)
  - extend T1.13's `pricingImpact` so each entry also carries the new first rate's date and the month's working days before it, as the screens 2.5 dialog shows them

- [ ] **T5.0a** **People's client adapter and data plumbing** (lane PA; moved from T3.7), in `apps/people/src/shared/api/` and `src/app/` (D28). Contracts hold no behaviour, so the app writes its own adapter from the contracts' base paths, collection names and schemas:
  - two SDK clients: `people-pb` (`employees`, `rate_records`, through `people-contract`) and `delivery-pb` (`employee_month_loads` only, through `delivery-contract`; an adapter for the other team's instance uses only that team's contract)
  - the repository interface and its SDK implementation: typed reads, change sets as batches (every write is a batch, a batch of one included, so every write takes the verified transactional path: ADR 033 c, ADR 035), error mapping to `DomainError` codes, and realtime subscriptions. Every record and event is parsed with the contract schemas
  - on top of it: the query-key factories and `useApplyChangeSet` in `shared/api` (D26); the `RealtimeProvider` (D29) and the repository context (D30) in `app/`; `renderWithApp` and the in-memory fake of the repository in `shared/testing` (D30)
  - the `pocketbase` SDK and `@tanstack/react-query` are ordinary dependencies of the app, bundled by it and kept out of MF `shared` and the catalog
  - the Rsbuild dev server proxies `/api` to the gateway (`http://localhost:8080`), so dev talks to the same PocketBase as Docker
  - tests: the adapter's parsing and error mapping, and the `RealtimeProvider`'s patching, without a server
- [ ] **T5.1** ([screens.md](screens.md) §2.1) Build the searchable register (name and role) with plain table markup (`ui` `Table`). No UI libraries. Columns: name (a link to the detail view), role, weekly hours and *Rate today*; T5.4 adds the capacity column. Show the filtered count and the no-match message. The search term lives in `?q=` (D31). It is the first screen on T5.0a's plumbing; it adds the page's loading and load-failed states (D32, [screens.md](screens.md) §4).
- [ ] **T5.2** ([screens.md](screens.md) §2.3, §2.7) Build the employee detail view at `<basePath>/:employeeId`: a `PageHeader` with the back link, name, role, weekly hours and id, and the rate history list, newest first, the rate in effect today marked *current*. Reloading the URL reopens the same employee, and back returns to the register. An unknown id shows an inline "employee not found". There is no delete action (D16).
- [ ] **T5.3** ([screens.md](screens.md) §2.3–§2.5, §4) Build the rate editor: add, correct (inline, in the row) and remove, including retroactively, with inline validation errors from `people-domain`. Removal asks in a `Dialog` and lists the months `pricingImpact` (T1.13, extended in T5.0) flags, but is never blocked. Results go to the `StatusMessage`; a failed write rolls back and shows the screens 4 message. A react-hook-form form with the three validation layers of D27; amounts parsed by `people-domain`'s `parseAmount` (D34); writes through `useApplyChangeSet` (D26). Costs are entered in the display currency and stored in EUR as `amount ÷ perEur` (D11); the `> 0` check runs on the converted value, and a correction whose displayed value is unchanged causes no write, so a round trip through another currency never nudges a stored rate.
- [ ] **T5.4** ([screens.md](screens.md) §2.1, §2.3, §2.6) Add an oversubscription badge in the register and the detail view, driven by the `delivery-contract` load feed through T5.0's `capacitySummary`. List the affected months. The detail view also says *Within capacity* when no month is over, and gives each month's percent and PM when one is.
- [ ] **T5.5** ([screens.md](screens.md) §2.2) Show a degraded state when the Delivery API is unreachable: "capacity unknown", never a crash. The load feed is the other team's data, so it never suspends or throws (D32); the state comes from the query and the realtime status (D29).
- [x] **T5.6** (lane PD, with T5.0) Format money (rates) in the host currency: convert with `HostContext.currency.perEur` and format with `Intl.NumberFormat`, in a small helper inside `people-domain`. The same module converts entered amounts back to EUR (T5.3). People can't use `delivery-domain`'s `formatUnit` (T0.2 rule 2).

**Exit check:** every state in [screens.md](screens.md) §2 works hosted, the main ones also standalone, and a rate added, corrected or removed survives a reload and a restart of `people-pb`. The exact steps are in [phases-4-6.md](phases-4-6.md) §6.

### Phase 6 — Delivery remote

Build the screens in [screens.md](screens.md) §3. The grid, cells, tree column, unit switcher and row-actions disclosure are Delivery's own components. They compose `ui` primitives where useful (a `TextField` with `hideLabel` as the cell editor, `Dialog` for the WBS actions, `Select` to assign a person), but `ui` never knows about the domain.

- [ ] **T6.0** **Delivery domain additions** (lane DD), pure and tested, so the Delivery screens only wire them up:
  - `gridView(plan, people, projectId, unit, currency)` (D35, on top of the existing `buildGrid`, `rollUp` and `roundGrid`): the project row, WBS rows and person rows in tree order, exact and displayed values from `roundGrid`, cell states and markers, and the cell-details content of T6.12. It also works without People's data: PM and % only, employee ids as names (screens 3.6, D32)
  - `rowActions(state, itemId)`: which WBS actions apply, each with its refusal reason (e.g. *Design is at the third level*), for the row disclosure (screens 3.4)
  - `moveTargets(state, itemId)`: every node of the same project, each allowed or refused with its reason (current parent, depth, cycle), for the move dialog (screens 3.4, D15)
  - `itemPath(state, itemId)`: `Project › item › item`, for the causer text (screens 3.3, D18)
  - `parseAmount(text)` and the `en-GB`, `narrowSymbol` formatting (D34)

- [ ] **T6.0a** **Delivery's client adapter and data plumbing** (lane DA; moved from T3.7): the same parts as T5.0a, in `apps/delivery`, with two SDK clients: `delivery-pb` (`projects`, `breakdown_items`, `allocations`; these private collections are parsed by schemas in the adapter, which map `parentId: ""` to `null`, T3.2) and `people-pb` (`employees`, `rate_records`, through `people-contract` only). Delivery computes capacity from its own allocations, so it doesn't read `employee_month_loads`.
- [ ] **T6.1** Build the read model on T6.0a: projects, tree and allocations from `delivery-pb`, plus a People read model (employees and rates) from `people-pb` through `people-contract`, subscribed to realtime events. One query per collection, patched by realtime (D26, D29); Delivery's own collections suspend, People's don't (D32).
- [ ] **T6.2** ([screens.md](screens.md) §3.1, §3.7, §4) Add a project selector (a `ui` `Table` of name, dates and months) that navigates to `<basePath>/:projectId`, with the page's loading and load-failed states (D32); reload keeps the project and an unknown id shows an inline message (D22). Grid months derive from the project span (see plan §1).
- [ ] **T6.3** ([screens.md](screens.md) §3.4) Build the WBS tree UI: create (under a node, and *Add top-level item*), rename in place, move (with a parent picker, no DnD library needed) and delete, reached from each row's minimal `⋯` disclosure (D36). Disabled actions and move targets show the reasons from T6.0's `rowActions` and `moveTargets`. Add child warns before it moves allocations (D9); delete counts the items and allocations it removes. Show messages for refused or moved allocations so nothing is lost silently.
  - The parent picker offers only nodes in the same project (D15).
- [ ] **T6.4** ([screens.md](screens.md) §3.2) Build the staffing grid: a project row on top, then WBS nodes with person rows under each leaf, columns are months plus a Total, and cells are hand-rolled table markup, with D36's keyboard and accessibility model. The rows and values come from `gridView` (D35). Nodes expand and collapse (all expanded on load, D31); a collapsed node keeps its sums. The label and Total columns stay in place while the months scroll sideways. Leave the slots the parallel tasks fill (plan §4, *Parallel lanes*): cell renderer, row actions, toolbar and details panel.
- [ ] **T6.5** ([screens.md](screens.md) §3.2, §3.3) Add a unit switcher (Hours / PM / % / Cost), a native radio group. Display goes through `roundGrid` (T6.10) and then `formatUnit`. Switching never writes. The unit lives in `?unit=` (D31).
- [ ] **T6.6** ([screens.md](screens.md) §3.2, §3.3, §4) Make cells editable in any unit:
  - parse with `delivery-domain`'s `parseAmount` (D34), convert to PM, save through `useApplyChangeSet` (D26). The cell keeps a local draft, not a react-hook-form form (D27); realtime changes don't overwrite it (D37)
  - in `partiallyPriced` and `unpriced` cells, € editing is disabled with the reason shown inline; hours, PM and % stay editable (D17)
  - outline the cell while it's being edited
  - save on Enter or blur, cancel on Esc
  - optimistic update with rollback on failure, and the screens 4 write-failed message
  - an unchanged value causes no write
- [ ] **T6.7** ([screens.md](screens.md) §3.5) Add a way to assign a person to a leaf (a `Dialog` with a `Select` of the employees not yet on it), which adds a person row. The row is local state (D31) until a value is saved in one of its months, which creates its first allocation; a reload before that removes it, and nothing is written for an empty row ([screens.md](screens.md) §3.5).
- [ ] **T6.8** ([screens.md](screens.md) §3.2) Make derived parent rows (the project row and every WBS row) read-only and visually distinct; their value cells aren't focusable (D36).
- [ ] **T6.9** ([screens.md](screens.md) §3.3) Add markers:
  - `†` for over capacity on **every** contributing cell in the open project, because the causer may sit in a project that isn't open. Its text names the causing assignment (`itemPath` from T6.0, D18), in the cell-details panel (T6.12) and as the marker's `title`.
  - An "unpriced" marker for months before the first rate.
  - A separate marker for partially unpriced months, with the D17 reason in the cell-details panel (T6.12) and as the marker's `title`.
- [ ] **T6.10** Compute every displayed number with `roundGrid` (T1.9, D19), once per project and unit. Only the edited cell's value is exact as typed; neighbours may move by one step.
- [ ] **T6.11** Handle performance: memoise per-cell derivations by `(allocation, rates version)`, and memoise `roundGrid` by `(project, unit, data version)`. Re-render only affected rows when a rate event arrives. How is fixed by D35: reference-stable cache records, memoised `gridView` parts, `React.memo` rows.
- [ ] **T6.12** ([screens.md](screens.md) §3.2, §3.3) Add a **cell details panel** under the grid that follows the focused cell ([screens.md](screens.md) §3.2). It is where the five reference numbers (§3.4) show in the UI, since the grid shows one unit at a time:
  - the cell's value in all four units (`0.50 PM = 88.00 h = 50.0% of capacity = €7,880.00`)
  - the person-month and hours per working day (`176.00 h (40 h/week × 22 working days ÷ 5) · 4.00 h per working day`)
  - the working days per rate slice, and the blended rate at 4 dp (`€89.5455/h`)
  - the full text of the cell's markers: the over-capacity causer (project › item path, D18), and the D17 partial or unpriced reason. The markers point at it with `aria-describedby` (D36).
  - Its content comes from `gridView` (D35), so it is tested in `delivery-domain` without React. Derived cells aren't focusable (D36), so they have no details.
- [ ] **T6.13** ([screens.md](screens.md) §3.6) **Grid with People unreachable** (D32): Delivery's own data still loads; an `InlineMessage` says People's data can't be reached; Hours and Cost are disabled in the unit switcher; person rows show employee ids; PM and % stay editable. It clears by itself when People's realtime reconnects (D29). T7.4 verifies it.

**Exit check:** every state in [screens.md](screens.md) §3 works hosted, the main ones also standalone; the reference cell shows €7,880.00 in Cost and the details panel shows all five reference numbers; edits in all four units, and every tree operation, survive a reload and a restart of `delivery-pb`. The exact steps are in [phases-4-6.md](phases-4-6.md) §6.

### Phase 7 — Cross-app behaviour

- [ ] **T7.1** A rate edited in People must update open Delivery cost cells live: a PocketBase realtime event, then the read-model update, then re-render. Verify it hosted (same page), standalone, and across two tabs.
- [ ] **T7.2** A Delivery allocation edit that tips someone over capacity must flag them in People live.
- [ ] **T7.3** A currency change in the shell must update both remotes immediately, and € editing must use the displayed currency.
- [ ] **T7.4** Kill one service or remote at a time and confirm the other keeps working with a clear degraded state.
- [ ] **T7.5** ([screens.md](screens.md) §3.2, §5) **Cross-app link:** a person name in Delivery's grid links to that employee in People, through `HostContext.navigate('/people/<employeeId>')` (D22). Hosted, the shell switches to People at that employee, and back returns to the grid. Standalone, it opens `/remotes/people/<employeeId>`. When `people-pb` is down the name is an id and still links (D32). Render it as a real `<a href>` built from the same path, with the click handled by `navigate`, so open-in-new-tab works.

**Exit check:** T7.1–T7.5 pass hosted, standalone and across two tabs, checked by hand on the composed stack; T8.1 automates them.

### Phase 8 — Verification

- [ ] **T8.1** Write Playwright E2E tests against the composed stack, run in a container: Playwright's Docker image as a compose service under an `e2e` profile, against the gateway, with one page object per screen of [screens.md](screens.md):
  - reference cell values in all four units
  - unit-switch round-trip
  - € edit
  - over-capacity flag on both sides
  - live rate propagation
  - broken-remote message
  - standalone pages
  - the reference numbers in the cell details panel (T6.12)
  - a rate entered in USD is stored as `amount ÷ perEur` and shows back unchanged (T5.3)
  - a person name in the grid opens their People page, hosted and standalone (T7.5)
  - deep links: reload `/people/emp-003` and `/delivery/prj-1`, hosted and standalone, and check the same view comes back; back and forward move between register and employee (D22)
  - partial month: remove Okafor's 2025-01-01 rate, then check March shows €5,320.00 (14 × 4 h × €95), the partial marker, and a refused € edit (D17)
- [ ] **T8.2** Add a few component tests (Rstest, Testing Library, jsdom) for cell editing and the error boundary. Keep the weight on the domain tests. Render through `renderWithApp` (D30).
  - The `components` project reuses each app's Rsbuild config, so CSS Modules resolve the same as in the app. Assert on behaviour and accessible roles, not on class names.
  - Components get an in-memory fake data client through the repository interface, with no HTTP mocking.
  - Routed views render inside `createMemoryRouter` with the app's real route objects (D22).
- [ ] **T8.2a** Audit `ui`: remove any primitive that only one app uses, or that no app uses, and move single-use ones back into that app.
- [ ] **T8.3** Do a type audit: no `any`, no unchecked casts at boundaries (schemas instead), and exhaustive `switch` with `never`.
- [ ] **T8.4** Run a clean-clone rehearsal: `git clone`, then `docker compose up`, then go through the checklist in plan §5.

### Phase 9 — Handover

- [ ] **T9.1** Write `README.md` covering:
  - how to run
  - how to break a remote (each method)
  - the repo map
  - the architecture diagram, plus the **dependency graph generated by dependency-cruiser** (`pnpm graph`, rendered as Mermaid at package level, so a reader can see that the remotes connect only through contracts) (D23)
  - a decision summary with the D7 pricing rationale argued in full
  - how to reset data
  - how to run tests
- [ ] **T9.2** Tidy the ADRs. List known limitations and open choices (the D17 future option for € edits in partial months, the D18 id tiebreak and the future `editedBy`, D19 neighbour jitter, D36 arrow-key navigation, D37 last write wins, a newly assigned person row with no values is gone after a reload (T6.7)).
- [ ] **T9.3** Prepare for the live walkthrough. Rehearse likely small changes:
  - add a weekly-hours option
  - add a public-holiday rule
  - add a fifth unit
  - change the leaf-insert policy to "refuse"
  - switch partial months to the D17 future option (€ edits through the effective rate)
  - add `editedBy` from the shell's active user and show it in the causer text of the cell-details panel (D18 future option, T6.12)
  - add a field to the contract with a version bump

  Make sure each one touches as few places as possible.
- [ ] **T9.4** Review the commit history: it should be readable and real, with no "wip" squashes hiding the evolution.

---

## 5. Acceptance checklist (maps to the brief)

- [ ] The reference calculation gives all five numbers in the UI (the cell details panel, T6.12) and in tests (§3.4).
- [ ] Months with two or more rate changes split into three or more slices (§3.3).
- [ ] Switching units and back leaves stored values unchanged (§3.5).
- [ ] Displayed totals equal the sum of displayed cells in both directions, and every displayed number is within one display step of its exact value (controlled largest-remainder rounding, D19) (§3.7).
- [ ] Parent rows are derived and read-only. Inserting a child under a leaf loses nothing (§3.8).
- [ ] Capacity is cross-project. People flags the person, and Delivery names the causing assignment. Edits are never blocked (§3.9).
- [ ] People: searchable register, and rate history that is addable, correctable and removable, including retroactively (§3.1).
- [ ] Delivery: tree create, rename, move and delete, and every leaf cell editable (§3.1). In € that excludes partially and fully unpriced months, which are refused with a reason (D17).
- [ ] A rate edit reaches Delivery with no reload (§3.1).
- [ ] A failed remote leaves the shell alive with an in-place message, and there is a documented trigger (§3.1).
- [ ] Three MF builds. Remote URLs come from container config. React is a singleton. Standalone and hosted run from one build (§4).
- [ ] No UI, table, grid or tree libraries (§4).
- [ ] `docker compose up` serves `localhost:8080` with no Node on the host (§4).
- [ ] TS strict with no `any` (§4).
- [ ] The README has run instructions, break instructions, the repo map and the pricing decision defended (§6).
- [ ] Real commit history (§6).

---

## 6. Open questions to settle while building

None remain.

Settled: moving nodes across projects (D15), deleting employees (D16), partially unpriced months (D17), "most recently edited" (D18), rounding scheme (D19), and the frontend decisions D26–D37.
