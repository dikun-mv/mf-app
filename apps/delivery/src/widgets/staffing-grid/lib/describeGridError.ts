import type { GridViewError } from '@baseline/delivery-domain';

/**
 * Why the grid can't be shown, as a sentence for the user. The reasons that come up are People's data
 * being out of reach for hours and cost (screens 3.6; the full message and the switcher's disabled units
 * are T6.13's) and an employee People doesn't list; anything else is a bug and gets a plain fallback, never
 * a code.
 */
export function describeGridError(error: GridViewError): string {
  switch (error.code) {
    case 'unitUnavailable':
      return "People's data can't be reached. Hours and cost need weekly hours and rates: switch to person-months or % of capacity.";
    case 'unknownEmployee':
      return `Hours and cost can't be shown: People has no employee ${error.employeeId}. Switch to person-months or % of capacity.`;
    case 'notFound':
      return error.entity === 'project'
        ? `Project not found: there is no project "${error.id}".`
        : "The grid can't be shown: some of its data is missing.";
    default:
      return "The grid can't be shown.";
  }
}
