# ADR 018: "Most recently edited" (D18)

Status: accepted; amended by [ADR 032](032-pocketbase-data-layer.md) (2026-10-07)

## Decision

`Allocation.editedAt: IsoDateTime`, never null. Seeding gives every seed row the same `seededAt`. Each effort edit sets `editedAt = now` on the server, in a `delivery-pb` request hook (on create, or when `amount` changes), as `toISOString()` (UTC, millisecond precision, fixed length, so string comparison sorts by time). Moves and D9 re-pointing don't change it.

The causer is the contributing allocation with the latest `editedAt`, ties broken by the highest `id`, with one ordering for every comparison. The seed causers are therefore the higher id in each pair (alloc-293, -073, -043, -101, -613, -421). No `editedBy`.

## Future option (not built)

Add `editedBy: UserId`, stamped from the shell's active user. It doesn't change the causer rule; it only enriches the tooltip.

## Alternatives rejected

Strictly increasing timestamps, or a revision counter: they need invented seed timestamps or an extra counter.

## Why

Meets the brief's rule with one truthful field, with no nullable special case. Residual risk: two user edits to the same person-month within one millisecond are ordered by id. That is practically unreachable, because edits are separate HTTP requests handled one at a time, and it is deterministic anyway.
