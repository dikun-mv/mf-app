type Fields = Record<string, unknown>;

/** Whether two records hold the same fields with the same values (shallow). */
export function sameFields(a: object, b: object): boolean {
  const left = Object.entries(a as Fields);
  const right = b as Fields;
  return left.length === Object.keys(right).length && left.every(([key, value]) => right[key] === value);
}
