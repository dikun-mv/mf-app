import { describe, expect, it } from '@rstest/core';
import { basePathFromBaseUri, otherAppUrl } from './standalone';

describe('basePathFromBaseUri', () => {
  it.each([
    ['http://localhost:3010/', ''],
    ['http://localhost:8080/remotes/people/', '/remotes/people'],
    ['https://example.test/some/where/people/', '/some/where/people'],
  ])('%s gives %j', (baseUri, expected) => {
    expect(basePathFromBaseUri(baseUri)).toBe(expected);
  });
});

describe('otherAppUrl', () => {
  it("opens the other app's standalone page behind the gateway", () => {
    expect(otherAppUrl('/delivery/prj-1', 'http://localhost:8080')).toBe(
      'http://localhost:8080/remotes/delivery/prj-1',
    );
  });
});
