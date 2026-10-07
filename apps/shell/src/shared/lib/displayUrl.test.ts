import { describe, expect, it } from '@rstest/core';
import { displayUrl } from './displayUrl';

const origin = 'http://localhost:8080';

describe('displayUrl', () => {
  it('shows a same-origin URL as its path', () => {
    expect(displayUrl('http://localhost:8080/remotes/people/remoteEntry.js', origin)).toBe(
      '/remotes/people/remoteEntry.js',
    );
  });

  it('shows another origin in full, so a dev server is recognisable', () => {
    expect(displayUrl('http://localhost:3010/remoteEntry.js', origin)).toBe('http://localhost:3010/remoteEntry.js');
  });

  it('resolves a relative URL against the origin', () => {
    expect(displayUrl('/remotes/delivery/remoteEntry.js', origin)).toBe('/remotes/delivery/remoteEntry.js');
  });

  it('gives back text that is not a URL as it is', () => {
    expect(displayUrl('http://', origin)).toBe('http://');
  });
});
