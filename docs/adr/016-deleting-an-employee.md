# ADR 016: Deleting an employee (D16)

Status: accepted; amended by [ADR 032](032-pocketbase-data-layer.md) (2026-10-07)

## Decision

Forbidden. The `employees` collection in `people-pb` keeps its create and delete API rules locked (superusers only), and People's UI has no delete action.

## Alternative

People emits an event and Delivery marks the orphaned allocations.

## Why

The brief doesn't require it, and forbidding it removes a whole class of cross-team orphan states. The invariant checker still reports unknown employees, in case data is changed by hand.
