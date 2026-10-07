import { RowActions } from '../RowActions';
import type { RowActionsSlot } from './types';

/** The actions on WBS rows (the `⋯` disclosure): T6.3's list, with T6.7's Assign person among its actions. */
export const rowActionsSlot: RowActionsSlot | null = RowActions;
