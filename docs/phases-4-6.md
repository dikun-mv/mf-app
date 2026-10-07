# Phases 4–6 handover: shell, People and Delivery screens

How to build Phases 4, 5 and 6 of [plan.md](plan.md), in parallel, with two agents: [builder](../.claude/agents/builder.md) writes the code and [verifier](../.claude/agents/verifier.md) checks it in a browser. You, the agent reading this, are the **lead**: you launch builders, review and merge their branches, run the stack, launch the verifier and tick the plan. You don't write feature code yourself.

The tasks and decisions are in plan.md (§2 D26–D37, §4 Phases 4–6 and _Parallel lanes_). The screens are in [screens.md](screens.md). This file turns them into briefs.

## 1. Keep it simple

Every brief carries these rules.

- **Build what [screens.md](screens.md) shows, nothing more.** No extra screens, settings, animations, empty-state art or "nice to have" features. If a screen needs something the plan doesn't say, the builder asks; it doesn't invent it.
- **Calculations live in the domain packages,** tested without React. Components call them and render the result.
- **Only the dependencies named here.** `@tanstack/react-query`, `pocketbase`, `react-hook-form` and `@hookform/resolvers` in `apps/people` and `apps/delivery`, each added by the brief that first uses it, never to the catalog or MF `shared`. Nothing else without the lead, and the lead asks the user.
- **React 18.** No React 19 APIs (`use`, `useOptimistic`, actions, `ref` as a prop). The `vercel-react-best-practices` skill's Next.js and server-component rules don't apply; its rendering and re-render rules do.
- **Look and feel stays small** (visual polish isn't scored, brief §2). Layout comes from screens.md. Style only through `ui`'s tokens (`var(--bl-…)`) and CSS Modules; no web fonts, CDNs, icon packs or images from the network. Brief U sets the visual language in `tokens.css`; every other brief reuses it. Use the `frontend-design` skill inside these limits: a clear, calm, consistent interface across the three apps.
- **No global stores, no new patterns.** Server state in TanStack Query (D26), forms in react-hook-form (D27), the rest in the URL or local state (D31).
- **Tests where they defend behaviour:** domain tests for every pure function, component tests for the behaviour a brief names, rendered through `renderWithApp` with the in-memory fake (D30). No E2E tests: those are Phase 8.
- **Size check.** A component file over about 200 lines, or a hook over about 80, means it does too much: split it or ask the lead.

## 2. Order

Each brief is one `builder` run in its own worktree. A brief starts when everything in _Needs_ has merged and, for UI briefs, passed verification. Up to five builders run at once.

| Brief                              | Tasks                         | Needs      | Branch               |
| ---------------------------------- | ----------------------------- | ---------- | -------------------- |
| **A** ADRs                         | T4.0a                         | `main`     | `p4/adrs`            |
| **R** restructure                  | T4.0c (all three apps), T4.0b | `main`     | `p4/restructure`     |
| **U** shared UI                    | T4.6                          | `main`     | `p4/ui`              |
| **PD** People domain               | T5.0, T5.6                    | `main`     | `p5/people-domain`   |
| **DD** Delivery domain             | T6.0                          | `main`     | `p6/delivery-domain` |
| **SH** shell                       | T4.1–T4.5                     | R, U       | `p4/shell`           |
| **P1** People data and register    | T5.0a, T5.1                   | R, U, PD   | `p5/register`        |
| **D1** Delivery data and projects  | T6.0a, T6.1, T6.2             | R, U       | `p6/projects`        |
| **P2** employee page and rates     | T5.2–T5.5                     | P1         | `p5/employee`        |
| **D2** staffing grid               | T6.4, T6.8, T6.10             | D1, DD     | `p6/grid`            |
| **D3** units, editing, People down | T6.5, T6.6, T6.13             | D2         | `p6/editing`         |
| **D4** tree operations             | T6.3, T6.7                    | D2         | `p6/tree`            |
| **D5** markers and cell details    | T6.9, T6.12                   | D2         | `p6/details`         |
| **D6** performance                 | T6.11                         | D3, D4, D5 | `p6/performance`     |

So: A, R, U, PD and DD start together. SH, P1 and D1 follow once R and U are in. D3, D4 and D5 run side by side on the grid that D2 leaves with slots. **Merge R before U**: both edit `rstest.config.ts`.

Phase exit checks (§6): Phase 4 after SH, Phase 5 after P2, Phase 6 after D6. When all three pass, stop and report to the user. Phases 7–9 run one by one later, not from this file.

## 3. Fixed values

Every brief uses these. Changing one needs the user.

| Thing                 | Value                                                                                                                                                                                                                                                                |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack                 | One compose stack, run only by the lead, from the main checkout: `docker compose up -d --build --wait`. Data back to the seed: `infra/scripts/reset.sh`                                                                                                              |
| Builders and servers  | Builders never run `docker compose` or a dev server: the dev ports (shell 3000, people 3010, delivery 3020) are fixed with `strictPort`, and parallel builders would clash. Browser checks are the verifier's                                                        |
| URLs                  | Hosted: `http://localhost:8080/people`, `/people/<employeeId>`, `/delivery`, `/delivery/<projectId>`. Standalone: `http://localhost:8080/remotes/people/…`, `/remotes/delivery/…`. Broken remote: `?break=people`                                                    |
| Config                | Currencies EUR (1), USD (1.08), GBP (0.85); default EUR. Users _Demo Planner_, _Demo Lead_                                                                                                                                                                           |
| Reference cell        | _Ledger Consolidation_ (`prj-1`) › Ledger migration › Discovery › Design, _Adaeze Okafor_ (`emp-001`), Mar 2026: 0.50 PM = 88.00 h = 50.0% = €7,880.00; 176.00 h per PM, 4.00 h per working day, 22 working days (8 at €80.00/h, 14 at €95.00/h), blended €89.5455/h |
| Over capacity at seed | _Milan Brandt_ Jun 2026 (118.0%, 1.18 PM; causer _Client Portal Rebuild › Account management › Core build › Implementation_), _Lena Okafor_ Sep 2026, and four more (plan §1)                                                                                        |
| Grid seed sums (PM)   | Project row Mar–Aug 26: 0.50, 1.30, 2.65, 4.99, 5.35, 6.40; Total 57.06. Design Jun 26: 1.29                                                                                                                                                                         |
| ADR numbers           | 036 D26, 037 D27, 038 D28, 039 D29, 040 D30, 041 D31, 042 D32, 043 D33, 044 D34, 045 D35, 046 D36, 047 D37                                                                                                                                                           |
| Skills                | Builders: `frontend-design:frontend-design` and `vercel-react-best-practices` for UI work (§1 limits apply). Verifier: `playwright-cli`                                                                                                                              |

## 4. The lead's loop

**Worktree pitfalls** (seen in Phases 2 and 3; the builder's Start section handles the first two):

1. A new worktree can start from `origin/main`, far behind local `main`. The builder resets to `main` before its first commit; check its report says so.
2. The harness deletes a worktree whose own branch is unchanged when the agent stops, and agents have lost files mid-run. Builders never switch branches and commit after every step.
3. If a worktree is gone after a stop: `git worktree prune && git worktree add <same path> <branch> && git worktree lock <path>`, then resume the builder with `SendMessage`, telling it to run `pnpm install` again.

**Per brief:**

1. **Launch** a `builder` with `isolation: "worktree"`, in the background, with the brief from §5 verbatim. Launch every brief whose _Needs_ are in.
2. **Read the report.** Base check from `main`'s tip, every task done, requests for the lead. Answer requests yourself when the plan settles them; otherwise ask the user.
3. **Name the branch** from §2 (`git branch -m <worktree branch> <name>`).
4. **Review** with the `code-review` skill at `medium` and an explicit range, `main...<branch> medium` (with a branch name alone it diffs against the stale `origin/main`). Check the brief's rules too: owned paths only, §1, the decisions it cites. Send findings to the builder with `SendMessage`; repeat until clean. After two rounds, decide yourself or ask the user.
5. **Merge** `git merge --no-ff <branch> -m "Merge <branch>: <what it adds> (<tasks>)"`. Resolve small conflicts in shared files yourself (`rstest.config.ts`, the grid's wiring lines, `pnpm-lock.yaml` by running `pnpm install`). Then run `pnpm lint && pnpm typecheck && pnpm test` on `main`; if it fails, the builder fixes it.
6. **Verify** briefs that have a _Verify_ block: `docker compose up -d --build --wait`, then `infra/scripts/reset.sh`, then launch the `verifier` with the block verbatim. Run each _Degraded_ part as its own verifier run, stopping and starting the named service around it yourself.
   - **Steps marked (needs SH) or (needs P2)** use another lane's screen. If that brief hasn't passed yet, skip them in this run and run them as a short second verifier run as soon as it has; the brief passes only when both runs do.
   - **PASS:** remove the worktree, tick the brief's tasks in plan.md, commit `Tick <tasks> after <branch> was verified`, and launch whatever this unblocks.
   - **FAIL:** send the verifier's evidence to the builder (`SendMessage`; its worktree is still there). It fixes on the same branch; review the new commits (`<last merged commit>...<branch> medium`), merge again, verify again.
7. Keep a short log in your replies to the user: what started, merged, passed or failed.

**Stop and ask the user** when a decision turns out unworkable, an assumption in plan.md's table fails, a brief needs a dependency §1 doesn't name, or a screen can't be built as drawn.

## 5. The briefs

Pass each brief verbatim as the `builder` prompt. The _Verify_ block after a brief is for the verifier, not the builder.

### Brief A: ADRs

```text
You are writing ADRs 036–047 for the frontend decisions of Phases 4–6 (T4.0a).

Follow your Start section first. The lead names your branch p4/adrs when merging.

Read: docs/phases-4-6.md §1 and §3, plan.md §2 rows D26–D37 and the T4.0a task, docs/screens.md §6,
and ADR 032 and ADR 035 for the format.

You own: docs/adr/036-*.md to docs/adr/047-*.md, and one dated "Amended 2026-10-07" note at the end of
docs/adr/011-display-currency.md (People's rate editor takes input in the display currency). Nothing
else.

Tasks, one commit per ADR:
1. One ADR per decision, numbered as docs/phases-4-6.md §3 says, in the format of the existing ADRs:
   status, context, decision, the alternatives and why not, consequences. Keep each short (about
   20–40 lines): the plan row is the source; don't add new decisions. Name each file after its
   decision, e.g. 036-server-state.md.
2. The ADR 011 note.

Done when `pnpm lint` (Prettier) is green.
```

### Brief R: restructure

```text
You are restructuring the three apps into Feature-Sliced Design layers and adding the FSD boundary
rules (T4.0c for all three apps, then T4.0b).

Follow your Start section first. The lead names your branch p4/restructure when merging.

Read: docs/phases-4-6.md §1 and §3, T4.0b and T4.0c in plan.md, D10, D22, D23 and D28, ADR 023, ADR
030, .dependency-cruiser.cjs with its test, rstest.config.ts, and the dependency-cruiser row of the
plan's assumptions table.

You own: apps/shell/src, apps/people/src, apps/delivery/src, apps/*/rsbuild.config.ts (exposes and
entry paths only), apps/*/tsconfig.json, rstest.config.ts (the adapter globs only),
.dependency-cruiser.cjs, .dependency-cruiser.test.ts. Nothing else.

Tasks:
1. Shell into FSD layers as T4.0c maps it, with `git mv` so history follows. Behaviour unchanged:
   only moves, import paths and one index.ts per layer and slice. One commit.
2. The same for People. One commit.
3. The same for Delivery. One commit.
4. rstest.config.ts: the adapter globs move from apps/*/src/data/ to apps/*/src/shared/api/ (the
   domain project includes them, each components-<app> project excludes them). One commit.
5. The three FSD rules of T4.0b, each with a failing fixture in .dependency-cruiser.test.ts like
   the T0.2 rules. If one can't be expressed, stop and report it with the config you tried.

Don't change behaviour, add features or create empty folders. Done when `pnpm lint`, `pnpm
typecheck` and `pnpm test` are green and `pnpm -r build` builds all three apps.
```

_Verify_ (regression):

```text
Base URL http://localhost:8080. Nothing should have changed for a user.
1. Open /people: the shell's nav shows People and Delivery, People is active, the People page renders.
2. Click Delivery: the Delivery page renders, Delivery is active. Use the browser's Back: People again.
3. Open /people/emp-003 directly (a reload of a deep link): the People employee page for emp-003 renders.
4. Open /remotes/people/ and /remotes/delivery/: each renders standalone, without the shell's nav.
5. Open /people?break=people: an in-place message says People couldn't load, with a retry button;
   the nav still works and Delivery still loads.
6. The page shows one React across all loaded apps (the singleton readout).
Criteria: every step as described; no errors in the browser console except the one expected from
step 5's broken remote.
```

### Brief U: shared UI

```text
You are building the shared UI primitives for Phases 4–6 (T4.6).

Follow your Start section first. The lead names your branch p4/ui when merging.

Read: docs/phases-4-6.md §1 and §3 (binding), plan §3 "Shared UI (packages/ui)" including its Layout
rule, T4.6, D12, D13, D27, D33, D36, docs/screens.md (all of it: it shows where each primitive is
used), ADR 012, ADR 013 and ADR 030 (§5, the token override hook).

You own: packages/ui/, and the components-ui project (plus a ui test-setup file) in
rstest.config.ts. Nothing else.

Tasks, one commit each:
1. Move Button, ErrorBoundary, InlineMessage and Spinner into src/components/<Name>/ with their CSS
   Modules and generated .d.ts; point src/index.ts at them.
2. The components-ui Rstest project as T4.6 describes, and tests for the four existing components.
3. TextField. 4. Select. 5. Dialog. 6. StatusMessage. 7. Table. 8. PageHeader. Each exactly as the
   T4.6 table says, with its CSS Module and a test of its behaviour and roles.
9. The visual language: refine src/tokens.css (spacing scale, type scale, colours for the message
   tones, borders, the focus ring) so every screen in docs/screens.md reads clearly and calmly, and
   use it in all ten components. Keep the --bl-theme-* override hook from ADR 030.

Use the frontend-design skill for task 9 and the look of each component, within docs/phases-4-6.md
§1. Use vercel-react-best-practices for the components. No new dependencies. Done when `pnpm lint`,
`pnpm typecheck` and `pnpm test` are green (the ui-deps rule included).
```

### Brief PD: People domain

```text
You are adding the People domain functions the People screens need (T5.0 and T5.6).

Follow your Start section first. The lead names your branch p5/people-domain when merging.

Read: docs/phases-4-6.md §1 and §3, T1.13, T5.0, T5.3 and T5.6 in plan.md, D11, D16, D21 and D34,
docs/screens.md §2, and packages/people-domain as it is (rateHistory.ts, pricingImpact.ts).

You own: packages/people-domain/. Nothing else.

Tasks, one commit each, each with tests next to the code:
1. rateOn(rates, date): the rate in effect on a date, or none. "Today" is a parameter.
2. parseAmount(text) as D34 specifies.
3. formatDate (en-GB, "12 Mar 2026") and the money helpers of T5.6: format a EUR rate in the display
   currency, convert an entered display-currency amount to EUR (unrounded), and tell whether an
   entered amount equals a stored rate as displayed (so an unchanged correction makes no write).
4. capacitySummary(loads): per employee, the months over capacity with percent and PM, or within
   capacity (screens 2.1, 2.6).
5. searchEmployees(employees, query): case-insensitive, by name or role.
6. Extend pricingImpact so each entry also has the new first rate's date and the month's working days
   before it (screens 2.5). Keep its existing behaviour and tests.

Done when `pnpm lint`, `pnpm typecheck` and `pnpm test` are green and `pnpm test:coverage` shows
about 100% of branches for the new code.
```

### Brief DD: Delivery domain

```text
You are adding the Delivery domain functions the grid needs (T6.0).

Follow your Start section first. The lead names your branch p6/delivery-domain when merging.

Read: docs/phases-4-6.md §1 and §3, T6.0, T6.3, T6.4, T6.9, T6.12 and T6.13 in plan.md, D15, D17,
D18, D19, D32, D34 and D35, docs/screens.md §3, and packages/delivery-domain as it is (start with
projectGrid.ts, grid.ts, roundGrid.ts, pricing.ts, capacity.ts, tree.ts, format.ts and
reference.test.ts).

You own: packages/delivery-domain/. Nothing else.

Tasks, one commit each, each with tests next to the code:
1. gridView(plan, people, projectId, unit, currency) (D35), built on the existing buildGrid, rollUp
   and roundGrid: the project row, WBS rows and person rows in tree order, exact and displayed
   values, cell states and markers, and each cell's details content for T6.12 (all four units, the
   person-month and hours per day, the working days per rate slice, the blended rate, the marker
   texts). Without People's data (people = null) it gives PM and % only, with employee ids as names.
   Add a test that the reference cell's details give the numbers in docs/phases-4-6.md §3.
2. rowActions(state, itemId) and moveTargets(state, itemId), each action or target allowed or
   refused with its reason (screens 3.4). Reuse tree.ts's checks; don't duplicate them.
3. itemPath(state, itemId): "Project › item › item" (screens 3.3).
4. parseAmount(text) as D34 specifies, and en-GB formatting with currencyDisplay narrowSymbol in
   format.ts. Keep the reference test green.

Done when `pnpm lint`, `pnpm typecheck` and `pnpm test` are green and `pnpm test:coverage` keeps
delivery-domain at about 100% of branches.
```

### Brief SH: shell

```text
You are building the shell's screens (T4.1–T4.5).

Follow your Start section first. The lead names your branch p4/shell when merging.

Read: docs/phases-4-6.md §1 and §3 (binding), T4.1–T4.5 in plan.md, D11, D22, D28 and D31, ADR 029
§9, ADR 030 §6–7, ADR 031, docs/screens.md §1, and apps/shell as it is.

You own: apps/shell/. Nothing else.

Tasks, one commit each:
1. T4.1: the top bar's nav as screens 1.1 shows it, and the not-found message of screens 1.3.
2. T4.2: currency and user as ui Selects, kept in localStorage, pushed to both remotes without a
   remount. Component test: changing the currency doesn't remount a panel.
3. T4.3: the panel's loading and failed states with the wording of screens 1.2.
4. T4.4: the status strip: each remote's status and remoteEntry.js URL, plus the React readout.
5. T4.5: everything built from ui primitives and tokens.

Use the frontend-design and vercel-react-best-practices skills within docs/phases-4-6.md §1. Done
when `pnpm lint`, `pnpm typecheck` and `pnpm test` are green.
```

_Verify:_

```text
Base URL http://localhost:8080. Compare with docs/screens.md §1.1–§1.3.
1. Open /people. The top bar shows Baseline, the People and Delivery links (People active), a
   Currency select (EUR) and a User select (Demo Planner). The status strip shows people and delivery
   as loaded, each with its /remotes/<name>/remoteEntry.js URL, and the React readout.
2. Set Currency to USD: the select shows USD; reload the page: still USD. Set it back to EUR.
3. Set User to Demo Lead; reload: still Demo Lead.
4. Click Delivery, then Back and Forward: the active link follows each time.
5. Open /reports: a not-found message with a link to People; no remote panel.
6. Open /people?break=people: the panel says People couldn't load, with Try again; the status strip
   shows people failed; Delivery still opens from the nav.
Criteria: each step as described, matching the mockups' content (not their exact look); no console
errors except step 6's expected load failure.
```

### Brief P1: People data and register

```text
You are building People's data plumbing and the register screen (T5.0a, T5.1).

Follow your Start section first. The lead names your branch p5/register when merging.

Read: docs/phases-4-6.md §1 and §3 (binding), T5.0a and T5.1 in plan.md, D6, D21, D26, D29, D30,
D31, D32 and D33, ADR 033 (error responses), ADR 034, ADR 035 ("What it means for T3.7": every write
is a batch), packages/people-contract, packages/delivery-contract, docs/screens.md §2.1 and §4, and
apps/people as it is.

You own: apps/people/. Nothing else.

Tasks, one commit each:
1. Dependencies: pocketbase and @tanstack/react-query in apps/people only.
2. The two SDK clients, the repository interface and its implementation, the in-memory fake, the
   query-key factories, useApplyChangeSet, the RealtimeProvider, the repository context, the
   QueryClient in App, renderWithApp, and the /api dev proxy, all as T5.0a lists them, with tests
   of the adapter's parsing and error mapping and of the RealtimeProvider's patching.
3. T5.1: the register page as screens 2.1 shows it, without the Capacity column (T5.4 adds it in
   brief P2): search in ?q=, the count, the no-match message, names linking to the employee page,
   Rate today in the display currency. Its loading and load-failed states as screens 4 shows them.
   Component tests: filtering, the count, the no-match message.

Use the frontend-design and vercel-react-best-practices skills within docs/phases-4-6.md §1. Done
when `pnpm lint`, `pnpm typecheck` and `pnpm test` are green.
```

_Verify:_

```text
Base URL http://localhost:8080. Compare with docs/screens.md §2.1.
1. Open /people. A table of employees: Name, Role, Weekly hours, Rate today. The count says 60 of 60.
   Adaeze Okafor: Tech Lead, 40 h, €95.00/h. Milan Brandt: Backend Engineer, 40 h, €100.00/h.
2. Type "okafor" in the search: 2 of 60, Adaeze Okafor and Lena Okafor. The URL has ?q=okafor.
   Reload: the search and the two rows are still there.
3. Search "Tech Lead": only Tech Leads are listed.
4. Search "xyz": the message No employees match "xyz".
5. (needs SH) Clear the search, switch the shell's Currency to USD: Adaeze Okafor's rate shows
   $102.60/h.
   Switch back to EUR.
6. Click Adaeze Okafor: the URL becomes /people/emp-001.
7. Open /remotes/people/?q=okafor: the same two rows, standalone.
Criteria: each step as described; no console errors.
```

### Brief D1: Delivery data and projects

```text
You are building Delivery's data plumbing, its read model and the project picker (T6.0a, T6.1, T6.2).

Follow your Start section first. The lead names your branch p6/projects when merging.

Read: docs/phases-4-6.md §1 and §3 (binding), T6.0a, T6.1 and T6.2 in plan.md, and T5.0a (T6.0a
follows it), D6, D21, D22, D26, D29, D30, D31, D32 and D33, ADR 033, ADR 035, packages/
delivery-contract, packages/people-contract, docs/screens.md §3.1, §3.7 and §4, and apps/delivery
as it is.

You own: apps/delivery/. Nothing else.

Tasks, one commit each:
1. Dependencies: pocketbase and @tanstack/react-query in apps/delivery only.
2. T6.0a: the same plumbing as T5.0a, for Delivery's collections and People's employees and rates,
   with the same tests. Delivery's private collections are parsed by schemas in the adapter.
3. T6.1: the read model: one query per collection, patched by realtime; Delivery's own data
   suspends, People's doesn't (D32).
4. T6.2: the project picker (screens 3.1) and the project page shell at /:projectId with its header
   (name and dates), the unknown-project message (screens 3.7), and the loading and load-failed
   states (screens 4). The grid itself comes in brief D2.

Use the frontend-design and vercel-react-best-practices skills within docs/phases-4-6.md §1. Done
when `pnpm lint`, `pnpm typecheck` and `pnpm test` are green.
```

_Verify:_

```text
Base URL http://localhost:8080. Compare with docs/screens.md §3.1 and §3.7.
1. Open /delivery: a table of 4 projects with dates and months: Ledger Consolidation (1 Mar 2026 –
   28 Feb 2027, 12), Reporting Platform (12), Client Portal Rebuild (10), Warehouse Data Migration (9).
2. Click Ledger Consolidation: the URL is /delivery/prj-1 and the page header shows its name and
   dates, with a back link to the projects. Reload: the same page.
3. Open /delivery/prj-9: Project not found, with the back link.
4. Open /remotes/delivery/prj-1: the same project page, standalone.
Criteria: each step as described; no console errors.
```

### Brief P2: employee page and rates

```text
You are building People's employee page, the rate editor and the capacity states (T5.2–T5.5).

Follow your Start section first. The lead names your branch p5/employee when merging.

Read: docs/phases-4-6.md §1 and §3 (binding), T5.2–T5.5 in plan.md, D11, D16, D27, D29, D32, D33,
D34 and D37, ADR 034, docs/screens.md §2 and §4, and apps/people as it is (brief P1's plumbing).

You own: apps/people/. Nothing else.

Tasks, one commit each:
1. Dependencies: react-hook-form and @hookform/resolvers in apps/people only.
2. T5.2: the employee page (screens 2.3 without the forms, and 2.7).
3. T5.4: capacity: the register's Capacity column and the employee page's badge and month list
   (screens 2.1, 2.3, 2.6), from the load feed through capacitySummary.
4. T5.3: add, correct and remove rates (screens 2.3–2.5) with the three validation layers of D27,
   amounts in the display currency, the StatusMessage, the remove Dialog with pricingImpact's months,
   and the write-failed, conflict and record-removed states of screens 4. Component tests: a clash
   error, a refused cost of 0, an unchanged correction making no write, the removal warning.
5. T5.5: Delivery unreachable (screens 2.2).

Use the frontend-design and vercel-react-best-practices skills within docs/phases-4-6.md §1. Done
when `pnpm lint`, `pnpm typecheck` and `pnpm test` are green.
```

_Verify:_

```text
Base URL http://localhost:8080. Compare with docs/screens.md §2.
1. /people: the Capacity column shows "Over capacity · Sep 2026" for Lena Okafor and "Over capacity
   · Jun 2026" for Milan Brandt; Adaeze Okafor has none.
2. Open /people/emp-001: Adaeze Okafor, Tech Lead · 40 h/week · emp-001, Within capacity. Rate
   history: 12 Mar 2026 €95.00/h marked current, then 1 Jan 2025 €80.00/h.
3. Add a rate: valid from 2026-11-01, cost 98.00. A status line confirms it; the list shows it first.
   Reload: still there.
4. Correct the 1 Jan 2025 rate's date to 2026-03-12 and save: an error says another rate already
   starts on 12 Mar 2026; nothing is saved. Cancel.
5. Try to add a rate with cost 0: refused with an error at the field.
6. Remove the 1 Jan 2025 rate: a dialog warns that Mar 2026 becomes partly priced (8 of 22 working
   days before 12 Mar 2026). Cancel: nothing changes.
7. (needs SH) Switch Currency to USD, correct the 12 Mar 2026 rate and save it without changing the value:
   no status line about a save, and after switching back to EUR it still reads €95.00/h.
8. Open /people/emp-003: Milan Brandt is over capacity: Jun 2026, 118.0% (1.18 PM).
9. Open /people/emp-999: Employee not found, with a back link.
10. Open /remotes/people/emp-001: the same page, standalone.
Degraded (separate run; the lead stops delivery-pb first and starts it after):
11. Open /people: a message says capacity is unknown; the Capacity column reads unknown for every
    employee; names, roles and rates still show. Open /people/emp-001: the page works.
Criteria: each step as described; no console errors other than failed requests to delivery-pb in
step 11.
```

### Brief D2: staffing grid

```text
You are building the staffing grid, read-only, with slots for the features that follow (T6.4, T6.8,
T6.10).

Follow your Start section first. The lead names your branch p6/grid when merging.

Read: docs/phases-4-6.md §1 and §3 (binding), T6.4, T6.8 and T6.10 in plan.md and the "Parallel
lanes" rule "The grid leaves slots", D19, D31, D35 and D36, docs/screens.md §3.2, and apps/delivery as
it is (brief D1's plumbing) and gridView in packages/delivery-domain.

You own: apps/delivery/. Nothing else.

Tasks, one commit each:
1. widgets/staffing-grid: the table of screens 3.2 from gridView, in PM for now: project row, WBS
   rows and person rows, months and Total, derived rows read-only with value cells that aren't focusable (D36), expand and
   collapse (all expanded on load), the label and Total columns fixed while the months scroll.
2. The four slots, documented in the widget's index.ts: a cell renderer (default: the displayed
   value as text), a row-actions slot on WBS rows, a toolbar slot above the grid, and a details slot
   below it. Later briefs (D3, D4, D5) fill them from their own feature slices, so each needs only
   one wiring line here.
3. The grid on the project page. Component tests: the seed sums, collapse keeps a node's sums,
   derived rows aren't focusable.

Use the frontend-design and vercel-react-best-practices skills within docs/phases-4-6.md §1. Done
when `pnpm lint`, `pnpm typecheck` and `pnpm test` are green.
```

_Verify:_

```text
Base URL http://localhost:8080. Compare with docs/screens.md §3.2.
1. Open /delivery/prj-1. The grid has a Work package / person column, the months Mar 26 … Feb 27 and
   a Total column. The project row reads 0.50, 1.30, 2.65, 4.99, 5.35, 6.40 for Mar–Aug 26 and 57.06
   in Total.
2. Ledger migration › Discovery › Design is expanded and has person rows Adaeze Okafor, Milan Brandt,
   Anja Keller, Clara Bergmann and Maja Jankovic. Design's Jun 26 cell reads 1.29; Adaeze Okafor's
   Mar 26 cell reads 0.50.
3. Collapse Discovery: its children hide and its row still reads 9.69 in Total. Expand it again.
4. Scroll the months sideways: the first column and Total stay in place.
5. Tab through the grid: focus moves through the expand/collapse controls in the first column and
   never lands on a value cell (person cells become editable in brief D3).
Criteria: each step as described; no console errors.
```

### Brief D3: units, editing and People down

```text
You are adding the unit switcher, cell editing and the People-down state to the grid (T6.5, T6.6,
T6.13).

Follow your Start section first. The lead names your branch p6/editing when merging.

Read: docs/phases-4-6.md §1 and §3 (binding), T6.5, T6.6 and T6.13 in plan.md, D11, D17, D26, D31,
D32, D34, D36 and D37, docs/screens.md §3.2, §3.3, §3.6 and §4, and apps/delivery as it is (the grid
and its slots from brief D2).

You own: apps/delivery/src/features/switch-unit/, apps/delivery/src/features/edit-cell/, and one
wiring line per slot in apps/delivery/src/widgets/staffing-grid/ and the project page. Nothing else.

Tasks, one commit each:
1. T6.5: the unit switcher (a native radio group in the toolbar slot), in ?unit=.
2. T6.6: editable person cells through the cell-renderer slot, exactly as T6.6 and D36 describe,
   saving through useApplyChangeSet, with € edits refused in partly priced and unpriced months and
   the write-failed state of screens 4. Component tests: Enter saves, Esc cancels, an unchanged
   value makes no write, a refused € edit.
3. T6.13: People unreachable (screens 3.6): the message, Hours and Cost disabled, ids for names.

Use the frontend-design and vercel-react-best-practices skills within docs/phases-4-6.md §1. Done
when `pnpm lint`, `pnpm typecheck` and `pnpm test` are green.
```

_Verify:_

```text
Base URL http://localhost:8080. Compare with docs/screens.md §3.2, §3.3 and §3.6.
1. Open /delivery/prj-1. The unit switcher shows Hours, Person-months (selected), % of capacity, Cost.
2. Switch to Cost: Adaeze Okafor's Mar 26 cell in Design reads €7,880.00 and the URL has
   ?unit=cost. Switch to Hours: 88.00. To %: 50.0. Back to Person-months: 0.50.
3. In Cost, open that cell, type 7880 and press Enter. Switch to Person-months: it reads 0.50.
4. In Person-months, open Anja Keller's Apr 26 cell in Design, type 0.3, press Esc: it still reads
   0.20. Open it again, type 0.3, press Enter: it reads 0.30, and the Design row's Apr 26 and Total
   change with it. Reload: still 0.30.
5. (needs P2) Open /people/emp-001 in the same tab, remove the 1 Jan 2025 rate and confirm. Return
   to /delivery/prj-1?unit=cost: the Mar 26 cell reads €5,320.00. Open it and type 5000, Enter: the
   edit is refused with a message about 8 of 22 working days before the first rate. Switch to
   Person-months: the cell can still be edited.
6. (needs SH) Switch Currency to USD in the shell: the Cost cells show $.
Degraded (separate run; the lead resets the data, then stops people-pb, and starts it after):
7. Open /delivery/prj-1: a message says People's data can't be reached; Hours and Cost are disabled;
   person rows show employee ids (emp-001 …); Person-months still edit.
Criteria: each step as described; no console errors other than failed requests to people-pb in
step 7.
```

### Brief D4: tree operations

```text
You are adding the WBS tree operations and assign-person to the grid (T6.3, T6.7).

Follow your Start section first. The lead names your branch p6/tree when merging.

Read: docs/phases-4-6.md §1 and §3 (binding), T6.3 and T6.7 in plan.md, D9, D15, D27, D31, D33, D36
and D37, docs/screens.md §3.4, §3.5 and §4, and apps/delivery as it is (the grid and its slots from
brief D2), and rowActions, moveTargets and the tree operations in packages/delivery-domain.

You own: apps/delivery/src/features/add-item/, rename-item/, move-item/, delete-item/,
assign-person/, and one wiring line per slot in apps/delivery/src/widgets/staffing-grid/. Nothing
else.

Tasks, one commit each:
1. Dependencies: react-hook-form and @hookform/resolvers in apps/delivery only.
2. The row-actions disclosure of D36 in the row-actions slot, with rowActions' reasons, and
   "+ Add top-level item".
3. Rename in place. 4. Add child, with the D9 notice. 5. Move, with moveTargets. 6. Delete, with
   its counts. Each through useApplyChangeSet, its result in the StatusMessage, and the write-failed
   state of screens 4.
7. T6.7: assign a person (screens 3.5): the new row lives in local state until a value is saved.
Component tests: a refused action shows its reason, add child under a leaf with allocations moves
them, delete reports its counts.

Use the frontend-design and vercel-react-best-practices skills within docs/phases-4-6.md §1. Done
when `pnpm lint`, `pnpm typecheck` and `pnpm test` are green.
```

_Verify:_

```text
Base URL http://localhost:8080. Compare with docs/screens.md §3.4 and §3.5.
1. Open /delivery/prj-1. On the Design row, press ⋯: Rename, Add child item (disabled: Design is at
   the third level), Move…, Delete…, Assign person…. Press ⋯ again: the list closes.
2. Rename Design to "Design work" in place, Enter: the row shows the new name; reload: still there.
3. Use "+ Add top-level item" to add "Data checks". On it, Assign person… Henrik Bauer: a row with
   empty cells appears. Reload before entering a value: the row is gone. Assign him again, enter
   0.2 in Mar 26 (Person-months), Enter. Reload: the row stays.
4. On Data checks, Add child item "Reconciliation": the dialog says 1 allocation moves to it.
   Confirm: Henrik Bauer's row is now under Data checks › Reconciliation, and a status line says so.
5. Move Rework: the picker lists only Ledger Consolidation's nodes; Discovery is marked current
   parent and third-level nodes are disabled with their reason. Move it to Ledger migration ›
   Migration: it appears there with its rows; the sums of Discovery and Migration change to match.
6. Delete Data checks: the dialog counts 2 items and 1 allocation. Confirm: they're gone; reload:
   still gone.
Criteria: each step as described; no console errors.
```

### Brief D5: markers and cell details

```text
You are adding the cell markers and the cell details panel (T6.9, T6.12).

Follow your Start section first. The lead names your branch p6/details when merging.

Read: docs/phases-4-6.md §1 and §3 (binding), T6.9 and T6.12 in plan.md, D17, D18, D35 and D36,
docs/screens.md §3.2 and §3.3, apps/delivery as it is (the grid and its slots from brief D2), and
gridView's details content in packages/delivery-domain.

You own: apps/delivery/src/widgets/cell-details/, the marker rendering (a small ui segment in
apps/delivery/src/entities/allocation/), and one wiring line per slot in
apps/delivery/src/widgets/staffing-grid/. Nothing else.

Tasks, one commit each:
1. T6.9: the †, ◐ and ○ markers on cells, with visible text and aria-describedby to the details.
2. T6.12: the cell details panel in the details slot, following the focused cell.
Component tests: the details for the reference cell, a † cell names its causer.

Use the frontend-design and vercel-react-best-practices skills within docs/phases-4-6.md §1. Done
when `pnpm lint`, `pnpm typecheck` and `pnpm test` are green.
```

_Verify:_

```text
Base URL http://localhost:8080. Compare with docs/screens.md §3.2 and §3.3.
1. Open /delivery/prj-1 and focus Adaeze Okafor's Mar 26 cell in Design. The details panel reads:
   0.50 PM = 88.00 h = 50.0% of capacity = €7,880.00; person-month 176.00 h (40 h/week × 22 working
   days ÷ 5), 4.00 h per working day; 8 working days before 12 Mar at €80.00/h and 14 from 12 Mar at
   €95.00/h; blended rate €89.5455/h.
2. Milan Brandt's Jun 26 cell in Design shows †. Focus it: the details say over capacity, 118.0%
   (1.18 PM), caused by Client Portal Rebuild › Account management › Core build › Implementation.
3. Press Tab from that cell: focus moves to the next person cell and the details follow it; it never
   lands on a derived row's value cell (Design, Jun 26).
Criteria: each step as described; no console errors.
```

### Brief D6: performance

```text
You are making the grid re-render only what changed (T6.11).

Follow your Start section first. The lead names your branch p6/performance when merging.

Read: docs/phases-4-6.md §1 and §3 (binding), T6.11 in plan.md, D26, D29 and D35, and apps/delivery
as it is (briefs D2–D5).

You own: apps/delivery/. Nothing else; no behaviour changes.

Tasks, one commit each:
1. Memoise as D35 says: per-cell exact values by reference, gridView's rounding by its inputs,
   React.memo rows with primitive props and stable callbacks.
2. A component test with a render counter: a rate event for one employee re-renders only that
   employee's rows, and a cell edit only its row and the derived rows above it.
3. Remove any memoisation that the test shows does nothing.

Use the vercel-react-best-practices skill. Done when `pnpm lint`, `pnpm typecheck` and `pnpm test`
are green.
```

_Verify:_ Brief D2's block, then steps 2–4 of brief D3's block (a regression check).

## 6. Phase exit checks (lead)

Run each when its last brief has passed verification. Start with `docker compose down -v && docker compose up -d --build --wait`, then `pnpm lint && pnpm typecheck && pnpm test`.

- **Phase 4** (after SH): the verifier runs brief R's and brief SH's blocks again, and `pnpm test` runs the `components-ui` project with a test for every T4.6 primitive. Tick the plan's Phase 4 exit check.
- **Phase 5** (after P2): the verifier runs P1's and P2's blocks, steps 1–6 and 8–10 also standalone (`/remotes/people/…`; step 7 needs the shell's currency select). After `docker compose restart people-pb`, the rate added in P2's step 3 is still there.
- **Phase 6** (after D6): the verifier runs D1's to D5's blocks, D3's step 2 and D5's step 1 also standalone (`/remotes/delivery/prj-1`). After `docker compose restart delivery-pb`, D3's and D4's edits are still there.

Tick each phase's tasks and exit check in plan.md and commit `Tick Phase <n> after its exit check`. When Phases 4, 5 and 6 have all passed, report to the user and stop. Phase 7 starts from a new handover.
