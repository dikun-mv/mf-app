import { describe, expect, it } from '@rstest/core';
import { at, required } from './lookup';

describe('at', () => {
  it('returns the element', () => {
    expect(at([10, 20], 1)).toBe(20);
  });

  it('fails loudly out of range', () => {
    expect(() => at([10, 20], 2)).toThrow(RangeError);
    expect(() => at([], 0)).toThrow(RangeError);
  });
});

describe('required', () => {
  it('returns the entry', () => {
    expect(required(new Map([['a', 1]]), 'a')).toBe(1);
  });

  it('fails loudly when missing', () => {
    expect(() => required(new Map([['a', 1]]), 'b')).toThrow(RangeError);
  });
});
