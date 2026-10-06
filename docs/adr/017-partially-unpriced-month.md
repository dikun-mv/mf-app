# ADR 017: Partially unpriced month (D17)

Status: accepted

## Decision

Days before the first rate cost 0, and € edits are refused in that month. Slicing treats the days before `validFrom` as an unpriced slice. The cell is marked `partiallyPriced` with a tooltip such as "8 of 22 working days are before the first rate (12 Mar) and aren't costed". It stays editable in hours, PM and %. The displayed rate is the blended rate over priced days only.

The rule lives in one function, `euroEditRate(month, rates) -> Result<Rate, 'unpriced' | 'partiallyPriced'>`.

## Future option (not built)

Allow € edits too. A € edit would divide by the effective rate over all working days, with unpriced days counting as 0, so it round-trips exactly. Switching means changing only `euroEditRate` and its tests.

## Why

Correct costs with no confusing diluted rate, and consistent with fully unpriced months, which must refuse € edits anyway. Cost: those cells can't be edited in €.
