# ADR 008: Capacity flow (D8)

Status: superseded by [ADR 032](032-pocketbase-data-layer.md) (2026-10-07), before Phase 3 was built

## Decision

Delivery owns allocations, so `delivery-api` publishes a load contract at `GET /api/delivery/v1/load`, built with the same `delivery-domain` capacity aggregation the grid uses. Per `(employeeId, month)` it sends `allocatedPersonMonths`, `overCapacity` (computed by the capacity rule, so the threshold and epsilon live only in `delivery-domain`) and `causingAllocationId`, and it emits `load.changed` over SSE. People shows oversubscription wherever `overCapacity` is true.

## Alternative

People fetches raw allocations.

## Why

Allocations stay private. People needs no calendar logic, because PM is already capacity-normalised. The aggregation exists only once.
