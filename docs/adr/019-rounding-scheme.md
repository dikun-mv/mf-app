# ADR 019: Rounding scheme (D19)

Status: accepted

## Decision

Controlled rounding across the whole grid: `roundGrid(tree, months, exact, unit) -> displayed`. Each leaf cell is rounded down or up to the display step, chosen jointly, so every displayed number is within one step of its exact value (leaf cells, parent cells, every row Total and the project row) and everything adds up in both directions. Solved as a min-cost flow; the cost of rounding a cell up is `1 - 2 * remainder`, so in a single row this reduces to largest-remainder rounding.

## Alternative rejected

Top-down largest remainder (about 40 lines). In a stress test (+-10% edits, 20 runs, all projects and units) about 8% of parent cells were off their exact value by more than one step, up to 0.05.

## Why

The only option that meets brief section 3.7 everywhere: 0 violations in about 224,000 checked cells in the same stress test. Cost: about 150-200 lines of pure TS in `delivery-domain`. Known effect: editing one cell can move a neighbour by one display step (neighbour jitter).
