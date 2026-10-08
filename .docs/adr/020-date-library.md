# ADR 020: Date library (D20)

Status: accepted

## Decision

`date-fns` v4 with `@date-fns/utc` (`UTCDate`) for all calendar maths. Dates cross boundaries as strings (`IsoDate` `YYYY-MM-DD`, `Month` `YYYY-MM`) and become `UTCDate` only inside the domain package's calendar module.

## Alternatives

Native `Date` only; Temporal.

## Why

Small, tree-shakeable pure functions that run the same in Node and the browser. Doing the maths in UTC makes working-day counts independent of the time zone, so 12 Mar 2026 can't become 11 Mar.
