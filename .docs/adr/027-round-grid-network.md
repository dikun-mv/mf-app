# ADR 027: The roundGrid network (D19, T1.9)

Status: accepted (the plan left the min-cost-flow implementation to the implementer)

## Decision

`roundGrid` is a hand-written min-cost circulation with lower bounds (`packages/delivery-domain/src/flow.ts`, about 150 lines), driven by `roundGrid.ts`.

- **Network.** One unit of flow is one cell rounded up. It travels source, project month, down the tree to a leaf cell, person row, up the tree to the project Total, sink. Every sum (each node and month, each row Total, each node Total, the project) is an edge bounded by the floor and ceiling of its exact up-count, so every displayed sum is within one step of its exact value.
- **Solver.** Start every edge at its cheapest end (the upper bound when a unit earns money, otherwise the lower bound), so every residual arc has a non-negative cost. Then repair the node imbalances with successive shortest paths (queue-based Bellman-Ford). It throws if no feasible flow exists, which would mean a bug in the network, since one always does.
- **Exact arithmetic.** Steps are integers. A remainder is kept as a whole number of millionths of a step, so sums of remainders are exact, and a value within one millionth of a whole step snaps to it (a typed `0.33` stays `0.33`). Costs are pairs compared in order, so no weight can overflow a double. A guard refuses a grid too large to stay exact (over about 90,000 cells).

## Costs, in order of priority

1. **A sum of two or more cells that does not end at its nearest whole step costs 1.** A chain of single-child nodes counts once, not once per node.
2. **Rounding a cell up costs `1 - 2 * remainder`, less one millionth so exactly half a step rounds up.** Ties go to the earlier row, then the earlier month.

## Why priority 1 exists: a correction to D19

D19 and the plan say that with only the second cost (`1 - 2 * remainder`), a single row "reduces exactly to largest-remainder rounding". It does not. Each Total may end at its floor or its ceiling, and the second cost alone picks whichever is cheaper for the cells, not the one nearest the exact Total. Example: five cells with remainders 0.9, 0.9, 0.9, 0.9 and 0.8 have an exact Total of 4.4 steps. Largest remainder gives a Total of 4; the second cost alone gives 5. Both are within one step and both add up, so the guarantees hold either way, but the plan also requires `roundGrid` on a single row to equal `largestRemainder` (T1.9). Priority 1 restores that: the Total is rounded to nearest first, then the cells by largest remainder. A property test checks the equality on random single rows.

## Verified

- Random trees up to three levels and 1 to 6 months, in all four units, 400 runs by default and 5,000 when checked by hand (`FC_RUNS=5000 pnpm test`): every displayed number within one step of its exact value, every row Total equal to the sum of its cells, every parent cell equal to the sum of its displayed children, every cell a whole step within one step of its exact value, deterministic.
- The seed: all 4 projects in all 4 units, and 20 random +-10% edits of every cell (the D19 stress test): no violation.
- A hand-made case where top-down rounding fails: three people each with 0.4 and 0.6 steps in two months have a row Total of exactly 1 step, so top-down puts all three steps in month 2 and the parent reads 0 and 3 for exact values 1.2 and 1.8. `roundGrid` gives 1 and 2.

## Known effect

Unchanged from D19: editing one cell can move a neighbour by one display step.
