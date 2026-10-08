# ADR 041: No global client store; the URL holds what is shareable (D31)

Status: accepted (2026-10-07, after Phase 3 and before Phase 4). Builds on [ADR 022](022-routing.md).

## Context

Server state goes to the query cache ([ADR 036](036-server-state.md)) and form state to react-hook-form ([ADR 037](037-form-state.md)). What is left is a small amount of view state, and the brief's "State ownership" asks that each piece has one owner.

## Decision

**No global client store.**

- **State a user would want to reload or share lives in the URL,** parsed with zod and defaulted when invalid: Delivery's unit (`?unit=hours|personMonths|percent|cost`, the `DISPLAY_UNITS` values, default `personMonths`) and People's register search (`?q=`). The open employee and project are already path segments (D22).
- **Short-lived state stays local** to its widget or feature: the cell being edited and its draft, expanded tree nodes (all expanded on load), open dialogs, and a person row assigned to a leaf but with no value saved yet (T6.7).
- **The display currency and active user come only from `HostContext`** (D11), never copied into state.

## Alternatives

- **Zustand or Redux; one React context per concern; the unit in `localStorage`.** With server and form state placed elsewhere, a store would have nothing left to hold. Contexts per concern re-render their consumers on every change. `localStorage` means a shared link doesn't show what its sender saw.

## Consequences

- Each piece of state has one owner, and reload and deep links keep what matters.
- A newly assigned person row with no values is gone after a reload; it is listed as a known limitation (T9.2).
- An invalid `?unit=` or `?q=` falls back to the default instead of failing.
