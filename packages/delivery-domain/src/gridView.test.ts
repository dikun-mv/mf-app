import { ProjectId } from '@baseline/delivery-contract';
import { CurrencyCode, IsoDate, type Currency } from '@baseline/host-contract';
import { RateRecordId } from '@baseline/people-contract';
import { describe, expect, it } from '@rstest/core';
import type { PlanState } from './changeSet';
import { availableUnits, gridView } from './gridView';
import type { GridRowView, GridView, PeopleData, PersonCellView, PersonRowView } from './gridViewTypes';
import { seedEmployee, seedEmployees, seedPlan, seedRateRecords } from './testing/seed';
import { allocation, item, plan, project } from './testing/stateBuilders';
import { DISPLAY_UNITS, type DisplayUnit } from './units';

const EUR: Currency = { code: CurrencyCode.parse('EUR'), perEur: 1 };
const USD: Currency = { code: CurrencyCode.parse('USD'), perEur: 1.08 };
const people: PeopleData = { employees: seedEmployees, rates: seedRateRecords };
const seeded = seedPlan();
const prj = (n: number) => ProjectId.parse(`prj-${String(n)}`);

function viewOf(
  state: PlanState,
  data: PeopleData | null,
  projectId: ProjectId,
  unit: DisplayUnit,
  currency: Currency = EUR,
): GridView {
  const result = gridView(state, data, projectId, unit, currency);
  if (!result.ok) throw new Error(`expected a grid, got ${JSON.stringify(result.error)}`);
  return result.value;
}

const seedView = (unit: DisplayUnit, currency: Currency = EUR, data: PeopleData | null = people, n = 1) =>
  viewOf(seeded, data, prj(n), unit, currency);

function personRow(view: GridView, key: string): PersonRowView {
  const row = view.rows.find((candidate) => candidate.key === key);
  if (row?.kind !== 'person') throw new Error(`no person row ${key}`);
  return row;
}

function rowOf(view: GridView, key: string): GridRowView {
  const row = view.rows.find((candidate) => candidate.key === key);
  if (row === undefined) throw new Error(`no row ${key}`);
  return row;
}

function cellOf(view: GridView, key: string, month: string): PersonCellView {
  const cell = personRow(view, key).cells.find((candidate) => candidate.month === month);
  if (cell === undefined) throw new Error(`no cell ${key} ${month}`);
  return cell;
}

const REFERENCE = 'wbs-012/emp-001';
const OKAFOR = seedEmployee('emp-001').id;

describe('gridView layout (screens 3.2)', () => {
  const view = seedView('personMonths');

  it('has a column per month of the project span, with short and full names', () => {
    expect(view.months).toHaveLength(12);
    expect(view.months[0]).toEqual({ month: '2026-03', label: 'Mar 26', name: 'Mar 2026' });
    expect(view.months.at(-1)?.label).toBe('Feb 27');
    expect(view.unit).toBe('personMonths');
    expect(view.currency).toBe('EUR');
    expect(view.project.name).toBe('Ledger Consolidation');
  });

  it('starts with the project row, then WBS rows in tree order with person rows under their leaf', () => {
    const [first, second, third, fourth, fifth] = view.rows;
    expect(first).toMatchObject({ kind: 'project', key: 'project', parentKey: null, depth: 0 });
    expect(first?.label).toBe('Ledger Consolidation');
    expect(second).toMatchObject({ kind: 'node', label: 'Ledger migration', depth: 1, parentKey: 'project' });
    expect(third).toMatchObject({ kind: 'node', label: 'Discovery', depth: 2, parentKey: 'wbs-001', isLeaf: false });
    expect(fourth).toMatchObject({ kind: 'node', label: 'Design', depth: 3, isLeaf: true });
    expect(fifth).toMatchObject({ kind: 'person', depth: 4, parentKey: 'wbs-012', itemId: 'wbs-012' });
  });

  it('lists every item of the project once, and no item of another', () => {
    const nodes = view.rows.filter((row) => row.kind === 'node').map((row) => row.key);
    const items = seeded.items.filter((entry) => entry.projectId === 'prj-1').map((entry) => entry.id);
    expect([...nodes].sort()).toEqual([...items].sort());
  });

  it('puts people under Design by employee id, named from People', () => {
    const rows = view.rows.filter((row) => row.kind === 'person' && row.parentKey === 'wbs-012');
    expect(rows.length).toBeGreaterThan(1);
    const keys = rows.map((row) => row.key);
    expect(keys).toEqual([...keys].sort());
    expect(personRow(view, REFERENCE).label).toBe('Adaeze Okafor');
    expect(personRow(view, REFERENCE).employeeId).toBe('emp-001');
  });

  it('lists every row after its parent, so a collapsed node hides the rows that follow it by parentKey', () => {
    const positions = new Map(view.rows.map((row, position) => [row.key, position]));
    const misplaced = view.rows.filter(
      (row) => row.parentKey !== null && (positions.get(row.parentKey) ?? Infinity) >= (positions.get(row.key) ?? 0),
    );
    expect(misplaced).toEqual([]);
  });
});

describe('gridView values on the seed (.docs/phases-4-6.md §3)', () => {
  const view = seedView('personMonths');

  it('gives the project row 0.50, 1.30, 2.65, 4.99, 5.35, 6.40 from March, and a Total of 57.06', () => {
    const project = rowOf(view, 'project');
    expect(project.cells.slice(0, 6).map((cell) => cell.text)).toEqual([
      '0.50',
      '1.30',
      '2.65',
      '4.99',
      '5.35',
      '6.40',
    ]);
    expect(project.total.text).toBe('57.06');
  });

  it('gives Design 1.29 in June', () => {
    expect(rowOf(view, 'wbs-012').cells[3]?.text).toBe('1.29');
  });

  it('carries the exact value next to the displayed one', () => {
    const june = rowOf(view, 'wbs-012').cells[3];
    expect(june?.exact).toBeCloseTo(1.29, 9);
    expect(june?.steps).toBe(129);
  });

  it('reads person rows with their stored amounts, and empty cells as no allocation', () => {
    const first = cellOf(view, REFERENCE, '2026-03');
    expect(first).toMatchObject({ allocationId: 'alloc-001', personMonths: 0.5, text: '0.50', steps: 50 });
    const empty = cellOf(view, REFERENCE, '2026-04');
    expect(empty).toMatchObject({ allocationId: null, personMonths: 0, text: '0.00', markers: [] });
  });
});

describe('gridView in every unit', () => {
  for (const unit of DISPLAY_UNITS) {
    for (const n of [1, 2, 3, 4]) {
      it(`adds up in both directions for prj-${String(n)} in ${unit}`, () => {
        const view = seedView(unit, USD, people, n);
        const childrenOf = (key: string) => view.rows.filter((row) => row.parentKey === key);
        for (const row of view.rows) {
          expect(row.total.steps).toBe(row.cells.reduce((sum, cell) => sum + cell.steps, 0));
          const children = childrenOf(row.key);
          if (children.length === 0) continue;
          row.cells.forEach((cell, position) => {
            expect(cell.steps).toBe(children.reduce((sum, child) => sum + (child.cells[position]?.steps ?? 0), 0));
          });
          expect(row.total.steps).toBe(children.reduce((sum, child) => sum + child.total.steps, 0));
        }
      });
    }
  }

  it('shows the reference cell as 0.50, 88.00, 50.0% and €7,880.00', () => {
    const texts = DISPLAY_UNITS.map((unit) => cellOf(seedView(unit), REFERENCE, '2026-03').text);
    expect(texts).toEqual(['88.00', '0.50', '50.0%', '€7,880.00']);
  });

  it('converts cost to the display currency before rounding', () => {
    expect(cellOf(seedView('cost', USD), REFERENCE, '2026-03').text).toBe('$8,510.40');
    expect(seedView('cost', USD).currency).toBe('USD');
  });

  it('builds the biggest project quickly enough to recompute on every edit', () => {
    const start = performance.now();
    for (const n of [1, 2, 3, 4]) seedView('cost', EUR, people, n);
    expect((performance.now() - start) / 4).toBeLessThan(500);
  });
});

describe('the reference cell’s details (.docs/phases-4-6.md §3, screens 3.2)', () => {
  const details = cellOf(seedView('personMonths'), REFERENCE, '2026-03').details;

  it('gives 0.50 PM = 88.00 h = 50.0% of capacity = €7,880.00', () => {
    expect(details.conversion).toBe('0.50 PM = 88.00 h = 50.0% of capacity = €7,880.00');
    expect(details.values).toEqual({ personMonths: '0.50', hours: '88.00', percent: '50.0%', cost: '€7,880.00' });
    expect(details.title).toBe('Adaeze Okafor · Design · Mar 2026');
  });

  it('gives 176.00 h per person-month and 4.00 h per working day', () => {
    expect(details.personMonth).toEqual({
      weeklyHours: 40,
      workingDays: 22,
      hoursPerPersonMonth: 176,
      hoursPerWorkingDay: 4,
      text: 'Person-month 176.00 h (40 h/week × 22 working days ÷ 5) · 4.00 h per working day',
    });
  });

  it('gives 22 working days: 8 at €80.00/h and 14 at €95.00/h, blended €89.5455/h', () => {
    expect(details.pricing?.slices).toEqual([
      { from: '2026-03-01', workingDays: 8, hourlyCost: 80 },
      { from: '2026-03-12', workingDays: 14, hourlyCost: 95 },
    ]);
    expect(details.pricing?.slicesText).toBe(
      '22 working days: 8 before 12 Mar at €80.00/h, 14 from 12 Mar at €95.00/h',
    );
    expect(details.pricing?.blendedRate).toBeCloseTo(1970 / 22, 9);
    expect(details.pricing?.blendedRateText).toBe('Blended rate €89.5455/h');
  });

  it('reads the same in every unit, and agrees with the cell the grid shows in that unit', () => {
    for (const unit of DISPLAY_UNITS) {
      const cell = cellOf(seedView(unit), REFERENCE, '2026-03');
      expect(cell.details.conversion).toBe(details.conversion);
      expect(cell.details.markers).toEqual([]);
    }
  });

  it('converts rates and cost to the display currency', () => {
    const usd = cellOf(seedView('cost', USD), REFERENCE, '2026-03').details;
    expect(usd.conversion).toBe('0.50 PM = 88.00 h = 50.0% of capacity = $8,510.40');
    expect(usd.pricing?.slicesText).toBe('22 working days: 8 before 12 Mar at $86.40/h, 14 from 12 Mar at $102.60/h');
    expect(usd.pricing?.blendedRateText).toBe('Blended rate $96.7091/h');
  });

  it('has details for an empty cell too, since it is focusable and editable', () => {
    const empty = cellOf(seedView('personMonths'), REFERENCE, '2026-04').details;
    expect(empty.conversion).toBe('0.00 PM = 0.00 h = 0.0% of capacity = €0.00');
    expect(empty.personMonth?.hoursPerWorkingDay).toBe(0);
    expect(empty.pricing?.slicesText).toBe('22 working days at €95.00/h');
  });
});

describe('over capacity (T6.9, D18)', () => {
  const brandtJune = (n: number, key: string) => cellOf(seedView('personMonths', EUR, people, n), key, '2026-06');

  it('marks Milan Brandt in June with the load and the causer in another project', () => {
    const cell = brandtJune(1, 'wbs-012/emp-003');
    expect(cell.text).toBe('0.59');
    expect(cell.markers).toEqual([
      {
        kind: 'overCapacity',
        symbol: '†',
        text: 'Over capacity: Milan Brandt, Jun 2026 — 118.0% of capacity (1.18 PM) across all projects. Caused by: Client Portal Rebuild › Account management › Core build › Implementation, 0.59 PM, the most recently edited contributing allocation.',
      },
    ]);
    expect(cell.details.markers).toBe(cell.markers);
  });

  it('marks every contributing cell in the open project, wherever the causer sits', () => {
    const marked = seedView('personMonths')
      .rows.filter((row): row is PersonRowView => row.kind === 'person')
      .flatMap((row) => row.cells.filter((cell) => cell.markers.some((marker) => marker.kind === 'overCapacity')));
    expect(marked.length).toBeGreaterThan(0);
    expect(marked.every((cell) => cell.personMonths > 0)).toBe(true);
    // Milan Brandt's other June cell is in Client Portal Rebuild, which marks it too.
    const causerRow = seedView('personMonths', EUR, people, 3).rows.find(
      (row) => row.kind === 'person' && row.employeeId === 'emp-003',
    );
    expect(causerRow?.kind === 'person' && causerRow.cells.some((cell) => cell.markers.length > 0)).toBe(true);
  });

  it('does not mark a cell with no effort, or a month within capacity', () => {
    expect(cellOf(seedView('personMonths'), 'wbs-012/emp-003', '2026-07').markers).toEqual([]);
  });

  it('shows the marker in every unit, and without People’s data, with ids for names', () => {
    for (const unit of ['hours', 'cost'] as const) {
      expect(brandtJune(1, 'wbs-012/emp-003').markers).toHaveLength(1);
      expect(cellOf(seedView(unit), 'wbs-012/emp-003', '2026-06').markers[0]?.kind).toBe('overCapacity');
    }
    const without = cellOf(seedView('percent', EUR, null), 'wbs-012/emp-003', '2026-06');
    expect(without.text).toBe('59.0%');
    expect(without.markers[0]?.text).toContain('Over capacity: emp-003, Jun 2026 — 118.0% of capacity (1.18 PM)');
  });

  it('names the causer’s item id when the plan no longer holds that item', () => {
    const state = plan({
      projects: [project('prj-1', '2026-01-01', '2026-03-31')],
      items: [item('wbs-1', 'prj-1', null, 'Only')],
      allocations: [
        allocation('alloc-1', 'wbs-1', 'emp-001', '2026-01', 0.6),
        allocation('alloc-2', 'wbs-404', 'emp-001', '2026-01', 0.6, '2026-02-01T00:00:00.000Z'),
      ],
    });
    const cell = cellOf(viewOf(state, null, prj(1), 'personMonths'), 'wbs-1/emp-001', '2026-01');
    expect(cell.markers[0]?.text).toContain('Caused by: wbs-404, 0.60 PM');
  });
});

describe('unpriced months (D17, screens 3.3)', () => {
  /** Adaeze Okafor with her 2025-01-01 rate removed: March is partly priced (the first rate is 12 Mar). */
  const withoutFirstRate: PeopleData = {
    employees: seedEmployees,
    rates: seedRateRecords.filter((record) => record.id !== 'rate-001'),
  };

  it('costs €5,320.00, marks ◐ and refuses a cost edit with the reason', () => {
    const cell = cellOf(seedView('cost', EUR, withoutFirstRate), REFERENCE, '2026-03');
    expect(cell.text).toBe('€5,320.00');
    const note = "8 of 22 working days are before the first rate (12 Mar 2026) and aren't costed.";
    expect(cell.markers).toEqual([{ kind: 'partiallyPriced', symbol: '◐', text: note }]);
    expect(cell.euroEditRefusal).toBe(
      `Can't edit the cost here: ${note} Switch to Hours, Person-months or % to edit this cell.`,
    );
    expect(cell.details.pricing?.slicesText).toBe(
      '22 working days: 8 before 12 Mar not costed, 14 from 12 Mar at €95.00/h',
    );
    expect(cell.details.pricing?.blendedRateText).toBe('Blended rate €95.0000/h');
  });

  it('keeps hours, person-months and % as they are', () => {
    const cell = cellOf(seedView('personMonths', EUR, withoutFirstRate), REFERENCE, '2026-03');
    expect(cell.text).toBe('0.50');
    expect(cell.details.conversion).toBe('0.50 PM = 88.00 h = 50.0% of capacity = €5,320.00');
  });

  /** Adaeze Okafor's only rate starts in May, so March and April are before the first rate. */
  const startsInMay: PeopleData = {
    employees: seedEmployees,
    rates: [
      ...seedRateRecords.filter((record) => record.employeeId !== 'emp-001'),
      {
        id: RateRecordId.parse('rate-901'),
        employeeId: OKAFOR,
        validFrom: IsoDate.parse('2026-05-01'),
        hourlyCost: 90,
      },
    ],
  };

  it('costs €0.00, marks ○ and refuses a cost edit, also on an empty cell, which has no marker', () => {
    const view = seedView('cost', EUR, startsInMay);
    const cell = cellOf(view, REFERENCE, '2026-03');
    const note = 'The month is before the first rate (1 May 2026), so none of its 22 working days is costed.';
    expect(cell.text).toBe('€0.00');
    expect(cell.markers).toEqual([{ kind: 'unpriced', symbol: '○', text: note }]);
    expect(cell.euroEditRefusal).toContain(note);
    expect(cell.details.pricing?.blendedRate).toBeNull();
    expect(cell.details.pricing?.blendedRateText).toBe('No blended rate: no working day of this month is costed');
    expect(cell.details.pricing?.slicesText).toBe('22 working days not costed');

    const empty = cellOf(view, REFERENCE, '2026-04');
    expect(empty.markers).toEqual([]);
    expect(empty.euroEditRefusal).toContain('none of its 22 working days is costed');
  });

  it('says so when a person has no rate at all', () => {
    const noRates: PeopleData = { employees: seedEmployees, rates: [] };
    const cell = cellOf(seedView('personMonths', EUR, noRates), REFERENCE, '2026-03');
    expect(cell.markers[0]?.text).toBe('No rate is recorded, so none of the 22 working days is costed.');
  });

  it('ignores a rate that starts on a weekend, which splits off a slice with no working days', () => {
    // 1 Mar 2026 is a Sunday, so a rate from Monday 2 Mar leaves a one-day slice with no working day.
    const mondayStart: PeopleData = {
      employees: seedEmployees,
      rates: [
        {
          id: RateRecordId.parse('rate-902'),
          employeeId: OKAFOR,
          validFrom: IsoDate.parse('2026-03-02'),
          hourlyCost: 90,
        },
      ],
    };
    const cell = cellOf(seedView('personMonths', EUR, mondayStart), REFERENCE, '2026-03');
    expect(cell.markers).toEqual([]);
    expect(cell.euroEditRefusal).toBeNull();
    expect(cell.details.pricing?.slicesText).toBe('22 working days at €90.00/h');
  });

  it('allows cost edits in fully priced months', () => {
    expect(cellOf(seedView('cost'), REFERENCE, '2026-03').euroEditRefusal).toBeNull();
  });
});

describe('without People’s data (D32, screens 3.6)', () => {
  it('offers person-months and % only', () => {
    expect(availableUnits(null)).toEqual(['personMonths', 'percent']);
    expect(availableUnits(people)).toEqual(DISPLAY_UNITS);
  });

  it('refuses hours and cost', () => {
    expect(gridView(seeded, null, prj(1), 'hours', EUR)).toEqual({
      ok: false,
      error: { code: 'unitUnavailable', unit: 'hours' },
    });
    expect(gridView(seeded, null, prj(1), 'cost', EUR)).toEqual({
      ok: false,
      error: { code: 'unitUnavailable', unit: 'cost' },
    });
  });

  it('shows person-months and % with employee ids as names', () => {
    const view = seedView('personMonths', EUR, null);
    expect(personRow(view, REFERENCE).label).toBe('emp-001');
    expect(rowOf(view, 'project').total.text).toBe('57.06');
    expect(seedView('percent', EUR, null).rows[0]?.total.text).toBe('5,706.0%');
  });

  it('has details for the conversion only, and no cost refusal', () => {
    const cell = cellOf(seedView('personMonths', EUR, null), REFERENCE, '2026-03');
    expect(cell.details.title).toBe('emp-001 · Design · Mar 2026');
    expect(cell.details.conversion).toBe('0.50 PM = 50.0% of capacity');
    expect(cell.details.values).toEqual({ personMonths: '0.50', hours: null, percent: '50.0%', cost: null });
    expect(cell.details.personMonth).toBeNull();
    expect(cell.details.pricing).toBeNull();
    expect(cell.euroEditRefusal).toBeNull();
    expect(cell.markers).toEqual([]);
  });

  it('shows the same person-months as with People', () => {
    const texts = (view: GridView) => view.rows.map((row) => row.cells.map((cell) => cell.text));
    expect(texts(seedView('personMonths', EUR, null))).toEqual(texts(seedView('personMonths')));
  });
});

describe('gridView errors', () => {
  it('fails for a project that is not in the plan', () => {
    expect(gridView(seeded, people, prj(9), 'personMonths', EUR)).toEqual({
      ok: false,
      error: { code: 'notFound', entity: 'project', id: 'prj-9' },
    });
  });

  it('fails in hours and cost when an allocated employee is missing from People, and not in person-months', () => {
    const missing: PeopleData = { employees: seedEmployees.slice(1), rates: seedRateRecords };
    expect(gridView(seeded, missing, prj(1), 'hours', EUR)).toEqual({
      ok: false,
      error: { code: 'unknownEmployee', employeeId: 'emp-001' },
    });
    const view = seedView('personMonths', EUR, missing);
    expect(personRow(view, REFERENCE).label).toBe('emp-001');
    expect(cellOf(view, REFERENCE, '2026-03').details.pricing).toBeNull();
  });

  it('shows a project with no items as just its project row', () => {
    const bare = plan({ projects: [project('prj-1', '2026-01-01', '2026-02-28')] });
    const view = viewOf(bare, people, prj(1), 'cost');
    expect(view.rows).toHaveLength(1);
    expect(view.rows[0]?.total.text).toBe('€0.00');
    expect(view.months.map((month) => month.label)).toEqual(['Jan 26', 'Feb 26']);
  });

  it('lists an item with no people as a leaf without person rows', () => {
    const lone = plan({ projects: [project('prj-1')], items: [item('wbs-1', 'prj-1', null, 'Lone')] });
    const rows = viewOf(lone, people, prj(1), 'hours').rows;
    expect(rows.map((row) => [row.kind, row.key, row.kind === 'node' && row.isLeaf])).toEqual([
      ['project', 'project', false],
      ['node', 'wbs-1', true],
    ]);
  });
});
