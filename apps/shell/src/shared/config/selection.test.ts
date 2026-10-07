import { describe, expect, it } from '@rstest/core';
import { memoryStorage, testConfig } from '../testing';
import { ShellConfig } from './schema';
import { initialSelection, SELECTION_KEY, storeSelection } from './selection';

describe('initialSelection', () => {
  it('uses the configured default currency and the first user when nothing is stored', () => {
    const selection = initialSelection(testConfig, memoryStorage());
    expect(selection.currency.code).toBe('EUR');
    expect(selection.activeUser.name).toBe('Demo Planner');
  });

  it('uses the configured default, whichever currency it is', () => {
    const config = ShellConfig.parse({ ...testConfig, defaultCurrency: 'USD' });
    expect(initialSelection(config, memoryStorage()).currency.code).toBe('USD');
  });

  it('restores the stored choices from the config, so the rate and name are never read from storage', () => {
    const storage = memoryStorage({
      [SELECTION_KEY]: JSON.stringify({ currency: 'USD', userId: 'user-2', perEur: 9 }),
    });
    const selection = initialSelection(testConfig, storage);
    expect(selection.currency).toEqual({ code: 'USD', perEur: 1.08 });
    expect(selection.activeUser.name).toBe('Demo Lead');
  });

  it('falls back per choice when the stored one is no longer listed', () => {
    const storage = memoryStorage({ [SELECTION_KEY]: JSON.stringify({ currency: 'JPY', userId: 'user-2' }) });
    const selection = initialSelection(testConfig, storage);
    expect(selection.currency.code).toBe('EUR');
    expect(selection.activeUser.id).toBe('user-2');
  });

  it.each([
    ['text that is not JSON', 'not json'],
    ['JSON of another shape', '[1, 2]'],
    ['a currency that is not a string', JSON.stringify({ currency: 3 })],
  ])('starts from the defaults for %s', (_label, raw) => {
    const selection = initialSelection(testConfig, memoryStorage({ [SELECTION_KEY]: raw }));
    expect(selection.currency.code).toBe('EUR');
    expect(selection.activeUser.name).toBe('Demo Planner');
  });

  it('starts from the defaults when reading storage throws', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => undefined,
    };
    expect(initialSelection(testConfig, blocked).currency.code).toBe('EUR');
  });
});

describe('storeSelection', () => {
  it('writes the code and id only', () => {
    const storage = memoryStorage();
    storeSelection(initialSelection(testConfig, storage), storage);
    expect(storage.values.get(SELECTION_KEY)).toBe(JSON.stringify({ currency: 'EUR', userId: 'user-1' }));
  });

  it('does not throw when the storage refuses the write', () => {
    const full = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(() => {
      storeSelection(initialSelection(testConfig, full), full);
    }).not.toThrow();
  });
});
