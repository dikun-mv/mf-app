import { CellMarkers } from '../../../../entities/allocation';
import type { CellAdornmentSlot } from './types';

/**
 * What sits next to a person cell's value: T6.9's markers (`†`, `◐`, `○`) with their visible text. The grid
 * renders it and hands the result to the cell renderer as `adornment`, so markers and the editor (T6.6)
 * are wired in separate files.
 */
export const cellAdornmentSlot: CellAdornmentSlot | null = CellMarkers;
