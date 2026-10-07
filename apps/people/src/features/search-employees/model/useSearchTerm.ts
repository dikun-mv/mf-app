import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router';
import { z } from 'zod';

/** The register's search lives in `?q=` (D31). A value that isn't text falls back to no search. */
const SearchTerm = z.string().catch('');

/**
 * The search term and how to change it. It is read from `?q=` once, so a reload or a shared link keeps it,
 * and written back as the user types, replacing the history entry so Back leaves the register instead of
 * stepping through every keystroke. The text field is driven by local state, because a field bound to
 * the router's asynchronous state loses characters when typing is fast.
 */
export function useSearchTerm(): readonly [term: string, setTerm: (term: string) => void] {
  const [params, setParams] = useSearchParams();
  const [term, setLocalTerm] = useState(() => SearchTerm.parse(params.get('q') ?? ''));
  const setTerm = useCallback(
    (next: string) => {
      setLocalTerm(next);
      setParams(
        (current) => {
          const updated = new URLSearchParams(current);
          if (next === '') updated.delete('q');
          else updated.set('q', next);
          return updated;
        },
        { replace: true },
      );
    },
    [setParams],
  );
  return [term, setTerm];
}
