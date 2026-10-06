import { type FlowEdge, type FlowNode, CostFlowNetwork, UNBOUNDED } from './flow';
import { type GridNode, type GridTotals, mapRows, rollUp } from './grid';
import { at, required } from './lookup';
import { REMAINDER_SCALE, splitSteps, stepsOf } from './rounding';
import type { DisplayUnit } from './units';

// Controlled rounding across a whole project grid (D19, T1.9). Each leaf cell goes down or up to
// a whole display step, chosen jointly, so that every sum in the grid is the floor or the ceiling of
// its exact value and everything adds up in both directions:
//
//   - the month sums: every node and the project, per month (nested by the tree), and
//   - the Totals: every person row, every node and the project (nested by the tree too).
//
// Both families are trees over the same cells, so an integer solution always exists (the
// constraint matrix is a network matrix). It is found as a min-cost flow: one unit of flow is one
// cell rounded up, and it travels source -> project month -> ... -> leaf cell -> person row ->
// ... -> project Total -> sink. Every sum is an edge bounded by its floor and ceiling.
//
// Costs, in order of priority:
//   1. A sum of two or more cells that doesn't end at its nearest whole step costs 1. This is what
//      makes a single row equal largest-remainder rounding: its Total is rounded to nearest first.
//   2. Rounding a cell up costs `1 - 2 * remainder`, in millionths of a step, less one more
//      millionth so that exactly half a step rounds up. Cells with the largest remainder go up
//      first; ties go to the earlier row, then the earlier month.

/** Sums of whole steps and remainders over a set of cells. */
interface Agg {
  whole: number;
  remainder: number;
  cells: number;
}

const emptyAgg = (): Agg => ({ whole: 0, remainder: 0, cells: 0 });

function addAgg(target: Agg, other: Agg): void {
  target.whole += other.whole;
  target.remainder += other.remainder;
  target.cells += other.cells;
}

/** How many cells of a set are rounded up: its exact sum's floor or ceiling. */
function upsBounds({ remainder }: Agg): { lower: number; upper: number } {
  const lower = Math.floor(remainder / REMAINDER_SCALE);
  return { lower, upper: lower + (remainder % REMAINDER_SCALE > 0 ? 1 : 0) };
}

/** A person row with its cells split into whole steps and remainders. */
interface RowPlan {
  readonly key: string;
  /** Position in row order, which breaks ties between equal remainders. */
  readonly order: number;
  readonly cells: readonly { readonly whole: number; readonly remainder: number }[];
  readonly total: Agg;
  /** One flow edge per cell, filled in when the network is built. */
  readonly edges: FlowEdge[];
}

/** Every sum the rounding has to respect for a node or for the whole project. */
interface SumPlan {
  readonly months: readonly Agg[];
  readonly total: Agg;
  readonly rows: readonly RowPlan[];
  readonly children: readonly NodePlan[];
}

interface NodePlan extends SumPlan {
  readonly id: GridNode['id'];
}

/**
 * Rounds a grid of exact values to whole steps of `unit`. `roots` hold exact values in that unit
 * (cost already in the display currency). Returns whole steps, so pass them to `formatUnit`:
 * every row, node and the project row with its months and Total.
 */
export function roundGrid(roots: readonly GridNode[], monthCount: number, unit: DisplayUnit): GridTotals {
  const scale = stepsOf(unit);
  // Also validates the shape, so the plan below can rely on it.
  const exact = rollUp(
    mapRows(roots, (row) => row.cells.map((cell) => cell * scale)),
    monthCount,
  );

  const plans = planGrid(roots, monthCount, scale);
  const cellCount = plans.rowCount * monthCount;
  const tieBreakSpan = cellCount + 1;
  if (cellCount * (REMAINDER_SCALE * tieBreakSpan + cellCount) > Number.MAX_SAFE_INTEGER) {
    throw new RangeError(`A grid of ${String(cellCount)} cells is too large to round exactly`);
  }

  const network = new CostFlowNetwork();
  const source = network.addNode();
  const sink = network.addNode();
  network.addEdge(sink, source, 0, UNBOUNDED, { primary: 0, secondary: 0 });

  /**
   * An edge for one sum. It is counted (priority 1) only when it covers two or more cells and isn't
   * the same set as the edge around it, so a chain of single-child nodes isn't counted repeatedly.
   */
  const sumEdge = (from: FlowNode, to: FlowNode, agg: Agg, enclosingCells: number): void => {
    const { lower, upper } = upsBounds(agg);
    const counted = upper > lower && agg.cells >= 2 && agg.cells !== enclosingCells;
    const nearestIsCeiling = (agg.remainder % REMAINDER_SCALE) * 2 >= REMAINDER_SCALE;
    const primary = counted ? (nearestIsCeiling ? -1 : 1) : 0;
    network.addEdge(from, to, lower, upper, { primary, secondary: 0 });
  };

  const build = (node: SumPlan, monthNodes: readonly FlowNode[], totalNode: FlowNode): void => {
    for (const row of node.rows) {
      const rowNode = network.addNode();
      row.cells.forEach((cell, month) => {
        const tieBreak = row.order * monthCount + month;
        const secondary = cell.remainder > 0 ? (REMAINDER_SCALE - 2 * cell.remainder - 1) * tieBreakSpan + tieBreak : 0;
        row.edges.push(
          network.addEdge(at(monthNodes, month), rowNode, 0, cell.remainder > 0 ? 1 : 0, { primary: 0, secondary }),
        );
      });
      sumEdge(rowNode, totalNode, row.total, node.total.cells);
    }

    for (const child of node.children) {
      const childMonths = child.months.map((agg, month) => {
        const childNode = network.addNode();
        sumEdge(at(monthNodes, month), childNode, agg, at(node.months, month).cells);
        return childNode;
      });
      const childTotal = network.addNode();
      sumEdge(childTotal, totalNode, child.total, node.total.cells);
      build(child, childMonths, childTotal);
    }
  };

  // The project is a node like any other, fed by the source and drained into the sink.
  const projectMonths = plans.project.months.map((agg) => {
    const node = network.addNode();
    sumEdge(source, node, agg, Infinity);
    return node;
  });
  const projectBottom = network.addNode();
  sumEdge(projectBottom, sink, plans.project.total, Infinity);
  build(plans.project, projectMonths, projectBottom);

  network.solve();

  const displayed = plans.project.children.map(function display(node): GridNode {
    return {
      id: node.id,
      children: node.children.map(display),
      rows: node.rows.map((row) => ({
        key: row.key,
        cells: row.cells.map((cell, month) => cell.whole + at(row.edges, month).flow),
      })),
    };
  });
  const result = rollUp(displayed, monthCount);
  assertWithinOneStep(exact, result);
  return result;
}

/** Splits every cell and totals every set, in row order (the tie-break order). */
function planGrid(
  roots: readonly GridNode[],
  monthCount: number,
  scale: number,
): { project: SumPlan; rowCount: number } {
  let rowCount = 0;
  const planNode = (node: GridNode): NodePlan => {
    const months = Array.from({ length: monthCount }, emptyAgg);
    const total = emptyAgg();
    const rows = node.rows.map((row): RowPlan => {
      const cells = row.cells.map((cell) => splitSteps(cell * scale));
      const rowTotal = emptyAgg();
      cells.forEach((cell, month) => {
        const one = { whole: cell.whole, remainder: cell.remainder, cells: 1 };
        addAgg(at(months, month), one);
        addAgg(rowTotal, one);
      });
      addAgg(total, rowTotal);
      rowCount += 1;
      return { key: row.key, order: rowCount - 1, cells, total: rowTotal, edges: [] };
    });
    const children = node.children.map(planNode);
    for (const child of children) {
      child.months.forEach((agg, month) => {
        addAgg(at(months, month), agg);
      });
      addAgg(total, child.total);
    }
    return { id: node.id, months, total, rows, children };
  };

  const children = roots.map(planNode);
  const months = Array.from({ length: monthCount }, emptyAgg);
  const total = emptyAgg();
  for (const child of children) {
    child.months.forEach((agg, month) => {
      addAgg(at(months, month), agg);
    });
    addAgg(total, child.total);
  }
  return { project: { months, total, rows: [], children }, rowCount };
}

/** Fails loudly if a sum is further than one step from its exact value: that would be a bug here. */
function assertWithinOneStep(exact: GridTotals, rounded: GridTotals): void {
  const tolerance = 1 + 1e-5;
  const compare = (label: string, want: GridTotals['project'], got: GridTotals['project']): void => {
    const pairs: [string, number, number][] = [
      ...want.months.map((value, month): [string, number, number] => [
        `${label} month ${String(month)}`,
        value,
        at(got.months, month),
      ]),
      [`${label} total`, want.total, got.total],
    ];
    for (const [name, wanted, actual] of pairs) {
      /* istanbul ignore next -- the network's bounds already guarantee this; it catches a bug in them */
      if (Math.abs(actual - wanted) > tolerance) {
        throw new Error(`roundGrid: ${name} is ${String(actual)} steps, exact ${String(wanted)}`);
      }
    }
  };
  compare('project', exact.project, rounded.project);
  for (const [id, sums] of exact.nodes) compare(`node ${id}`, sums, required(rounded.nodes, id));
  for (const [key, sums] of exact.rows) compare(`row ${key}`, sums, required(rounded.rows, key));
}
