import type { Allocation, ProjectId } from '@baseline/delivery-contract';
import type { Currency } from '@baseline/host-contract';
import type { EmployeeId, RateRecord } from '@baseline/people-contract';
import type { EmployeeData } from './cellDetails';
import type { PlanState } from './changeSet';
import { formatMonth, formatMonthShort } from './format';
import { type GridNode, type GridSums, rollUp } from './grid';
import type {
  GridMonthView,
  GridRowView,
  GridValue,
  GridView,
  GridViewError,
  PeopleData,
  PersonRowView,
} from './gridViewTypes';
import { at, required } from './lookup';
import { createPersonCells, gridValue } from './personCells';
import { percentFromPersonMonths, valueInUnit } from './pricing';
import { buildGrid, projectMonths, rowKey } from './projectGrid';
import { type Result, err, ok } from './result';
import { roundGrid } from './roundGrid';
import { indexItems } from './tree';
import { DISPLAY_UNITS, type DisplayUnit, personMonths } from './units';

// The grid view model (D35, T6.0): everything the staffing grid shows for one project in one unit,
// calculated without React. It is built on `buildGrid` (the layout), `rollUp` (exact sums) and
// `roundGrid` (the displayed numbers, controlled so every sum adds up), and adds the cell states,
// markers and the details of T6.12.

const PROJECT_ROW_KEY = 'project';

/** Hours and cost need weekly hours and rates, which only People has (D32). */
const needsPeople = (unit: DisplayUnit): boolean => unit === 'hours' || unit === 'cost';

/** The units the grid can show: all four, or person-months and % while People's data is missing (screens 3.6). */
export const availableUnits = (people: PeopleData | null): readonly DisplayUnit[] =>
  people === null ? DISPLAY_UNITS.filter((unit) => !needsPeople(unit)) : DISPLAY_UNITS;

function employeesOf(people: PeopleData | null): Map<EmployeeId, EmployeeData> {
  const ratesOf = new Map<EmployeeId, RateRecord[]>();
  for (const record of people?.rates ?? []) {
    const list = ratesOf.get(record.employeeId);
    if (list === undefined) ratesOf.set(record.employeeId, [record]);
    else list.push(record);
  }
  return new Map(
    (people?.employees ?? []).map((employee) => [
      employee.id,
      { name: employee.name, weeklyHours: employee.weeklyHours, rates: ratesOf.get(employee.id) ?? [] },
    ]),
  );
}

/**
 * The grid of one project in one unit, with `currency` for cost (rates are in EUR and converted before
 * any rounding, D11). `plan` holds every project's allocations, because over capacity is a person's
 * load across all of them (D8); the grid shows only `projectId`. With `people` null, only
 * person-months and % exist and people are shown by id (D32); asking for hours or cost is an error.
 */
export function gridView(
  plan: PlanState,
  people: PeopleData | null,
  projectId: ProjectId,
  unit: DisplayUnit,
  currency: Currency,
): Result<GridView, GridViewError> {
  const project = plan.projects.find((candidate) => candidate.id === projectId);
  if (project === undefined) return err({ code: 'notFound', entity: 'project', id: projectId });
  if (!availableUnits(people).includes(unit)) return err({ code: 'unitUnavailable', unit });

  const index = indexItems(plan.items);
  const inProject = new Set(plan.items.filter((item) => item.projectId === projectId).map((item) => item.id));
  const allocations = plan.allocations.filter((allocation) => inProject.has(allocation.breakdownItemId));
  const employees = employeesOf(people);
  if (needsPeople(unit)) {
    const unknown = allocations.find((allocation) => !employees.has(allocation.employeeId));
    if (unknown !== undefined) return err({ code: 'unknownEmployee', employeeId: unknown.employeeId });
  }

  const months = projectMonths(project);
  const exactOf = (allocation: Allocation): number => {
    const pm = personMonths(allocation.amount);
    if (unit === 'personMonths') return pm;
    if (unit === 'percent') return percentFromPersonMonths(pm);
    const { weeklyHours, rates } = required(employees, allocation.employeeId);
    return valueInUnit(unit, pm, { weeklyHours, month: allocation.month, rates }, currency.perEur);
  };
  const roots = buildGrid(project, plan.items, allocations, months, exactOf);
  const exact = rollUp(roots, months.length);
  const rounded = roundGrid(roots, months.length, unit);

  const valueOf = (exactValue: number, steps: number): GridValue => gridValue(exactValue, steps, unit, currency.code);
  const sumValues = (exactSums: GridSums, steps: GridSums) => ({
    cells: exactSums.months.map((value, position) => valueOf(value, at(steps.months, position))),
    total: valueOf(exactSums.total, steps.total),
  });

  /** Which employee a person row belongs to: the row key only holds their id as text. */
  const employeeOfRow = new Map(allocations.map((a) => [rowKey(a.breakdownItemId, a.employeeId), a.employeeId]));
  const personCell = createPersonCells({ plan, allocations, index, months, unit, currency, employees, exact, rounded });

  // ---- The rows, in tree order ----

  const rows: GridRowView[] = [
    {
      kind: 'project',
      key: PROJECT_ROW_KEY,
      parentKey: null,
      depth: 0,
      label: project.name,
      itemId: null,
      isLeaf: false,
      ...sumValues(exact.project, rounded.project),
    },
  ];

  const visit = (node: GridNode, parentKey: string, depth: number): void => {
    const sums = sumValues(required(exact.nodes, node.id), required(rounded.nodes, node.id));
    const item = required(index.byId, node.id);
    rows.push({
      kind: 'node',
      key: node.id,
      parentKey,
      depth,
      label: item.name,
      itemId: node.id,
      isLeaf: node.children.length === 0,
      ...sums,
    });
    for (const row of node.rows) {
      const employeeId = required(employeeOfRow, row.key);
      const total = valueOf(required(exact.rows, row.key).total, required(rounded.rows, row.key).total);
      const data = employees.get(employeeId);
      const person: PersonRowView = {
        kind: 'person',
        key: row.key,
        parentKey: node.id,
        depth: depth + 1,
        label: data === undefined ? employeeId : data.name,
        itemId: node.id,
        employeeId,
        cells: months.map((_, position) => personCell(node.id, employeeId, position)),
        total,
      };
      rows.push(person);
    }
    for (const child of node.children) visit(child, node.id, depth + 1);
  };
  for (const root of roots) visit(root, PROJECT_ROW_KEY, 1);

  const monthViews: GridMonthView[] = months.map((month) => ({
    month,
    label: formatMonthShort(month),
    name: formatMonth(month),
  }));
  return ok({ project, unit, currency: currency.code, months: monthViews, rows });
}
