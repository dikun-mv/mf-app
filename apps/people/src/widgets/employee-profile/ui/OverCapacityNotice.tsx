import { formatMonth, type OverCapacityMonth } from '@baseline/people-domain';
import { InlineMessage } from '@baseline/ui';

const percent = ({ percent: value }: OverCapacityMonth): string => `${value.toFixed(1)}% of capacity`;
const personMonths = ({ personMonths: value }: OverCapacityMonth): string => `${value.toFixed(2)} PM`;

/**
 * The months an employee is over capacity (screens 2.6): one month in a sentence, several as a list, each with
 * its share of capacity and its person-months across all projects. Delivery names the causing assignment, not People.
 */
export function OverCapacityNotice({
  months,
  className,
}: {
  months: readonly OverCapacityMonth[];
  className?: string;
}) {
  const [only] = months;
  if (only !== undefined && months.length === 1) {
    return (
      <InlineMessage tone="warning" className={className}>
        Over capacity in {formatMonth(only.month)}: {percent(only)} ({personMonths(only)}) across all projects. The
        causing assignment is named in Delivery.
      </InlineMessage>
    );
  }
  return (
    <InlineMessage tone="warning" className={className}>
      Over capacity in these months, across all projects. The causing assignments are named in Delivery.
      <ul>
        {months.map((month) => (
          <li key={month.month}>
            {formatMonth(month.month)}: {percent(month)} ({personMonths(month)})
          </li>
        ))}
      </ul>
    </InlineMessage>
  );
}
