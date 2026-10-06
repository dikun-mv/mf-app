# ADR 016: Deleting an employee (D16)

Status: accepted

## Decision

Forbidden. `people-api` has no delete endpoint and People's UI has no delete action.

## Alternative

People emits an event and Delivery marks the orphaned allocations.

## Why

The brief doesn't require it, and forbidding it removes a whole class of cross-team orphan states. The invariant checker still reports unknown employees, in case data is changed by hand.
