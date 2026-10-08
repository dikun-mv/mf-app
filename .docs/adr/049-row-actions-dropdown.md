# ADR 049: Row actions open as a dropdown over the grid (amends D36)

Status: accepted (2026-10-08, after Phase 7). Amends [ADR 046](046-grid-keyboard-and-accessibility.md).

## Context

[ADR 046](046-grid-keyboard-and-accessibility.md) drew a WBS row's actions inside its label cell, in normal flow under the name, so nothing had to be positioned inside the scrolling table. In use, the rows below jump down by the height of the list each time `⋯` is pressed, and the list stretches the sticky label column. The positioning problem that the in-flow list avoided now has a native answer: the Popover API puts an element in the top layer, so the grid's scrolling box can't clip it and the sticky columns can't cover it, and CSS anchor positioning places it against its button without measuring anything in script.

## Decision

- **The list is a manual popover anchored to `⋯`.** When it mounts, the list calls `showPopover()` and takes the `⋯` button's `anchor-name` as its `position-anchor`. It sits under the button, starting at the button's edge (`position-area: block-end span-inline-end`). Where there's no room it flips above or to the left, and it hides when its row scrolls out of the grid (`position-visibility: anchors-visible`).
- **It stays in the label cell in the DOM,** so Tab reaches the actions straight after `⋯`, and `aria-expanded` and `aria-controls` are unchanged.
- **Esc or a press outside the list and `⋯` closes it.** Esc gives focus back to `⋯` when focus was inside the list. These are two document listeners while the list is open, not the popover's own light dismiss: with `popover="auto"` the browser would close the list without telling the grid, which owns which list is open (one at a time, [ADR 041](041-client-state.md)).
- **Where popovers or anchor positioning aren't supported,** the floating styles don't apply (they sit under `:popover-open` and `@supports (position-area: …)`). Without popovers the list falls back to ADR 046's in-flow list, and that is what jsdom tests see. Without anchor positioning the popover shows at the UA default, centred in the viewport.
- **A refused action's reason is in a tooltip, not inline text.** A small `?` button beside the disabled action shows the reason on hover or focus. It is a button because a disabled action can't take focus, and the keyboard has to reach the reason. The tooltip (`role="tooltip"`) is in the `aria-describedby` of both the action and the `?`, as D36 asks of the markers' tooltips. The list sets `overflow: visible`, so the popover doesn't clip it.
- **Action labels lose their trailing `…`:** Move, Delete and Assign person, as written in `rowActions`.
- **Everything else in ADR 046 stays:** plain buttons, disabled actions never hidden, no `role="menu"` and no arrow keys.

## Alternatives

- **Keep the in-flow list.** No positioning at all, but the grid reflows on every open.
- **An absolutely positioned list inside the label cell.** The scrolling box (`overflow-x: auto`, which also clips vertically) cuts off lists near the last rows, and the list would need its own stacking context over the sticky cells.
- **`popover="auto"` with its native light dismiss.** No listeners to write, but a press on `⋯` while the list is open first light-dismisses it and then reopens it. The grid's state would need syncing from the `toggle` event.

## Consequences

- Opening a row's actions no longer moves the rows below it, and the list is never clipped by the grid.
- The row actions depend on the Popover API and CSS anchor positioning in the browser. Older browsers get the in-flow list or a centred popover, and both still work.
- The disclosure has a little focus management (Esc returns focus to `⋯`), which ADR 046 had none of.
- The list is narrower without the inline reasons. A reason now takes a hover or one more Tab stop to read.
