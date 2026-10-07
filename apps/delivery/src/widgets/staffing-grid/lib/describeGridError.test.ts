import type { GridViewError } from '@baseline/delivery-domain';
import type { EmployeeId } from '@baseline/people-contract';
import { describe, expect, it } from '@rstest/core';
import { describeGridError } from './describeGridError';

const message = (error: GridViewError) => describeGridError(error);

describe('describeGridError', () => {
  it('says what to do when hours or cost are asked for without People’s data', () => {
    expect(message({ code: 'unitUnavailable', unit: 'hours' })).toBe(
      "People's data can't be reached. Hours and cost need weekly hours and rates: switch to person-months or % of capacity.",
    );
  });

  it('names the employee People does not list', () => {
    expect(message({ code: 'unknownEmployee', employeeId: 'emp-9' as EmployeeId })).toContain('no employee emp-9');
  });

  it('never shows a code, whatever the error', () => {
    const errors: GridViewError[] = [
      { code: 'notFound', entity: 'project', id: 'prj-9' },
      { code: 'notFound', entity: 'allocation', id: 'alloc-9' },
      { code: 'emptyName' },
      { code: 'tooDeep', maxDepth: 4 },
    ];
    for (const error of errors) expect(message(error)).not.toContain(error.code);
  });
});
