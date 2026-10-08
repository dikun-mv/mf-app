import type { ProjectId } from '@baseline/delivery-contract';
import { projectProblems } from '@baseline/delivery-domain';
import { InlineMessage } from '@baseline/ui';
import { useMemo } from 'react';
import { useEmployees } from '../../../entities/employee';
import { usePlanState } from '../hooks/usePlanState';

/**
 * What the invariant checker finds wrong in the open project (T1.12b, D4), above the grid. The server doesn't
 * re-check the tree and allocation rules, so only a change made outside the app can break one; this says
 * so instead of leaving it unseen. Unknown employees are checked once People's register has loaded.
 */
export function PlanProblems({ projectId }: { projectId: ProjectId }) {
  const plan = usePlanState();
  const employees = useEmployees().data;
  const problems = useMemo(
    () =>
      projectProblems(
        plan,
        projectId,
        employees === undefined ? undefined : new Set(employees.map((employee) => employee.id)),
      ),
    [plan, projectId, employees],
  );
  if (problems.length === 0) return null;
  return (
    <InlineMessage tone="warning">
      This project&apos;s data breaks rules the app keeps, so it was changed outside the app. Fix it at the source:
      <ul>
        {problems.map((problem) => (
          <li key={problem}>{problem}</li>
        ))}
      </ul>
    </InlineMessage>
  );
}
