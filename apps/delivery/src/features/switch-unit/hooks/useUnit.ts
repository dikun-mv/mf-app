import { DISPLAY_UNITS, type DisplayUnit } from '@baseline/delivery-domain';
import { useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { z } from 'zod';

/** The unit the grid opens in, and the one any value that isn't a unit falls back to (D31). */
export const DEFAULT_UNIT: DisplayUnit = 'personMonths';

const UnitParam = z.enum(DISPLAY_UNITS).catch(DEFAULT_UNIT);

/**
 * The grid's unit, kept in `?unit=` so a reload or a shared link shows the same numbers (D31). The URL is
 * the only owner: an absent or unknown value reads as person-months. Setting it keeps the other search
 * parameters and replaces the history entry, so Back doesn't step through units. Switching never writes data.
 */
export function useUnit(): readonly [DisplayUnit, (unit: DisplayUnit) => void] {
  const [params, setParams] = useSearchParams();
  const unit = UnitParam.parse(params.get('unit') ?? undefined);
  const setUnit = useCallback(
    (next: DisplayUnit) => {
      setParams(
        (current) => {
          const updated = new URLSearchParams(current);
          updated.set('unit', next);
          return updated;
        },
        { replace: true },
      );
    },
    [setParams],
  );
  return [unit, setUnit];
}
