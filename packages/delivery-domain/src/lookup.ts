// `noUncheckedIndexedAccess` makes every `array[i]` and `map.get(k)` possibly undefined. Where the
// index or key is present by construction, these say so once and fail loudly if that is ever wrong.

export function at<T>(array: readonly T[], index: number): T {
  const value = array[index];
  if (value === undefined) throw new RangeError(`No element at index ${String(index)} of ${String(array.length)}`);
  return value;
}

export function required<K, V>(map: ReadonlyMap<K, V>, key: K): V {
  const value = map.get(key);
  if (value === undefined) throw new RangeError(`No entry for ${String(key)}`);
  return value;
}
