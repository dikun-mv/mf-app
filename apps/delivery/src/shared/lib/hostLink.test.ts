import { describe, expect, it } from '@rstest/core';
import { hostHref } from './hostLink';

describe('hostHref', () => {
  it('puts the other app next to this one when hosted', () => {
    expect(hostHref('/delivery', '/people/emp-001')).toBe('/people/emp-001');
  });

  it('keeps the standalone prefix', () => {
    expect(hostHref('/remotes/delivery', '/people/emp-001')).toBe('/remotes/people/emp-001');
  });

  it('is the path itself under the dev base path', () => {
    expect(hostHref('', '/people/emp-001')).toBe('/people/emp-001');
  });
});
