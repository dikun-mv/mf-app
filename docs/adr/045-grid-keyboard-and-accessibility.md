# ADR 045: A plain table, Tab order and a minimal row disclosure (D36)

Status: accepted (2026-10-07, after Phase 3 and before Phase 4). The row disclosure was decided with [screens.md](../screens.md) §3.4 and §6.

## Context

The staffing grid is the most interactive screen: editable cells, expand and collapse, and WBS actions per row. It needs to work with a keyboard and a screen reader without a grid widget library, and without a menu that positions itself inside a scrolling table.

## Decision

- **A plain `<table>` with native semantics and Tab order.** Row and column headers are `<th scope>`.
- Each editable leaf cell shows its value in a `<button>` whose accessible name includes the row, month and unit. Enter or a click opens the editor (an `<input inputMode="decimal">`); Enter or blur saves, Esc cancels, and focus returns to the button.
- Derived rows' value cells aren't focusable; only the controls in a row's label are (expand or collapse, and `⋯` on WBS rows).
- Markers (`†`, unpriced, partially priced) have visible text, and their tooltip text is linked through `aria-describedby`, not only `title`.
- **No arrow-key navigation.**
- **WBS row actions are a minimal `⋯` disclosure per row:** a button (`aria-expanded`, `aria-label="Actions for <name>"`) shows or hides plain buttons (Rename, Add child, Move…, Delete…, and Assign person… on leaves) inside the row's label cell, in normal flow under the name, so nothing is positioned or clipped by the scrolling grid. One menu is open at a time (local state, [ADR 041](041-client-state.md)); choosing an action or pressing `⋯` again closes it. A disabled action shows its reason as text next to it.
- No `role="menu"`, arrow keys, Esc or outside-click handling, and no focus management: native buttons already work with Tab and Enter.

## Alternatives

- **Future option, not built:** `role="grid"` with a roving tabindex and arrow keys (one tab stop for the whole grid).

## Consequences

- Native table semantics cost nothing and screen readers already understand them; `jsx-a11y` (D24) checks the markup.
- Tabbing across a row of months is slow but correct. Arrow keys can be added later inside `widgets/staffing-grid` without changing `GridCell`'s props. T9.2 lists it as a known limitation.
