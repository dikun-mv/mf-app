import { plural } from '../../../shared/lib';

/** How many item names the dialog spells out before it says "and N more". */
const LISTED_NAMES = 6;

/** What goes with an item: its name, those of everything under it, and how many allocations are theirs. */
export interface Deletion {
  /** The item's name first, then those under it, in tree order. */
  readonly names: readonly string[];
  readonly allocations: number;
}

/** `Discovery, Design, Rework`, or the first few and `and 4 more` for a big subtree. */
function listNames(names: readonly string[]): string {
  if (names.length <= LISTED_NAMES) return names.join(', ');
  return `${names.slice(0, LISTED_NAMES).join(', ')} and ${String(names.length - LISTED_NAMES)} more`;
}

/**
 * The dialog's sentence (screens 3.4): everything the delete takes with it, counted, so nothing goes
 * unannounced: `This deletes 3 items (Discovery, Design, Rework) and their 24 allocations.`
 */
export function describeDeletion({ names, allocations }: Deletion): string {
  const [first] = names;
  if (first === undefined) return 'This deletes nothing.';
  const items = names.length === 1 ? `"${first}"` : `${String(names.length)} items (${listNames(names)})`;
  if (allocations === 0)
    return `This deletes ${items}. ${names.length === 1 ? 'It holds' : 'They hold'} no allocations.`;
  const theirs = names.length === 1 ? 'its' : 'their';
  return `This deletes ${items} and ${theirs} ${plural(allocations, 'allocation')}.`;
}

/** What the status line says afterwards: `Deleted 2 items and 14 allocations.` (D33). */
export function describeDeleted(items: number, allocations: number): string {
  return `Deleted ${plural(items, 'item')} and ${plural(allocations, 'allocation')}.`;
}
