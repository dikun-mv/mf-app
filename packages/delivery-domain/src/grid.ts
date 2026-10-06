import type { BreakdownItemId } from '@baseline/delivery-contract';
import { at } from './lookup';

// The shape of a project grid, free of pricing and units: a tree of nodes whose leaves hold person
// rows, each row with one number per month. `rollUp` sums it exactly; `roundGrid` rounds it.

export interface GridRow {
  /** Unique within the grid, e.g. `wbs-012/emp-001`. */
  readonly key: string;
  /** One value per month, in the order of the grid's months. */
  readonly cells: readonly number[];
}

export interface GridNode {
  readonly id: BreakdownItemId;
  readonly children: readonly GridNode[];
  /** Person rows. Only leaves have them in valid data, but a node may hold both. */
  readonly rows: readonly GridRow[];
}

/** A row, node or the whole project: its value per month and its Total. */
export interface GridSums {
  readonly months: readonly number[];
  readonly total: number;
}

export interface GridTotals {
  readonly rows: ReadonlyMap<string, GridSums>;
  readonly nodes: ReadonlyMap<BreakdownItemId, GridSums>;
  readonly project: GridSums;
}

const zeros = (length: number): number[] => Array.from({ length }, () => 0);

function sumsOf(months: readonly number[]): GridSums {
  return { months, total: months.reduce((sum, value) => sum + value, 0) };
}

function addInto(target: number[], values: readonly number[]): void {
  values.forEach((value, index) => {
    target[index] = at(target, index) + value;
  });
}

/**
 * Derives every parent row and the project row from the person rows (T1.10). Parents are read-only:
 * a node's value is the sum of its members, never a stored number. Sums are exact; whatever is
 * passed in is summed as given, so pass exact values and round afterwards with `roundGrid`.
 */
export function rollUp(roots: readonly GridNode[], monthCount: number): GridTotals {
  const rows = new Map<string, GridSums>();
  const nodes = new Map<BreakdownItemId, GridSums>();

  const visit = (node: GridNode): readonly number[] => {
    if (nodes.has(node.id)) throw new RangeError(`Duplicate grid node ${node.id}`);
    const months = zeros(monthCount);
    nodes.set(node.id, sumsOf(months)); // Reserves the id; replaced once the sums are known.
    for (const row of node.rows) {
      if (row.cells.length !== monthCount) {
        throw new RangeError(`Row ${row.key} has ${String(row.cells.length)} cells for ${String(monthCount)} months`);
      }
      if (rows.has(row.key)) throw new RangeError(`Duplicate grid row ${row.key}`);
      rows.set(row.key, sumsOf(row.cells));
      addInto(months, row.cells);
    }
    for (const child of node.children) addInto(months, visit(child));
    nodes.set(node.id, sumsOf(months));
    return months;
  };

  const project = zeros(monthCount);
  for (const root of roots) addInto(project, visit(root));
  return { rows, nodes, project: sumsOf(project) };
}

/** The same tree with every row's cells replaced. Used to scale exact values and to apply rounding. */
export function mapRows(roots: readonly GridNode[], transform: (row: GridRow) => readonly number[]): GridNode[] {
  const mapNode = (node: GridNode): GridNode => ({
    id: node.id,
    children: node.children.map(mapNode),
    rows: node.rows.map((row) => ({ key: row.key, cells: transform(row) })),
  });
  return roots.map(mapNode);
}
