import type { Allocation, AllocationId, BreakdownItemId } from '@baseline/delivery-contract';
import type { Currency, CurrencyCode, Month } from '@baseline/host-contract';
import type { EmployeeId } from '@baseline/people-contract';
import { allocationKey } from './allocations';
import { loadKey, loadsOf } from './capacity';
import {
  type EmployeeData,
  type MonthPricing,
  cellDetails,
  euroEditRefusal,
  monthPricing,
  overCapacityMarker,
  pricingMarker,
} from './cellDetails';
import type { PlanState } from './changeSet';
import { formatMonth, formatUnit } from './format';
import type { GridTotals } from './grid';
import type { CellMarker, GridValue, PersonCellView } from './gridViewTypes';
import { itemPath } from './itemPath';
import { at, required } from './lookup';
import { rowKey } from './projectGrid';
import type { TreeIndex } from './tree';
import type { DisplayUnit } from './units';

/** One number of the grid, from its exact value and the whole steps `roundGrid` chose for it. */
export const gridValue = (exact: number, steps: number, unit: DisplayUnit, currency: CurrencyCode): GridValue => ({
  exact,
  steps,
  text: formatUnit(steps, unit, currency),
});

export interface PersonCellInputs {
  /** The whole plan, because a person's load counts every project (D8). */
  readonly plan: PlanState;
  /** The open project's allocations. */
  readonly allocations: readonly Allocation[];
  readonly index: TreeIndex;
  readonly months: readonly Month[];
  readonly unit: DisplayUnit;
  readonly currency: Currency;
  /** Empty without People's data. */
  readonly employees: ReadonlyMap<EmployeeId, EmployeeData>;
  readonly exact: GridTotals;
  readonly rounded: GridTotals;
}

/**
 * Builds the person cells of one grid: the value, the markers (T6.9), the reason a cost edit is
 * refused (D17) and the details (T6.12). Everything shared between cells is looked up once here.
 */
export function createPersonCells(
  inputs: PersonCellInputs,
): (itemId: BreakdownItemId, employeeId: EmployeeId, position: number) => PersonCellView {
  const { plan, allocations, index, months, unit, currency, employees, exact, rounded } = inputs;

  const allocationAt = new Map(allocations.map((allocation) => [allocationKey(allocation), allocation]));
  const loads = new Map(loadsOf(plan.allocations).map((load) => [loadKey(load.employeeId, load.month), load]));
  // Keyed by `AllocationId | null` because a load's causer is typed nullable; a null one is a bug and `required` throws.
  const allocationsById = new Map<AllocationId | null, Allocation>(plan.allocations.map((a) => [a.id, a]));

  const pricingOf = new Map<string, MonthPricing>();
  const pricingFor = (employeeId: EmployeeId, month: Month, data: EmployeeData): MonthPricing => {
    const key = loadKey(employeeId, month);
    let pricing = pricingOf.get(key);
    if (pricing === undefined) {
      pricing = monthPricing(month, data.rates);
      pricingOf.set(key, pricing);
    }
    return pricing;
  };

  return (itemId, employeeId, position) => {
    const month = at(months, position);
    const key = rowKey(itemId, employeeId);
    const allocation = allocationAt.get(allocationKey({ breakdownItemId: itemId, employeeId, month })) ?? null;
    const data = employees.get(employeeId) ?? null;
    const name = data === null ? employeeId : data.name;
    const amount = allocation === null ? 0 : allocation.amount;
    const value = gridValue(
      at(required(exact.rows, key).months, position),
      at(required(rounded.rows, key).months, position),
      unit,
      currency.code,
    );

    // Markers sit on cells that hold effort; the pricing state applies to empty cells as well,
    // because a cost can be typed into them.
    const pricing = data === null ? null : pricingFor(employeeId, month, data);
    const markers: CellMarker[] = [];
    if (amount > 0) {
      const load = required(loads, loadKey(employeeId, month));
      if (load.overCapacity) {
        const causer = required(allocationsById, load.causingAllocationId);
        markers.push(
          overCapacityMarker({
            employeeName: name,
            month,
            allocatedPersonMonths: load.allocatedPersonMonths,
            // The causer may sit in another project, or under an item the plan no longer holds.
            causer: {
              path: itemPath(plan, causer.breakdownItemId, index) ?? causer.breakdownItemId,
              amount: causer.amount,
            },
          }),
        );
      }
      const pricingMark = pricing === null ? null : pricingMarker(pricing);
      if (pricingMark !== null) markers.push(pricingMark);
    }

    return {
      ...value,
      month,
      allocationId: allocation === null ? null : allocation.id,
      personMonths: amount,
      markers,
      euroEditRefusal: pricing === null ? null : euroEditRefusal(pricing),
      details: cellDetails({
        title: `${name} · ${required(index.byId, itemId).name} · ${formatMonth(month)}`,
        month,
        personMonths: amount,
        unit,
        steps: value.steps,
        employee: data,
        currency,
        markers,
      }),
    };
  };
}
