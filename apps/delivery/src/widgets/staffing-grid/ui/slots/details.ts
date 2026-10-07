import { CellDetailsPanel } from '../../../../entities/allocation';
import type { DetailsSlot } from './types';

/**
 * The cell details panel under the grid (T6.12). It lives with the allocation entity, not in a widget of
 * its own: this widget may not import a sibling widget (`fsd-no-cross-slice`, D28).
 */
export const detailsSlot: DetailsSlot | null = CellDetailsPanel;
