/** Makes a `switch` over a union fail to compile when a member is missing. */
export function assertNever(value: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(value)}`);
}
