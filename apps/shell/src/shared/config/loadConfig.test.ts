import { afterEach, describe, expect, it, rs } from '@rstest/core';
import { applyBreak, loadConfig, resolveRemotes, resolveRemoteUrl } from './loadConfig';
import { ShellConfig } from './schema';

const validConfig = {
  remotes: { people: '/remotes/people/remoteEntry.js', delivery: 'http://localhost:3020/remoteEntry.js' },
  currencies: [
    { code: 'EUR', perEur: 1 },
    { code: 'USD', perEur: 1.08 },
  ],
  defaultCurrency: 'EUR',
  users: [{ id: 'user-1', name: 'Demo Planner' }],
};

const origin = 'http://localhost:8080';

describe('ShellConfig', () => {
  it('accepts the shape ADR 029 defines', () => {
    expect(ShellConfig.safeParse(validConfig).success).toBe(true);
  });

  it.each([
    ['a missing remote', { ...validConfig, remotes: { people: '/x' } }],
    ['an empty remote url', { ...validConfig, remotes: { people: '', delivery: '/y' } }],
    ['no currencies', { ...validConfig, currencies: [] }],
    ['a default currency that is not listed', { ...validConfig, defaultCurrency: 'GBP' }],
    ['a non-positive rate', { ...validConfig, currencies: [{ code: 'EUR', perEur: 0 }] }],
    ['no users', { ...validConfig, users: [] }],
    ['a user id that is not a user id', { ...validConfig, users: [{ id: 'u1', name: 'X' }] }],
  ])('rejects %s', (_label, value) => {
    expect(ShellConfig.safeParse(value).success).toBe(false);
  });
});

describe('remote URLs', () => {
  it('resolves a relative URL against the origin and leaves an absolute one alone', () => {
    expect(resolveRemoteUrl('/remotes/people/remoteEntry.js', origin)).toBe(
      'http://localhost:8080/remotes/people/remoteEntry.js',
    );
    expect(resolveRemoteUrl('http://localhost:3020/remoteEntry.js', origin)).toBe(
      'http://localhost:3020/remoteEntry.js',
    );
  });

  it('resolves both remotes', () => {
    expect(resolveRemotes(ShellConfig.parse(validConfig).remotes, origin)).toEqual({
      people: 'http://localhost:8080/remotes/people/remoteEntry.js',
      delivery: 'http://localhost:3020/remoteEntry.js',
    });
  });
});

describe('applyBreak (?break=)', () => {
  const remotes = { people: 'http://a.test/people.js', delivery: 'http://a.test/delivery.js' };

  it('leaves the URLs alone without the parameter', () => {
    expect(applyBreak(remotes, '', origin)).toEqual(remotes);
    expect(applyBreak(remotes, '?theme=contrast', origin)).toEqual(remotes);
  });

  it('breaks only the named remote', () => {
    const result = applyBreak(remotes, '?break=people', origin);
    expect(result.people).toBe('http://localhost:8080/__broken__/people/remoteEntry.js');
    expect(result.delivery).toBe(remotes.delivery);
  });

  it('breaks several, and ignores unknown names', () => {
    const result = applyBreak(remotes, '?break=people,delivery,nope', origin);
    expect(result.people).toContain('__broken__');
    expect(result.delivery).toContain('__broken__');
  });
});

describe('loadConfig', () => {
  afterEach(() => {
    rs.unstubAllGlobals();
  });

  const stubFetch = (response: Partial<Response>): void => {
    rs.stubGlobal(
      'fetch',
      rs.fn(() => Promise.resolve(response)),
    );
  };

  it('fetches, validates, resolves and breaks', async () => {
    stubFetch({ ok: true, json: () => Promise.resolve(validConfig) });
    const loaded = await loadConfig({ origin, search: '?break=delivery' });
    expect(loaded.remotes.people).toBe('http://localhost:8080/remotes/people/remoteEntry.js');
    expect(loaded.remotes.delivery).toContain('__broken__');
    expect(loaded.config.defaultCurrency).toBe('EUR');
  });

  it('fails readably on an HTTP error', async () => {
    stubFetch({ ok: false, status: 404 });
    await expect(loadConfig({ origin, search: '' })).rejects.toThrow('/config.json returned 404');
  });

  it('fails readably on an invalid file', async () => {
    stubFetch({ ok: true, json: () => Promise.resolve({ remotes: {} }) });
    await expect(loadConfig({ origin, search: '' })).rejects.toThrow('/config.json is invalid');
  });
});
