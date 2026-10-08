# Phase 7 handover: cross-app behaviour

How to run Phase 7 of [plan.md](plan.md) with the [builder](../.claude/agents/builder.md) and [verifier](../.claude/agents/verifier.md) agents. You, the agent reading this, are the **lead**: you launch the builder and the verifier, review and merge, run the stack, stop and start services around the degraded runs, and tick the plan. You don't write feature code yourself.

Phases 4–6 already built almost everything Phase 7 checks: both remotes subscribe to the other team's collections (D29), the shell pushes the currency through `HostContext` without a remount (T4.2), and both remotes have their degraded states (T5.5, T6.13). So Phase 7 is **one small build and a set of cross-app checks**:

| Task | What's left                                                                                       |
| ---- | ------------------------------------------------------------------------------------------------- |
| T7.1 | Check: a rate edit reaches open Delivery cost cells live, hosted, standalone and across two tabs  |
| T7.2 | Check: an allocation edit that tips someone over capacity flags them in People live               |
| T7.3 | Check: a currency switch updates both remotes at once, and € edits use the display currency       |
| T7.4 | Check: with each of the four containers stopped in turn, the rest works and says what's missing   |
| T7.5 | **Build** (brief L), then check: a person name in the grid links to that employee in People (D22) |

## 1. Keep it small

Every brief carries these rules, and [phases-4-6.md](phases-4-6.md) §1 still applies.

- **Checks first, code only where a check fails.** T7.1–T7.4 add no code. A failing step gets a fix brief (§5, brief F) with a test that reproduces it, and nothing beyond that fix.
- **No contract changes.** `host-contract` stays as it is. The link's `href` comes from `ctx.basePath` (§3, Cross-app href), not from a new `HostContext` field.
- **No new dependencies, no new `ui` primitives.** The link is a plain `<a>` in Delivery.
- **No E2E tests.** T8.1, which would have automated these checks in Phase 8, is out of scope (2026-10-08), so the Verify blocks below are the record of them.
- **One stack, one verifier at a time.** Verifier runs change data (rates, cells), so they run one after another, each after a reset.

## 2. Order

| Step           | What                                                             | Needs           | Branch             |
| -------------- | ---------------------------------------------------------------- | --------------- | ------------------ |
| **L** link     | brief L: T7.5                                                    | `main`          | `p7/employee-link` |
| **V1, V2, V3** | verifier runs for T7.1, T7.2, T7.3, one after another            | `main`          | —                  |
| **V5**         | verifier run for T7.5                                            | L merged        | —                  |
| **V4a–V4d**    | verifier runs for T7.4, one per stopped container, in that order | L merged        | —                  |
| **F** fixes    | brief F, once per failing step                                   | the failing run | `p7/fix-<name>`    |
| Exit check     | §6                                                               | all runs passed | —                  |

So: launch L, and while it builds, run V1, V2 and V3 on the stack built from the current `main` (they don't need T7.5). When L is merged and those runs are done, rebuild the stack and run V5, then V4a–V4d. **Don't rebuild the stack while a verifier is running.** At most two subagents run at once: a builder and one verifier.

## 3. Fixed values

Every brief and Verify block uses these. [phases-4-6.md](phases-4-6.md) §3 still holds (stack, URLs, config, reference cell). Changing one needs the user.

| Thing                 | Value                                                                                                                                                                                                                                                                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live                  | The change shows within 5 s in the other tab or panel, **without reloading it**                                                                                                                                                                                                                                                     |
| Two tabs              | Two tabs in the verifier's one browser session (`playwright-cli` tab commands), both on `http://localhost:8080`. Tab A is Delivery, tab B is People, unless a step says otherwise                                                                                                                                                   |
| Hosted, one tab       | The shell shows one remote at a time, so "hosted, same page" (T7.1) means one tab that moves between People and Delivery through the shell's nav, with no reload                                                                                                                                                                    |
| Rate check (T7.1)     | Adaeze Okafor (`emp-001`), the 12 Mar 2026 rate, 95.00 → 100.00. Her Mar 26 cell in Design, Cost: €7,880.00 → **€8,160.00** (8 × 4 h × €80 + 14 × 4 h × €100); blended **€92.7273/h**; Hours stays 88.00. Back to 95.00 gives €7,880.00 and €89.5455/h. People's _Rate today_ follows                                               |
| Capacity check (T7.2) | Clara Bergmann (`emp-044`), May 26 in Design: 0.50 → 0.90. Her May load goes 0.70 → **1.10 PM (110.0%)**. The other contributor is her 0.20 in _Warehouse Data Migration › Load and reconcile › Migration › Rework_ (`prj-4`). The causer is the edited Design cell: _Ledger Consolidation › Ledger migration › Discovery › Design_ |
| Currency check (T7.3) | USD 1.08: the reference cell **$8,510.40**, slices $86.40/h and $102.60/h, blended **$96.7091/h**. A Cost edit of **10212.48** in USD stores **0.60 PM** (€9,456.00). GBP 0.85: Adaeze's rates **£80.75/h** and **£68.00/h**; a rate entered as **85.00** in GBP is stored as **€100.00/h**                                         |
| Services for T7.4     | `people` and `delivery` (the remotes' static containers), `people-pb` and `delivery-pb`. The lead runs `docker compose stop <name>` and `docker compose start <name>`; the verifier never touches containers                                                                                                                        |
| Recovery              | After the lead starts a stopped `*-pb` again, its degraded message clears **within 30 s, without a reload** (D29: the SDK reconnects, and the provider refetches)                                                                                                                                                                   |
| Cross-app href (T7.5) | The other app sits next to this app's `basePath` (ADR 029): `href = <basePath without its last segment> + to`. Hosted, `/delivery` gives `/people/emp-001`; standalone, `/remotes/delivery` gives `/remotes/people/emp-001`, the same URL the standalone `navigate` opens                                                           |
| Link clicks (T7.5)    | A plain primary click (button 0, no Ctrl, Meta, Shift or Alt) calls `ctx.navigate(to)` and prevents the default. Any other click is left to the browser, so open-in-new-tab works                                                                                                                                                   |
| ADR                   | One dated note, "Amended 2026-10-08", at the end of [ADR 022](adr/022-routing.md): the grid's person link, its `href` rule and its click rule                                                                                                                                                                                       |

## 4. The lead's loop

The loop of [phases-4-6.md](phases-4-6.md) §4 applies as written: the worktree pitfalls, launch, read the report, name the branch, review with `code-review` at `medium` and an explicit range (`main...<branch> medium`), merge with `--no-ff`, then `pnpm lint && pnpm typecheck && pnpm test` on `main`. What's different here:

1. **Before every verifier run:** `docker compose up -d --build --wait` if `main` changed since the last build, then `infra/scripts/reset.sh`. For a V4 run, stop the named container **after** the reset.
2. **Runs that pause (V4a–V4d).** Each has a _Pause_ line. The verifier stops there and reports part 1 **without closing its browser**. You start the container, wait for `docker compose ps` to show it healthy, then resume the same verifier with `SendMessage`: "Container started; continue from the step after the pause." Its report covers both parts.
3. **A failing step:** read the evidence and find the cause before launching anything.
   - **A wrong expected value in this file:** check it against the seed and plan §1. If this file is wrong, fix it, commit `Fix <step> in phase-7.md`, and run the block again. If a plan value is wrong, ask the user.
   - **A bug:** launch brief F with the evidence. Review, merge, rebuild, and run the whole block again.
   - **An assumption that fails** (e.g. the SDK stops reconnecting, or nginx buffers the realtime stream): stop and ask the user (plan, assumptions table).
4. **PASS:** tick the run's task in plan.md once every run for it has passed (T7.4 needs all four), and commit `Tick <task> after <run> was verified`. T7.5 is ticked after V5 **and** V4a and V4c, which check its degraded cases.
5. Keep a short log in your replies to the user: what started, merged, passed or failed.

## 5. The briefs

Pass each brief verbatim as the `builder` prompt, with `isolation: "worktree"`, in the background. Pass each Verify block verbatim as the `verifier` prompt.

### Brief L: the person link

```text
You are making person names in Delivery's staffing grid link to that employee in People (T7.5).

Follow your Start section first. The lead names your branch p7/employee-link when merging.

Read: .docs/phase-7.md (all of it; §1 and §3 are binding), .docs/phases-4-6.md §1, T7.5 in plan.md,
D22, D30, D32, D35 and D36, ADR 022 and ADR 029, .docs/screens.md §3.2, §3.6 and §5, and in
apps/delivery: app/standalone.ts, shared/lib/HostContextProvider.tsx, widgets/staffing-grid/ui/
RowLabel.tsx and GridRows.tsx, and the T6.11 test StaffingGrid.rerender.test.tsx.

You own: apps/delivery/src/shared/lib/, apps/delivery/src/entities/employee/,
apps/delivery/src/widgets/staffing-grid/ui/ (RowLabel.tsx, GridRows.tsx, StaffingGrid.module.css and
one new test file), and the dated note at the end of .docs/adr/022-routing.md. Nothing else.

Tasks, one commit each:
1. hostHref(basePath, to) in shared/lib, exactly as .docs/phase-7.md §3 (Cross-app href) says, and
   useHostLink(to) beside it, returning { href, onClick } with the click rule of §3 (Link clicks),
   reading navigate and basePath through useHost. Unit tests for hostHref: hosted /delivery, standalone
   /remotes/delivery, and the dev basePath "".
2. EmployeeLink in entities/employee/ui: a plain <a> built from useHostLink(`/people/${employeeId}`),
   showing the label it's given. Export it from the slice's index.ts.
3. Person rows' labels render the name through EmployeeLink. Without People's data the label is the
   employee id (gridView already gives it) and it still links (D32). Style the link with ui's tokens
   only, so it reads as a link inside the row header; derived rows don't change.
4. A component test through renderWithApp: the href hosted and standalone; a plain click calls
   ctx.navigate('/people/emp-001') once and prevents the default; a Ctrl-click and a middle click
   don't call it; with People unreachable the link reads emp-001 and keeps its href. Keep the T6.11
   re-render test green without changing what it asserts: the link reads the host context, not row
   props, so PersonRow keeps its props.
5. The ADR 022 note (.docs/phase-7.md §3, ADR).

No host-contract change, no new dependencies, no ui change. Use vercel-react-best-practices. Done when
`pnpm lint`, `pnpm typecheck` and `pnpm test` are green.
```

### Brief F: a fix (template)

The lead fills in the angle brackets; everything else stays as written.

```text
You are fixing a failure found by a Phase 7 check: <task id>, <run> step <n>.

Follow your Start section first. The lead names your branch p7/fix-<name> when merging.

The verifier's evidence, verbatim:
<the failing step's lines from the report, and the console errors>

What the lead found: <the cause as far as known, with file:line>.

Read: .docs/phase-7.md §1 and §3 (binding), .docs/phases-4-6.md §1, <task> in plan.md and the
decisions it cites, .docs/screens.md <section>, and the code above.

You own: <the one app or package the cause is in>. Nothing else.

Tasks, one commit each:
1. A test that fails for the reason above: a domain test if the cause is a calculation, otherwise a
   component test through renderWithApp with the in-memory fake (D30).
2. The smallest fix that makes it pass. No other behaviour changes, no refactoring on the way.

If the cause turns out to be outside your paths, or a decision (D1–D37) can't hold, stop and report.
Done when `pnpm lint`, `pnpm typecheck` and `pnpm test` are green.
```

### V1: rate edits reach Delivery (T7.1)

```text
Base URL http://localhost:8080. Compare with .docs/screens.md §3.2 and §2.3. "Live" means the change
shows within 5 s without reloading that tab. Use two tabs in your one browser session.
Hosted, one tab:
1. Open /delivery/prj-1?unit=cost. Adaeze Okafor's Mar 26 cell in Design reads €7,880.00.
2. Without reloading from here on: click People in the shell's nav, open Adaeze Okafor, correct the
   12 Mar 2026 rate's cost to 100.00 and save. Click Delivery, open Ledger Consolidation and pick Cost:
   the cell reads €8,160.00.
Hosted, two tabs:
3. Tab A: open /delivery/prj-1?unit=cost and focus that cell. The details panel says 14 working days
   from 12 Mar at €100.00/h and a blended rate of €92.7273/h.
4. Tab B: open /people/emp-001, correct the 12 Mar 2026 rate back to 95.00 and save.
5. Tab A, live: the cell, the Design row's Mar 26 and the project row's Mar 26 read €7,880.00, and the
   details panel says €95.00/h and €89.5455/h. Switch to Hours: the cell reads 88.00. Back to Cost.
Standalone, two tabs:
6. Tab A: open /remotes/delivery/prj-1?unit=cost. Tab B: open /remotes/people/emp-001 and correct the
   12 Mar 2026 rate to 100.00.
7. Tab A, live: the cell reads €8,160.00.
Mixed:
8. Tab A: open /delivery/prj-1?unit=cost (hosted). Tab B, still standalone: correct the rate back to
   95.00. Tab A, live: €7,880.00.
9. Tab B: open /people. Adaeze Okafor's Rate today reads €95.00/h.
Criteria: each step as described; no console errors.
```

### V2: capacity reaches People (T7.2)

```text
Base URL http://localhost:8080. Compare with .docs/screens.md §2.1, §2.6, §3.2 and §3.3. "Live" means the
change shows within 5 s without reloading that tab. Use two tabs in your one browser session.
Hosted, two tabs:
1. Tab A: open /delivery/prj-1 (Person-months). Clara Bergmann's May 26 cell in Design reads 0.50, with
   no †.
2. Tab B: open /people?q=bergmann. Clara Bergmann's Capacity shows no over-capacity month.
3. Tab A: open that cell, type 0.9 and press Enter. It reads 0.90 with †. Focus it: the details panel
   says over capacity, 110.0% (1.10 PM), caused by Ledger Consolidation › Ledger migration › Discovery
   › Design.
4. Tab B, live: Clara Bergmann's Capacity reads "Over capacity · May 2026". Open her page
   (/people/emp-044): over capacity in May 2026, 110.0% of capacity (1.10 PM).
5. Tab B: open /delivery/prj-4. Clara Bergmann's May 26 cell under Load and reconcile › Migration ›
   Rework reads 0.20 with †. Focus it: caused by Ledger Consolidation › Ledger migration › Discovery ›
   Design.
6. Tab B: open /people/emp-044. Tab A: set the Design cell back to 0.5, Enter: no †.
7. Tab B, live: Within capacity.
Standalone, two tabs:
8. Tab A: open /remotes/delivery/prj-1. Tab B: open /remotes/people/emp-044. Tab A: set the cell to
   0.9, Enter. Tab B, live: over capacity in May 2026, 110.0%.
9. Tab A: set it back to 0.5, Enter. Tab B, live: Within capacity.
Hosted, one tab:
10. In tab A open /delivery/prj-1, set the cell to 0.9, Enter. Without reloading, click People in the
    nav and search "bergmann": "Over capacity · May 2026". Click Delivery, open Ledger Consolidation and
    set the cell back to 0.5.
Criteria: each step as described; no console errors.
```

### V3: the display currency (T7.3)

```text
Base URL http://localhost:8080. Compare with .docs/screens.md §1.1, §2.3, §3.2 and §5.
1. Open /delivery/prj-1?unit=cost. Collapse Reporting cut-over. Adaeze Okafor's Mar 26 cell in Design
   reads €7,880.00.
2. Set the shell's Currency to USD. At once, without a reload: the cell reads $8,510.40, every Cost
   cell shows $, the URL is unchanged, and Reporting cut-over is still collapsed (the panel didn't
   remount). Focus the cell: the details panel reads 0.50 PM = 88.00 h = 50.0% of capacity =
   $8,510.40, 8 working days at $86.40/h and 14 at $102.60/h, blended rate $96.7091/h.
3. Open the cell, clear it, type 10212.48 and press Enter: it reads $10,212.48. Switch to
   Person-months: 0.60. Back to Cost, open the cell, type 8510.40, Enter. Person-months: 0.50.
4. Click People in the nav: Adaeze Okafor's Rate today reads $102.60/h. Open her page: the rate
   history shows $102.60/h (current) and $86.40/h.
5. Set Currency to GBP. At once: £80.75/h and £68.00/h.
6. Open /people/emp-044 and add a rate valid from 2026-11-01 with cost 85.00: it shows £85.00/h.
   Set Currency to EUR: it shows €100.00/h.
7. Set Currency to USD, then open /remotes/delivery/prj-1?unit=cost: the cell reads €7,880.00
   (standalone uses EUR, screens 5). Open /remotes/people/emp-001: €95.00/h.
8. Open /people and set Currency back to EUR.
Criteria: each step as described; no console errors.
```

### V5: the person link (T7.5)

```text
Base URL http://localhost:8080. Compare with .docs/screens.md §3.2 and §5.
Hosted:
1. Open /delivery/prj-1?unit=cost. In Design, Adaeze Okafor's name is a link whose href is
   /people/emp-001.
2. Move focus to that link with Tab and press Enter: the URL is /people/emp-001, People is active in
   the nav, and Adaeze Okafor's employee page shows.
3. Browser Back: /delivery/prj-1?unit=cost, the grid in Cost. Forward: the employee page. Back again.
4. Click Milan Brandt's name in Design: /people/emp-003, his page says over capacity in Jun 2026.
   Back: the grid.
5. Open Adaeze Okafor's link href in a new tab: the hosted employee page for Adaeze Okafor. Close
   that tab.
Standalone:
6. Open /remotes/delivery/prj-1. Adaeze Okafor's link href is /remotes/people/emp-001. Click it: the
   standalone employee page, with no shell top bar. Back: the standalone grid.
Criteria: each step as described; no console errors.
```

### V4a: the People remote down (T7.4, T7.5)

```text
Base URL http://localhost:8080. The lead has stopped the `people` container (People's remote code).
People's data service is up. Compare with .docs/screens.md §1.2.
1. Open /people: the panel says People couldn't load, with Try again; the status strip shows people
   failed. The nav still works.
2. Click Delivery and open Ledger Consolidation: the grid loads with names. Pick Cost: Adaeze Okafor's
   Mar 26 cell in Design reads €7,880.00.
3. Pick Person-months, set Anja Keller's Apr 26 cell in Design to 0.3, Enter: it reads 0.30.
4. Click Adaeze Okafor's name: the URL is /people/emp-001 and the panel says People couldn't load,
   with Try again. Back: the grid.
Pause: click Forward to /people/emp-001 (People couldn't load again: every entry into People retries
its remote), report steps 1–4 and wait there, without closing the browser. The lead starts `people`
and resumes you.
5. Without leaving the page, press Try again: Adaeze Okafor's employee page loads.
Criteria: each step as described; no console errors except failed requests for /remotes/people/…
in steps 1–4 and at the pause.
```

### V4b: the Delivery remote down (T7.4)

```text
Base URL http://localhost:8080. The lead has stopped the `delivery` container (Delivery's remote code).
Delivery's data service is up. Compare with .docs/screens.md §1.2 and §2.1.
1. Open /delivery: the panel says Delivery couldn't load, with Try again; the status strip shows
   delivery failed. The nav still works.
2. Click People: the register shows 60 of 60 and the Capacity column: Milan Brandt "Over capacity ·
   Jun 2026", Lena Okafor "Over capacity · Sep 2026".
3. Open /people/emp-001 and add a rate valid from 2026-11-01 with cost 98.00: a status line confirms it
   and it's listed first.
Pause: click Delivery (Delivery couldn't load again: every entry into Delivery retries its remote),
report steps 1–3 and wait there, without closing the browser. The lead starts `delivery` and resumes
you.
4. Without leaving the page, press Try again: the four projects are listed.
Criteria: each step as described; no console errors except failed requests for /remotes/delivery/…
in steps 1–3 and at the pause.
```

### V4c: People's data service down (T7.4, T7.5)

```text
Base URL http://localhost:8080. The lead has stopped `people-pb`. Compare with .docs/screens.md §3.6
and §4.
1. Open /people: "Employees couldn't be loaded", with Try again. The nav still works.
2. Click Delivery and open Ledger Consolidation: a message says People's data can't be reached; Hours
   and Cost are disabled; person rows show employee ids (emp-001 …); Design's Jun 26 reads 1.29.
3. Set emp-016's Apr 26 cell in Design to 0.3, Enter: it reads 0.30. Reload: still 0.30, and the
   message is back.
4. emp-001 in Design is a link to /people/emp-001. Click it: People's page says it couldn't load, with
   Try again; nothing crashes. Back: the grid.
Pause: stay on /delivery/prj-1, report steps 1–4 and wait, without closing the browser. The lead
starts `people-pb` and resumes you.
5. Without reloading, within 30 s: the message clears, the person rows show names (Adaeze Okafor …),
   and Hours and Cost are enabled. Pick Cost: Adaeze Okafor's Mar 26 cell in Design reads €7,880.00.
6. Click People: the register shows 60 of 60.
Criteria: each step as described; no console errors except failed requests to /api/people/… in
steps 1–4.
```

### V4d: Delivery's data service down (T7.4)

```text
Base URL http://localhost:8080. The lead has stopped `delivery-pb`. Compare with .docs/screens.md §2.2
and §4.
1. Open /delivery: "Projects couldn't be loaded", with Try again. The nav still works.
2. Click People: a message says capacity is unknown; the Capacity column reads unknown for every
   employee; names, roles and rates show (Adaeze Okafor, €95.00/h).
3. Open /people/emp-001 and add a rate valid from 2026-11-01 with cost 98.00: a status line confirms it.
   Reload: it's still there.
Pause: open /people, report steps 1–3 and wait, without closing the browser. The lead starts
`delivery-pb` and resumes you.
4. Without reloading, within 30 s: the capacity message clears, and Milan Brandt's Capacity reads
   "Over capacity · Jun 2026".
5. Click Delivery: the four projects are listed.
Criteria: each step as described; no console errors except failed requests to /api/delivery/… in
steps 1–3.
```

## 6. Exit check (lead, after every run has passed)

1. `docker compose down -v && docker compose up -d --build --wait`, then `pnpm lint && pnpm typecheck && pnpm test`, then `infra/scripts/reset.sh && pnpm test:integration`.
2. Regression, one verifier run each after a reset: brief D2's Verify block from [phases-4-6.md](phases-4-6.md), with step 5 read as "focus moves through the expand/collapse controls and the person name links in the first column, and never lands on a project or WBS row's value cell (person cells are editable since brief D3)"; then steps 2–4 of brief D3's block.
3. Check that every run in §2 has passed since its last fix: V1, V2, V3, V5 and V4a–V4d. A run that passed before a later fix merged is run again if the fix touched its app.
4. Tick T7.1–T7.5 in plan.md (those not ticked yet) and add "**Passed on <date>.**" to Phase 7's exit check. Commit `Tick Phase 7 after its exit check`.
5. Report to the user and stop. Phase 8 starts from a new handover.
