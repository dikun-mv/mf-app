import { BreakdownItemId } from '@baseline/delivery-contract';
import type { GridNode, GridRow } from '../grid';

// Small builders so grid tests read as tables.

let nextId = 0;

export function row(key: string, ...cells: number[]): GridRow {
  return { key, cells };
}

export function leaf(id: string, ...rows: GridRow[]): GridNode {
  return { id: BreakdownItemId.parse(`wbs-${id}`), children: [], rows };
}

export function parent(id: string, ...children: GridNode[]): GridNode {
  return { id: BreakdownItemId.parse(`wbs-${id}`), children, rows: [] };
}

/** A fresh node id for generated grids. */
export function freshId(): string {
  nextId += 1;
  return String(nextId);
}
