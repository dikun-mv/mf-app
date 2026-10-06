import { describe, expect, it } from '@rstest/core';
import { expectTypeOf } from 'expect-type';
import { ActiveUser, BasePath, Currency, CurrencyCode, IsoDate, IsoDateTime, Month, entityId } from './index';

describe('IsoDate', () => {
  it('accepts real calendar days', () => {
    expect(IsoDate.safeParse('2026-03-12').success).toBe(true);
    expect(IsoDate.safeParse('2028-02-29').success).toBe(true);
  });

  it.each(['2026-02-29', '2026-13-01', '2026-00-10', '2026-04-31', '2026-3-12', '2026-03-12T00:00:00Z', ''])(
    'rejects %j',
    (value) => {
      expect(IsoDate.safeParse(value).success).toBe(false);
    },
  );

  it('treats 1900 as a common year and 2000 as a leap year', () => {
    expect(IsoDate.safeParse('1900-02-29').success).toBe(false);
    expect(IsoDate.safeParse('2000-02-29').success).toBe(true);
  });
});

describe('IsoDateTime', () => {
  it('accepts what toISOString writes', () => {
    const now = new Date(Date.UTC(2026, 2, 12, 9, 5, 7, 42)).toISOString();
    expect(IsoDateTime.parse(now)).toBe('2026-03-12T09:05:07.042Z');
  });

  it.each(['2026-03-12', '2026-03-12T09:05:07Z', '2026-03-12T24:00:00.000Z', '2026-02-30T00:00:00.000Z'])(
    'rejects %j',
    (value) => {
      expect(IsoDateTime.safeParse(value).success).toBe(false);
    },
  );

  it('sorts by time when compared as strings', () => {
    const earlier = IsoDateTime.parse('2026-03-12T09:05:07.042Z');
    const later = IsoDateTime.parse('2026-03-12T09:05:07.043Z');
    expect(earlier < later).toBe(true);
  });
});

describe('Month', () => {
  it('accepts YYYY-MM only', () => {
    expect(Month.safeParse('2026-03').success).toBe(true);
    expect(Month.safeParse('2026-13').success).toBe(false);
    expect(Month.safeParse('2026-00').success).toBe(false);
    expect(Month.safeParse('2026-3').success).toBe(false);
    expect(Month.safeParse('2026-03-01').success).toBe(false);
  });
});

describe('CurrencyCode', () => {
  it('accepts three capital letters', () => {
    expect(CurrencyCode.safeParse('EUR').success).toBe(true);
    expect(CurrencyCode.safeParse('eur').success).toBe(false);
    expect(CurrencyCode.safeParse('EURO').success).toBe(false);
  });
});

describe('entityId', () => {
  const WbsId = entityId('wbs', 'WbsId');

  it('accepts seed ids and client-generated uuid ids', () => {
    expect(WbsId.safeParse('wbs-012').success).toBe(true);
    expect(WbsId.safeParse(`wbs-${crypto.randomUUID()}`).success).toBe(true);
  });

  it.each(['wbs-', 'wbs-abc', 'alloc-012', 'wbs-012 ', 'wbs-ABCDEFAB-0000-0000-0000-000000000000'])(
    'rejects %j',
    (value) => {
      expect(WbsId.safeParse(value).success).toBe(false);
    },
  );
});

describe('branding', () => {
  it('keeps the primitives apart at the type level', () => {
    const date = IsoDate.parse('2026-03-12');
    expectTypeOf(date).not.toEqualTypeOf<string>();
    expectTypeOf(date).toExtend<string>();
    expectTypeOf(date).not.toExtend<Month>();
    // @ts-expect-error a plain string is not an IsoDate
    const bad: IsoDate = '2026-03-12';
    expect(bad).toBe('2026-03-12');
  });
});

describe('host primitives', () => {
  it('accepts the demo users and currencies', () => {
    expect(ActiveUser.safeParse({ id: 'user-1', name: 'Demo Planner' }).success).toBe(true);
    expect(Currency.safeParse({ code: 'USD', perEur: 1.08 }).success).toBe(true);
  });

  it.each([
    { code: 'usd', perEur: 1 },
    { code: 'USD', perEur: 0 },
    { code: 'USD', perEur: Infinity },
  ])('rejects the currency %j', (value) => {
    expect(Currency.safeParse(value).success).toBe(false);
  });

  it.each(['', '/people', '/remotes/people'])('accepts the base path %j', (value) => {
    expect(BasePath.safeParse(value).success).toBe(true);
  });

  it.each(['/', '/people/', 'people', '/a b'])('rejects the base path %j', (value) => {
    expect(BasePath.safeParse(value).success).toBe(false);
  });
});
