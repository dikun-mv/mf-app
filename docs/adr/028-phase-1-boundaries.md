# ADR 028: Phase 1 boundaries (T1.1, T1.13)

Status: accepted (found while building Phase 1; not one of D1-D25)

## Decisions

1. **Entity schemas start in the contracts.** T1.1 says to create the contract packages "with just these types" and leave the rest to T3.1-T3.3. The domain code needs `Employee`, `RateRecord`, `Project`, `BreakdownItem`, `Allocation` (with `editedAt`, D18) and `EmployeeMonthLoad` to be typed at all, and defining them in the domain packages would mean redefining them later. So they are in the contracts now. T3.1-T3.3 still add the REST paths, the events, the conformance fixture and the `HostContext` types.
2. **`entityId(prefix, brand)` in `host-contract`** builds every id schema (`wbs-012` or `wbs-<uuid>`, T1.1), so the seed-or-uuid rule exists once.
3. **`Result` is defined in each domain package** (three lines), not shared, so neither team imports the other's helpers.
4. **People keeps its own small calendar** (`people-domain/src/calendar.ts`, the same UTC maths as Delivery's). `pricingImpact` has to know whether a month has working days before an employee's first rate, and People can't import `delivery-domain` (T0.2). The two agree on the rule; T3.1's conformance fixture is where that is checked across the boundary.
5. **A contract's own tests may import the test tools.** `contracts-are-leaves` now ignores `*.test.ts` on the importing side; production files of a contract are held to it as before. The fixture test in `.dependency-cruiser.test.ts` proves both halves.
6. **Moving onto a leaf that has allocations** (T1.12, D9) hands them to the moved item only when the moved item is itself a leaf whose allocations don't collide with them. Otherwise it is refused (`targetHasAllocations`, `allocationConflict`), because allocations can't sit on a parent and merging two amounts into one would hide a change of effort.
7. **An unchanged amount is not an edit.** `upsertAllocation` returns an empty change set and keeps `editedAt`, so saving a cell without changing it can't make it the capacity causer (D18).
8. **Coverage.** `pnpm test:coverage` (Rstest, istanbul). `delivery-domain` and `people-domain` are at 100% of statements, branches, functions and lines. Two throws that guard against a bug in the solver, which no input can reach, carry an `istanbul ignore` with the reason.

## Found along the way

- zod 4 ignores `.finite()` (infinity is rejected by default) and marks it deprecated, so the contracts don't use it.
- Under Rstest 0.12.3 a test can set `process.env.TZ` at runtime and `Date` really changes zone. The calendar test first checks that the offsets differ, so the time-zone check can't pass vacuously.
