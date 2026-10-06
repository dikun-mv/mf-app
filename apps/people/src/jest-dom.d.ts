import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

// Rstest doesn't type the jest-dom matchers (ADR 014). `T = any` must mirror Rstest's own declaration
// for the interface to merge, so this one line needs the suppression.
declare module '@rstest/core' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-object-type
  interface Assertion<T = any> extends TestingLibraryMatchers<unknown, T> {}
}
