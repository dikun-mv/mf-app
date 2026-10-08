# Baseline — Screen mockups

Schematic wireframes of every screen in the suite: what is on each screen, where it sits, and which states it has. Visual polish isn't scored (brief §2), so these fix layout and behaviour, not looks. Values come from the seed ([data.json](data.json)), so a screen can be checked against them. Each section names the plan tasks and decisions it implements. As in the plan, a bare `§3.4` is a section of the brief; sections of this document are written without `§` (e.g. 3.2), and from the plan as "[screens.md](screens.md) §3.2" or "screens 3.2".

**Legend**

| Mark        | Meaning                                               |
| ----------- | ----------------------------------------------------- |
| `[ text ]`  | text input; `[ x ▾ ]` a native select                 |
| `[Label]`   | button                                                |
| `(•)` `( )` | radio group (native inputs)                           |
| `‹ Back`    | link                                                  |
| `▾` `▸`     | expanded / collapsed tree node                        |
| `⋯`         | row actions: a minimal disclosure (D36)               |
| `[0.5▏]`    | a grid cell being edited (outlined, §3.6)             |
| `·`         | an empty leaf cell: no allocation yet, still editable |
| `†`         | over capacity (§3.9, T6.9)                            |
| `◐`         | partially priced month (D17)                          |
| `○`         | unpriced month: before the first rate (§3.3)          |
| `(!)` `(i)` | inline warning / information (`InlineMessage`)        |
| `✓ …`       | the widget's `role="status"` line (D33)               |

**Screens and tasks.** Every screen has a task that builds it, and every UI task points back at its screens. Tasks with no screen of their own: T4.0a–c, T4.6, T5.0, T5.0a, T5.6, T6.0 and T6.0a (code without UI, used by the screens below), T6.11 (performance) and T7.1–T7.4 (behaviour across screens, verified on the screens below).

| Section | Screen                                                                      | Built by                           |
| ------- | --------------------------------------------------------------------------- | ---------------------------------- |
| 1.1     | Shell frame                                                                 | T4.1, T4.2, T4.4, T4.5             |
| 1.2     | Panel loading and failed                                                    | T2.5, T2.6, T4.3                   |
| 1.3     | Shell: unknown path                                                         | T2.3a, T4.1                        |
| 2.1     | Register                                                                    | T5.1, T5.4, T5.6, with T5.0        |
| 2.2     | Register, Delivery unreachable                                              | T5.5                               |
| 2.3     | Employee detail and rate history                                            | T5.2, T5.3, T5.4, T5.6             |
| 2.4     | Correcting a rate                                                           | T5.3                               |
| 2.5     | Removing a rate                                                             | T5.3, with T5.0                    |
| 2.6     | Employee over capacity                                                      | T5.4, with T5.0                    |
| 2.7     | Unknown employee                                                            | T5.2                               |
| 3.1     | Project picker                                                              | T6.2                               |
| 3.2     | Staffing grid                                                               | T6.4–T6.10, T6.12, T7.5, with T6.0 |
| 3.3     | Cell states, in Cost                                                        | T6.6, T6.9, T6.12                  |
| 3.4     | Row actions and WBS dialogs                                                 | T6.3, with T6.0                    |
| 3.5     | Assign a person                                                             | T6.7                               |
| 3.6     | Grid, People unreachable                                                    | T6.13, verified by T7.4            |
| 3.7     | Unknown project                                                             | T6.2                               |
| 4       | Common states: loading, load failed, write failed, conflict, record removed | T5.1, T5.3, T6.2, T6.3, T6.6, T6.7 |
| 5       | Standalone mode                                                             | T2.3, T7.5                         |

The `ui` primitives these screens use are listed, with their consumers, in plan T4.6.

---

## 1. Shell

### 1.1 Frame, hosted (`/people…`, `/delivery…`; T4.1–T4.5)

The shell owns the top bar and the status strip; everything between is the mounted remote. The strip shows each remote's status and the `remoteEntry.js` URL it came from, which `config.json` supplies at runtime (T4.4). The active nav item follows the first path segment, including on back and forward (D22). Currency and user come from `config.json` and are kept in `localStorage` (T4.2); changing either pushes a new `HostContext` without a remount.

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Baseline     People   Delivery                          Currency [ EUR ▾ ]   User [ Demo Planner ▾ ]     │
│              ══════                                                                                      │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                          │
│    <remote panel: People or Delivery, mounted from its remoteEntry.js>                                   │
│                                                                                                          │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ people ● loaded from /remotes/people/remoteEntry.js                                                      │
│ delivery ● loaded from /remotes/delivery/remoteEntry.js          React 18.3.1 · one copy ✓               │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Panel loading and failed (T2.5, T2.6, T4.3)

While the remote's code loads, the panel shows a spinner; after the load timeout, or on a 404 or a render error, it shows the failure in place. Nav, switchers and the other remote keep working. Break it with `docker compose stop people` or `?break=people` (ADR 031).

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Baseline     People   Delivery                          Currency [ EUR ▾ ]   User [ Demo Planner ▾ ]     │
│              ══════                                                                                      │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                          │
│    ┌─ People couldn't load ─────────────────────────────────────────────────────┐                        │
│    │ (!) /remotes/people/remoteEntry.js didn't load (timed out).                │                        │
│    │     The rest of Baseline still works.                         [Try again]  │                        │
│    └────────────────────────────────────────────────────────────────────────────┘                        │
│                                                                                                          │
│    loading state instead:   ◌ Loading People…                                                            │
│                                                                                                          │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ people ✕ failed      /remotes/people/remoteEntry.js                                                      │
│ delivery ● loaded from /remotes/delivery/remoteEntry.js          React 18.3.1 · one copy ✓               │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Unknown path (T2.3a, T4.1)

A first segment the shell doesn't know, such as `/reports`, shows the shell's own message; no remote is loaded.

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Baseline     People   Delivery                          Currency [ EUR ▾ ]   User [ Demo Planner ▾ ]     │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                          │
│    (!) Not found. Go to People                                                                           │
│                                                                                                          │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ people ● loaded from /remotes/people/remoteEntry.js                                                      │
│ delivery ● loaded from /remotes/delivery/remoteEntry.js          React 18.3.1 · one copy ✓               │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. People

### 2.1 Register (`<basePath>`, `?q=`; T5.1, T5.4, T5.6, D31)

A plain table of all 60 employees, filtered as you type by name or role (case-insensitive); the term is kept in `?q=`. The name links to the detail view. _Rate today_ is the rate in effect today, converted to the display currency. _Capacity_ comes from `delivery-contract`'s `employee_month_loads` feed and lists the months over capacity.

```text
┌─ People ─────────────────────────────────────────────────────────────────────────────────────────┐
│ Employees                                                                                        │
│                                                                                                  │
│ Search name or role [                              ]                          60 of 60           │
│                                                                                                  │
│ Name               Role                  Weekly hours   Rate today   Capacity                    │
│ ──────────────────────────────────────────────────────────────────────────────────────────       │
│ Adaeze Okafor      Tech Lead                     40 h   €95.00/h                                 │
│ Lena Okafor        Frontend Engineer             40 h   €85.00/h     [Over capacity · Sep 2026]  │
│ Milan Brandt       Backend Engineer              40 h   €100.00/h    [Over capacity · Jun 2026]  │
│ Samira Haddad      Frontend Engineer             32 h   €106.00/h                                │
│ Tomas Novak        Frontend Engineer             40 h   €106.00/h                                │
│ …                                                                                                │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Filtered and empty:** `?q=okafor` shows _2 of 60_ and the two Okafors. No match shows _No employees match "xyz"._ in place of the rows.

### 2.2 Register, Delivery unreachable (T5.5, D29, D32)

The load feed is the other team's data, so it never blanks the screen: a banner says so, and the Capacity column reads _unknown_. Employees and rates are unaffected.

```text
┌─ People ─────────────────────────────────────────────────────────────────────────────────────────┐
│ Employees                                                                                        │
│                                                                                                  │
│ (i) Capacity unknown: Delivery's data can't be reached. Employees and rates are unaffected.      │
│                                                                                                  │
│ Search name or role [                              ]                          60 of 60           │
│                                                                                                  │
│ Name               Role                  Weekly hours   Rate today   Capacity                    │
│ ──────────────────────────────────────────────────────────────────────────────────────────       │
│ Adaeze Okafor      Tech Lead                     40 h   €95.00/h     unknown                     │
│ Lena Okafor        Frontend Engineer             40 h   €85.00/h     unknown                     │
│ …                                                                                                │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Employee detail and rate history (`<basePath>/:employeeId`; T5.2, T5.3, T5.4, T5.6)

Rates are listed newest first; the one in effect today is marked _current_. _Add a rate_ and _Correct_ are react-hook-form forms (D27); their errors come from the field schemas and from `people-domain` (T1.13). Past dates are allowed (retroactive edits). There is no delete action for the employee (D16).

Costs are entered in the **display currency**, and the field's label names it. The mockup shows EUR, the default. With USD selected the field reads _Hourly cost (USD)_, a value being corrected is prefilled in USD, and the rate is stored in EUR as `amount ÷ perEur`, as for € grid edits (D11, T5.3).

```text
┌─ People ─────────────────────────────────────────────────────────────────────────────────────────┐
│ ‹ All employees                                                                                  │
│                                                                                                  │
│ Adaeze Okafor                                                              Within capacity       │
│ Tech Lead · 40 h/week · emp-001                                                                  │
│                                                                                                  │
│ Rate history                                                                                     │
│ Valid from        Hourly cost                                                                    │
│ ──────────────────────────────────────────────────────────────────────────────────────────       │
│ 12 Mar 2026       €95.00/h     current                              [Correct]   [Remove]         │
│ 1 Jan 2025        €80.00/h                                          [Correct]   [Remove]         │
│                                                                                                  │
│ Add a rate                                                                                       │
│ Valid from [ 2026-11-01 ]     Hourly cost (EUR) [ 98.00     ]                  [Add rate]        │
│ (i) A rate runs until the next one starts. Past dates are allowed.                               │
│                                                                                                  │
│ ✓ Rate from 1 Nov 2026 added.                                                                    │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Correcting a rate, with a validation error (T5.3, D27)

_Correct_ turns the row into an inline form. A clash with another rate's start date is refused before sending; so is a cost of 0 or less.

```text
┌─ People ─────────────────────────────────────────────────────────────────────────────────────────┐
│ Rate history                                                                                     │
│ Valid from        Hourly cost                                                                    │
│ ──────────────────────────────────────────────────────────────────────────────────────────       │
│ 12 Mar 2026       €95.00/h     current                              [Correct]   [Remove]         │
│ [ 2026-03-12 ]    [ 80.00   ]                                       [Save]      [Cancel]         │
│ (!) Another rate already starts on 12 Mar 2026.                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.5 Removing a rate that leaves allocated months unpriced (T1.13, T5.3, T8.1)

Removal is never blocked, but `people-domain` flags allocated months (from the load feed) that the change leaves unpriced or partly priced. The example is the T8.1 E2E case.

```text
┌─ Remove the rate from 1 Jan 2025? ───────────────────────────────────────────────────────┐
│ €80.00/h from 1 Jan 2025 will be removed. The next rate starts on 12 Mar 2026.           │
│                                                                                          │
│ (!) Adaeze Okafor has allocations in months this leaves without a full rate:             │
│       Mar 2026 — partly priced: 8 of 22 working days are before 12 Mar 2026              │
│     Delivery costs those days at 0.                                                      │
│                                                                                          │
│                                                                 [Cancel]   [Remove rate] │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.6 Employee over capacity (T5.4)

```text
┌─ People ─────────────────────────────────────────────────────────────────────────────────────────┐
│ ‹ All employees                                                                                  │
│                                                                                                  │
│ Milan Brandt                                                   [Over capacity · 1 month]         │
│ Backend Engineer · 40 h/week · emp-003                                                           │
│                                                                                                  │
│ (!) Over capacity in Jun 2026: 118.0% of capacity (1.18 PM) across all projects.                 │
│     The causing assignment is named in Delivery.                                                 │
│                                                                                                  │
│ Rate history                                                                                     │
│ …                                                                                                │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.7 Unknown employee (T5.2, D22)

```text
┌─ People ─────────────────────────────────────────────────────────────────────────────────────────┐
│ ‹ All employees                                                                                  │
│                                                                                                  │
│ Employee not found: there is no employee "emp-999".                                              │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Delivery

### 3.1 Project picker (`<basePath>`; T6.2)

```text
┌─ Delivery ───────────────────────────────────────────────────────────────────────────────────────┐
│ Projects                                                                                         │
│                                                                                                  │
│ Name                         Dates                         Months                                │
│ ──────────────────────────────────────────────────────────────────────────────────────────       │
│ Ledger Consolidation         1 Mar 2026 – 28 Feb 2027          12                                │
│ Reporting Platform           1 Apr 2026 – 31 Mar 2027          12                                │
│ Client Portal Rebuild        1 Jun 2026 – 31 Mar 2027          10                                │
│ Warehouse Data Migration     1 Apr 2026 – 31 Dec 2026           9                                │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Staffing grid (`<basePath>/:projectId?unit=…`; T6.4–T6.10, T6.12, T7.5, D31, D35, D36)

One table: the first column is the WBS tree, and each leaf has its person rows under it. Columns are the project's months (from its dates, plan §1) and a Total. The label and Total columns stay put while the months scroll sideways; the mockup shows six of twelve. Values below are the seed's, in person-months.

- **Derived rows** (the project row and every WBS row) are shaded and read-only, and their value cells aren't focusable; only the label's expand/collapse and `⋯` controls are (§3.8, D36). Collapsing a node keeps its sums.
- **Person rows** hold the editable cells: each a button that opens an input on Enter or click. Enter or blur saves, Esc cancels (T6.6, D36). The outlined cell is Adaeze Okafor's March cell mid-edit.
- **`†`** sits on every contributing cell in the open project. Milan Brandt's June cell is marked although the causer is in _Client Portal Rebuild_ (T6.9).
- **The status line** under the toolbar reports the last action (D33).
- **Person names are links** to that employee's page in People, through `HostContext.navigate('/people/<employeeId>')` (T7.5).

```text
┌─ Delivery ───────────────────────────────────────────────────────────────────────────────────────┐
│ ‹ Projects                                                                                       │
│ Ledger Consolidation · 1 Mar 2026 – 28 Feb 2027                                                  │
│                                                                                                  │
│ Unit  ( ) Hours   (•) Person-months   ( ) % of capacity   ( ) Cost                               │
│ ✓ Saved 0.50 PM for Adaeze Okafor, Design, Mar 2026.                                             │
│                                                                                                  │
│ Work package / person             Mar 26  Apr 26  May 26  Jun 26  Jul 26  Aug 26  …   Total      │
│ ───────────────────────────────────────────────────────────────────────────────────────────      │
│ Ledger Consolidation                0.50    1.30    2.65    4.99    5.35    6.40  …   57.06      │
│ ▾ Ledger migration  ⋯               0.50    1.00    1.90    3.64    2.40    2.80  …   26.14      │
│   ▾ Discovery  ⋯                    0.50    0.20    0.70    1.79    1.20    1.20  …    9.69      │
│     ▾ Design  ⋯                     0.50    0.20    0.70    1.29    0.70    0.70  …    6.69      │
│         Adaeze Okafor             [0.5▏]       ·       ·       ·       ·       ·  …    0.50      │
│         Milan Brandt                   ·       ·       ·   0.59†       ·       ·  …    0.59      │
│         Anja Keller                    ·    0.20    0.20    0.20    0.20    0.20  …    1.60      │
│         Clara Bergmann                 ·       ·    0.50    0.50    0.50    0.50  …    2.00      │
│         Maja Jankovic                  ·       ·       ·       ·       ·       ·  …    2.00      │
│         + Assign person                                                                          │
│     ▸ Rework  ⋯                     0.00    0.00    0.00    0.50    0.50    0.50  …    3.00      │
│   ▸ Migration  ⋯                    0.00    0.00    0.70    1.15    0.70    1.10  …   10.35      │
│   ▸ Pilot  ⋯                        0.00    0.80    0.50    0.70    0.50    0.50  …    6.10      │
│ ▸ Reporting cut-over  ⋯             0.00    0.30    0.00    0.20    1.50    1.75  …   13.25      │
│ ▸ Controls and audit  ⋯             0.00    0.00    0.75    1.15    1.45    1.85  …   17.67      │
│ + Add top-level item                                                                             │
│                                                                                                  │
│ ┌─ Cell: Adaeze Okafor · Design · Mar 2026 ──────────────────────────────────────────┐           │
│ │ 0.50 PM = 88.00 h = 50.0% of capacity = €7,880.00                                  │           │
│ │ Person-month 176.00 h (40 h/week × 22 working days ÷ 5) · 4.00 h per working day   │           │
│ │ 22 working days: 8 before 12 Mar at €80.00/h, 14 from 12 Mar at €95.00/h           │           │
│ │ Blended rate €89.5455/h                                                            │           │
│ └────────────────────────────────────────────────────────────────────────────────────┘           │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Cell details** (bottom, T6.12) follows the focused cell and spells out the conversion. It is where the five reference numbers (§3.4) are visible in the UI (plan §5, first line), and it gives the `†`, `◐` and `○` markers their full text (`aria-describedby`, D36).

### 3.3 Cell states, shown in Cost (T6.6, T6.9, T6.12, D17)

The same person rows with the unit switched to Cost (EUR). Switching never writes (T6.5).

```text
┌─ Delivery · unit: Cost (EUR) ────────────────────────────────────────────────────────────────────┐
│ Work package / person                  Mar 26          Jun 26                                    │
│ ──────────────────────────────────────────────────────────────────                               │
│     ▾ Design  ⋯                    €7,880.00      €18,842.56                                     │
│         Adaeze Okafor              €7,880.00               ·        ← reference cell (§3.4)      │
│         Milan Brandt                       ·     €10,384.00†                                     │
│                                                                                                  │
│ Cell details for the † cell:                                                                     │
│   Over capacity: Milan Brandt, Jun 2026 — 118.0% of capacity (1.18 PM) across all projects.      │
│   Caused by: Client Portal Rebuild › Account management › Core build › Implementation,           │
│   0.59 PM, the most recently edited contributing allocation (D18).                               │
│                                                                                                  │
│ After removing Okafor's 1 Jan 2025 rate (2.5), March is partly priced:                           │
│         Adaeze Okafor              €5,320.00 ◐                                                   │
│   Editing it in Cost is refused; Hours, PM and % still work:                                     │
│         Adaeze Okafor             [7880▏    ] ◐                                                  │
│   (!) Can't edit in € here: 8 of 22 working days are before the first rate (12 Mar 2026)         │
│       and aren't costed. Switch to Hours, Person-months or % to edit this cell.                  │
│                                                                                                  │
│ A month before any rate is unpriced: it costs €0.00, shows ○, and refuses € edits too.           │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

`€18,842.56` (Design, June) is the sum of its three June cells: Brandt €10,384.00, Keller €2,562.56 and Bergmann €5,896.00.

### 3.4 Row actions (T6.3, T6.0, T1.12, D9, D15)

`⋯` on a WBS row shows a short list of plain buttons in a dropdown under it, over the grid: the rows below don't move, and neither the scrolling grid nor the sticky columns cut it off ([ADR 049](adr/049-row-actions-dropdown.md)). It is deliberately minimal (D36): one list open at a time, closed by choosing an action, pressing `⋯` again, Esc or a click outside, with no arrow keys. Actions that can't apply are shown disabled, never hidden, with a `?` beside them whose tooltip gives the reason (on hover or focus, and named in the action's `aria-describedby`). Labels carry no trailing `…`, even where a dialog follows. Rename edits the name in place (Enter saves, Esc cancels).

```text
┌─ Delivery ───────────────────────────────────────────────────────────────────────────────────────┐
│     ▾ Design  ⋯                                                                                  │
│                 ┌──────────────────────────────────────────────────────┐                         │
│                 │ Rename                                               │                         │
│                 │ Add child item (?) ◀ tooltip: Design is at the third │                         │
│                 │                      level, the deepest              │                         │
│                 │ Move                                                 │                         │
│                 │ Delete                                               │                         │
│                 │ Assign person                         (leaves only)  │                         │
│                 └──────────────────────────────────────────────────────┘                         │
│                                                                                                  │
│ Rename in place:   ▾ [ Design discovery▏         ]   Enter saves · Esc cancels                   │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Add a child item.** When the parent is a leaf with allocations, the dialog says where they go before anything changes (D9). (Every seed leaf is at the third level, so this case first appears for a leaf the user created higher up.)

```text
┌─ Add an item under "Data checks" ────────────────────────────────────────┐
│ Name [ Reconciliation                     ]                              │
│                                                                          │
│ (i) "Data checks" holds 6 allocations. Only leaves hold allocations,     │
│     so they move to "Reconciliation".                                    │
│                                                                          │
│                                                    [Cancel]   [Add item] │
└──────────────────────────────────────────────────────────────────────────┘
```

Afterwards the status line reads: _✓ Added "Reconciliation". 6 allocations moved from Data checks to Data checks › Reconciliation._

**Move.** The parent picker lists only nodes of the open project (D15). Options that would break the tree are disabled with the reason (depth, cycle). Moving onto a leaf that has allocations moves them onto the moved item, as in D9, or is refused when they would clash.

```text
┌─ Move "Rework" ──────────────────────────────────────────────────────────────────────────┐
│ New parent — Ledger Consolidation only                                                   │
│                                                                                          │
│ ( ) Top level                                                                            │
│ ( ) Ledger migration                                                                     │
│ (–) Ledger migration › Discovery                         current parent                  │
│ (–) Ledger migration › Discovery › Design                third level: can't take a child │
│ (•) Ledger migration › Migration                                                         │
│ ( ) Ledger migration › Pilot                                                             │
│ ( ) Reporting cut-over                                                                   │
│ …                                                                                        │
│                                                                                          │
│                                                               [Cancel]   [Move]          │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

**Delete.** The dialog counts what goes (T1.12).

```text
┌─ Delete "Discovery"? ────────────────────────────────────────────────────────┐
│ This deletes 3 items (Discovery, Design, Rework) and their 24 allocations.   │
│ It can't be undone.                                                          │
│                                                                              │
│                                                        [Cancel]   [Delete]   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 3.5 Assign a person to a leaf (T6.7)

Lists employees from `people-pb` who aren't on this leaf yet. The new person row appears with empty cells and exists only in the page until a value is saved in one of its months; a reload before that removes it (T6.7, D31).

```text
┌─ Assign a person to "Design" ────────────────────────────────────────────────┐
│ Employee [ Henrik Bauer — Backend Engineer, 40 h/week          ▾ ]           │
│                                                                              │
│ (i) The row appears with empty cells. Enter a value in any month to save it. │
│                                                                              │
│                                                          [Cancel]   [Assign] │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 3.6 Grid with People unreachable (T6.13, T7.4, D32)

Delivery's own data still loads. Without weekly hours and rates, only Person-months and % can be shown; names fall back to ids. The banner clears by itself when realtime reconnects (D29).

```text
┌─ Delivery ───────────────────────────────────────────────────────────────────────────────────────────────┐
│ ‹ Projects                                                                                               │
│ Ledger Consolidation · 1 Mar 2026 – 28 Feb 2027                                                          │
│                                                                                                          │
│ (!) People's data can't be reached. Hours and cost need weekly hours and rates, so only                  │
│     Person-months and % are shown, and people show as ids. Retrying…                                     │
│                                                                                                          │
│ Unit  ( ) Hours (unavailable)   (•) Person-months   ( ) % of capacity   ( ) Cost (unavailable)           │
│                                                                                                          │
│     ▾ Design  ⋯                     0.50    0.20    0.70    1.29    0.70    0.70  …    6.69              │
│         emp-001                     0.50       ·       ·       ·       ·       ·  …    0.50              │
│         emp-003                        ·       ·       ·   0.59†       ·       ·  …    0.59              │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.7 Unknown project (T6.2, D22)

```text
┌─ Delivery ───────────────────────────────────────────────────────────────────────────────────────┐
│ ‹ Projects                                                                                       │
│                                                                                                  │
│ Project not found: there is no project "prj-9".                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Common states (D32, D33, D37)

Every data page and every write has these states. They look the same in People and Delivery; People's wording is shown.

**Page loading** (D32). The page's own `Suspense` shows it; the shell's panel spinner is only for loading the remote's code.

```text
┌─ People ─────────────────────────────────────────────────────────────────────────────────────────┐
│ Employees                                                                                        │
│                                                                                                  │
│ ◌ Loading employees…                                                                             │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Page load failed** (D32). The page's error boundary, with a retry that refetches (`QueryErrorResetBoundary`).

```text
┌─ People ─────────────────────────────────────────────────────────────────────────────────────────┐
│ Employees                                                                                        │
│                                                                                                  │
│ (!) Employees couldn't be loaded: the People service didn't respond.                             │
│                                                                             [Try again]          │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Write failed** (D33). The optimistic change is undone, and the message sits at the top of the widget. Mutations aren't retried.

```text
┌─ Delivery ───────────────────────────────────────────────────────────────────────────────────────┐
│ (!) Your change wasn't saved: the Delivery service didn't respond. It has been undone.           │
│     Try again when the connection is back.                                                       │
│                                                                                                  │
│     ▾ Design  ⋯                     0.50    0.20    0.70    1.29    0.70    0.70  …    6.69      │
│         Adaeze Okafor               0.50       ·       ·       ·       ·       ·  …    0.50      │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Conflict** (D33). The server refused the write because the data changed (e.g. a rate with the same start date was added in another tab). The affected collections are refetched.

```text
┌─ People ─────────────────────────────────────────────────────────────────────────────────────────┐
│ (i) This data was changed elsewhere and has been reloaded. Check it and try again.               │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Record removed under a form** (D37). The form keeps the draft but can't save it.

```text
┌─ People ─────────────────────────────────────────────────────────────────────────────────────────┐
│ [ 2025-01-01 ]    [ 82.00   ]                                       [Save]      [Cancel]         │
│ (!) This rate was removed elsewhere, so the correction can't be saved.  (Save is disabled.)      │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Standalone mode (T2.3)

At `/remotes/people/…` and `/remotes/delivery/…`, each remote renders the same screens with no shell top bar or status strip, with the default currency (EUR) and a stub user. Every screen above looks the same there. The one cross-app link, a person name in the grid, opens People's standalone page for that employee (`/remotes/people/<employeeId>`, D22).

---

## 6. Open points the mockups raised

All decided on 2026-10-07 and written into the plan. Points 6–8 came from checking the plan and the screens against each other.

1. **Cell details panel (3.2): a new task, T6.12.** The acceptance checklist wants all five reference numbers _in the UI_ (plan §5), and the grid shows one unit at a time, so the panel shows them for the focused cell.
2. **Currency of the rate editor (2.3): the display currency.** Input is converted to EUR with `amount ÷ perEur`, as for € grid edits (D11, T5.3).
3. **A person row with no allocations (3.5): it disappears.** The row lives in the page until a value is saved; a reload before that removes it (T6.7, D31). Listed as a known limitation (T9.2).
4. **Row actions (3.4): a minimal `⋯` disclosure per row,** with no menu keyboard handling, drawn in the row's label cell so it needs no positioning (D36, T6.3). Later made a dropdown over the grid that closes on Esc or a click outside ([ADR 049](adr/049-row-actions-dropdown.md)).
5. **Cross-app link from a person row to People's detail view: yes,** through `HostContext.navigate` (T7.5, D22).
6. **Status strip (1.1): status and `remoteEntry.js` URL, no versions.** Nothing publishes a remote's version, and adding one would change `host-contract`; the URL shows runtime resolution instead (T4.4).
7. **No separate `Banner`.** A message at the top of a widget is an `InlineMessage` (D33).
8. **No `NumberField`.** Amounts are `TextField`s with `inputMode="decimal"`, parsed by `parseAmount` (D27, D34, T4.6).
