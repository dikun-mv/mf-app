/** A record's fields by name, as a parsed record is. */
export type Fields = Readonly<Record<string, unknown>>;

/** Whether two records hold the same fields with the same values (shallow). */
export function sameFields(a: Fields, b: Fields): boolean {
  const left = Object.entries(a);
  return left.length === Object.keys(b).length && left.every(([key, value]) => b[key] === value);
}
