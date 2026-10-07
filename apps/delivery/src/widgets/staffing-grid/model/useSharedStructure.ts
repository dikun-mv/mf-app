import { replaceEqualDeep } from '@tanstack/react-query';
import { useRef } from 'react';

/**
 * `value`, with every part that is deeply equal to the same part of the last value this hook returned
 * replaced by that part's old reference. `gridView` builds a whole new view on every run (D35), but after
 * a rate event or an edit only a few rows differ; handing the unchanged rows back as the very same
 * objects is what lets a `React.memo` row skip its render. The rows are compared by value once per new
 * view, which at this size (D19) costs far less than rendering a row.
 *
 * The ref is written during render, which is safe here: the result depends only on `value` and the last
 * result, and a render that React throws away at worst leaves a reference to a value it did compute.
 */
export function useSharedStructure<T>(value: T): T {
  const last = useRef<T>(value);
  const shared = replaceEqualDeep(last.current, value);
  last.current = shared;
  return shared;
}
