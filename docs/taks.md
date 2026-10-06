## Senior Frontend Engineer — Case Study

Baseline answers one question for a delivery organisation: **who is working on what, for how long, and what it costs.**

Two teams ship it independently and never import each other's source.

- **Stack:** React 18+, TypeScript strict
- **Deliverable:** Three federated builds — shell, people, delivery
- **Run:** `docker compose up` → `localhost:8080`

---

# 1. What you're building

A delivery organisation sells its people's time. Someone has to say, month by month:

- who is assigned to which piece of work,
- whether anyone is committed beyond their contracted hours,
- and what the plan costs at the rates those people are paid.

Baseline is where that plan is made and priced.

Two facts make it awkward:

1. A person's cost rate changes over time, so one month can be priced at two rates.
2. The same people are shared across projects, so capacity only means anything when every project is counted together.

The register of people and their rates, and the plan that spends them, are owned by different teams on different release schedules.

That is why this is a micro-frontend exercise and not one application: **three separate apps, built by two teams that ship on their own schedules.**

### Applications

| Application  | Responsibility                                                                       |
| ------------ | ------------------------------------------------------------------------------------ |
| **People**   | Employee register: roles, weekly hours, and cost-rate history.                       |
| **Delivery** | Work breakdown and a month-by-month staffing grid that spends the rates People owns. |
| **Shell**    | Hosts both; owns navigation, display currency, and the active user.                  |

### Topology

```text
                    Shell
                      |
          +-----------+-----------+
          |                       |
       People                   Delivery
       remote                   remote
          |                       |
          +-----------+-----------+
                      |
                one React
                 singleton
```

The shell loads both remotes at runtime.

---

# 2. How we assess it

Four dimensions, weighted. Spend your time where the weight is; the reference calculation in **3.3** is the first thing we check.

| Dimension                       | Weight | What earns it                                                                                                                                |
| ------------------------------- | -----: | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Architecture and boundaries** |     35 | Where domain logic lives and whether it is testable without a browser; whether the two remotes are genuinely independent or quietly coupled. |
| **Domain correctness**          |     30 | Rate splitting, working-day arithmetic, unit conversion, roll-ups, totals that reconcile. We have specific inputs we will type in.           |
| **Micro-frontend engineering**  |     20 | Runtime remote resolution, the singleton story, standalone and hosted from one build, isolation on failure.                                  |
| **Code quality**                |     15 | Types that make wrong states unrepresentable, domain naming, consistency across the three apps, no dead scaffolding.                         |

### Not scored

- Visual polish
- A design system
- Auth
- Mobile
- Offline
- Scheduling

---

# 3. Requirements

## 3.1 Scope

| Area            | What has to work                                                                                                                       |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Shell**       | Navigation between the remotes; owns display currency and the active user and pushes both in at runtime.                               |
| **People**      | Searchable register; open an employee and edit their rate history — rates addable, correctable and removable, including retroactively. |
| **Delivery**    | A work breakdown tree with create, rename, move, delete; a staffing grid of people × months, every leaf cell editable.                 |
| **Across both** | A rate edited in People reaches any open Delivery cost view with no reload. Over-capacity is flagged in both apps.                     |
| **Resilience**  | If a remote fails to load, the shell stays alive and says so in place of that panel. Give us a way to trigger it.                      |

---

## 3.2 Data model

Minimum fields. Name them how you like, add what you need, but every one of these has to exist somewhere.

| Entity            | Fields                                                   | Notes                                                 |
| ----------------- | -------------------------------------------------------- | ----------------------------------------------------- |
| **Employee**      | `id`, `name`, `role`, `weeklyHours`                      | `weeklyHours` is 40, 32 or 20                         |
| **RateRecord**    | `id`, `employeeId`, `validFrom`, `hourlyCost`            | No end date — a record runs until the next one starts |
| **Project**       | `id`, `name`, `startDate`, `endDate`                     | Projects overlap and share people                     |
| **BreakdownItem** | `id`, `projectId`, `parentId`, `name`                    | `parentId` null at the root; three levels deep        |
| **Allocation**    | `id`, `breakdownItemId`, `employeeId`, `month`, `amount` | One canonical unit only — you choose which            |

### Canonical allocation unit

`Allocation.amount` is stored in a single unit; the four display units in R2 are conversions of it, never separate fields.

---

## Fixtures

A seed file with fixed IDs ships with the exercise.

It contains:

- A. Okafor and the 12 March 2026 rate change used in the reference calculation
- 60 employees
- 150 rate records
- 1–4 rate records per person
- 10 people changing rates mid-month
- 4 overlapping projects sharing people
- 90 breakdown items, three levels deep
- A twelve-month horizon of 720 editable cells

These are the file's counts, **not targets for you to generate.**

---

# 3.3 Domain rules

## Effective-dated rates

Rates are effective-dated, and months split.

A rate applies from its `validFrom` until the next one begins.

- The last rate has no end.
- `validFrom` is inclusive — the day itself is priced at the new rate.
- If there is more than one rate change in a month, the month is split into more than two slices.

### Example: March 2026

There is a rate change on **12 March 2026**.

```text
March 2026

1  2  3  4  5  6  7
8  9 10 11 12 13 14
15 16 17 18 19 20 21
22 23 24 25 26 27 28
29 30 31

Before 12 Mar: 8 working days × old rate
From 12 Mar:   14 working days × new rate
```

Working days are **Monday to Friday**.

Public holidays are ignored entirely.

---

## Allocation distribution

An allocation is spread evenly across the working days of its month, so every working day carries the same effort.

That month's cost is:

```text
working days before the change × effort per day × old rate
+
working days from the change onward × effort per day × new rate
```

An allocation in a month earlier than the employee's first rate record:

- costs zero,
- and the cell is marked.

---

# 3.4 Reference calculation

### Input

**A. Okafor**

- 40 h/week
- €80.00/h from `2025-01-01`
- €95.00/h from `2026-03-12`
- One leaf cell of `0.50 person-months` in March 2026

### March 2026

- Working days: **22**
- Working days before 12 Mar: **8**
- Working days from 12 Mar onward: **14**

One person-month:

```text
40 × 22 ÷ 5 = 176.00 h
```

Allocation in hours:

```text
0.50 × 176 = 88.00 h
```

Hours per working day:

```text
88 ÷ 22 = 4.00 h
```

Cost:

```text
8 × 4 × 80 + 14 × 4 × 95
= 2,560 + 5,320
= €7,880.00
```

Same cell in `% of capacity`:

```text
50.0%
```

Implied blended rate:

```text
€89.5455/h
```

> **Reference requirement:** If the build does not produce these five numbers, stop and fix that before anything else.

---

# 3.5 Four units, one truth

The grid reads and edits in:

- Hours
- Person-months
- % of capacity
- Cost

Store **one canonical unit** and convert only at the edges.

### Person-month

One person-month is:

```text
weekly hours × (working days that month ÷ 5)
```

Therefore it:

- varies by person,
- varies by month,
- is never a constant.

### % of capacity

`% of capacity` is the percentage of that person's person-month for that month.

```text
100% = exactly one person-month
```

### Editing in €

Editing a cell in € in a month that contains a rate change:

1. Divide the amount entered by that cell's blended rate for the month.
2. This gives hours.
3. Convert hours to the canonical unit.

For the reference calculation:

```text
blended rate = €89.5455/h
```

### Display precision

| Unit          | Precision |
| ------------- | --------: |
| Hours         |      2 dp |
| Person-months |      2 dp |
| %             |      1 dp |
| Cost          |      2 dp |

Switching units and switching back must **not change the stored value**.

---

# 3.6 Staffing grid

Example:

| Work package / person            | Apr 26 | May 26 | Jun 26 | Jul 26 | Aug 26 | Sep 26 | Total |
| -------------------------------- | -----: | -----: | -----: | -----: | -----: | -----: | ----: |
| **Ledger migration — DERIVED**   |   2.10 |   2.85 |   3.05 |   2.40 |   1.75 |   0.90 | 13.05 |
| L. Okafor                        |   0.80 |   1.00 |   1.15 |   0.90 |   0.60 |   0.25 |  4.70 |
| M. Brandt                        |   0.70 |   0.95 | 1.18 † |   0.80 |   0.65 |   0.40 |  4.68 |
| S. Haddad                        |   0.60 |   0.90 |   0.72 |   0.70 |   0.50 |   0.25 |  3.67 |
| **Reporting cut-over — DERIVED** |   0.00 |   0.45 |   1.60 |   2.20 |   2.05 |   1.10 |  7.40 |

- Outlined cell = mid-edit
- `†` = over capacity
- Derived rows roll up from their children

M. Brandt is over capacity in Jun 26 once his other projects are counted.

---

# 3.7 Totals and rounding

Totals must add up.

Totals are computed from exact values and rounded only for display.

The displayed total must equal the sum of the displayed cells.

Use **largest-remainder distribution** so the rounded cells add to the rounded total exactly.

The `0.01` tolerance is a floating-point allowance, **not a rounding budget**.

---

# 3.8 Parent rows

Parents are derived.

Effort and cost on a parent:

- come from its children,
- are read-only.

You decide what happens to a leaf's own allocation when a child is added beneath it.

Two resolutions are acceptable:

1. Move the leaf's allocation onto the new child.
2. Refuse the insertion with a message.

Both are fine.

**Silent loss is not.**

---

# 3.9 Capacity

Capacity is **cross-project**.

For a month:

```text
Capacity = 100% of that person's person-month
```

Allocation is summed across **every project**, including projects that are not currently open.

When the sum exceeds capacity:

- **People** shows the person as oversubscribed.
- **Delivery** names the assignment that caused it.

The assignment that caused it is the **most recently edited allocation contributing to that person-month**.

The edit is:

- flagged,
- never blocked.

---

# 4. Hard constraints

## Delivery pricing

Delivery prices its grid using rates that People owns.

Whether Delivery:

1. reads rate records and computes cost itself, or
2. asks People for a computed cost,

is the decision being assessed.

Either can be right — make the choice deliberately and defend it in your `README`.

---

## Given

### No UI libraries

No:

- component kit
- headless primitives
- table package
- grid package
- tree package

Styling tooling and date libraries are fine.

### Three federated builds

There must be three builds:

- `shell`
- `people`
- `delivery`

They are wired with **Module Federation**.

### Runtime remote resolution

Remote URLs resolve at runtime from container configuration, **never from the bundle**.

### Standalone and hosted

Each remote runs both:

- standalone,
- hosted.

Both must work from **one codebase and one build**.

### One command

From a clean clone:

```bash
docker compose up
```

must serve the suite on:

```text
localhost:8080
```

No Node on the host.

### TypeScript

TypeScript must use strict mode.

```text
no any
```

---

# 5. Your decisions

You are responsible for deciding:

## Data layer

How each service gets its data and where it lives.

## Transport between remotes

How a change in one remote reaches the other.

## State ownership

- One owner per piece of data
- A published contract
- Never expose internals

## Persistence mechanism

Which store to use, given that edits must survive a reload.

## Bundler

Choose the bundler.

---

# 6. Handover

The repository should include:

- Real commit history
- `README.md`

The `README.md` must explain:

1. How to run the application.
2. How to break a remote on purpose.
3. A map of the repository.

### Tests

Add tests where you would defend them.

The assessment will look hardest at **calculation logic that runs without mounting React**.

### Live code walkthrough

The interview will include walking through the code together and making a small change in it live.
