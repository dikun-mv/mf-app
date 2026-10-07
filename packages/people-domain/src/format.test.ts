import { Currency, IsoDate, Month } from '@baseline/host-contract';
import { describe, expect, it } from '@rstest/core';
import { parseAmount } from './amount';
import {
  displayAmountText,
  equalsDisplayed,
  formatDate,
  formatHourlyRate,
  formatMoney,
  formatMonth,
  toDisplayCurrency,
  toEur,
} from './format';

const EUR = Currency.parse({ code: 'EUR', perEur: 1 });
const USD = Currency.parse({ code: 'USD', perEur: 1.08 });
const GBP = Currency.parse({ code: 'GBP', perEur: 0.85 });

describe('formatDate and formatMonth (D34)', () => {
  it('write en-GB dates as 12 Mar 2026', () => {
    expect(formatDate(IsoDate.parse('2026-03-12'))).toBe('12 Mar 2026');
    expect(formatDate(IsoDate.parse('2025-01-01'))).toBe('1 Jan 2025');
    expect(formatDate(IsoDate.parse('2026-12-31'))).toBe('31 Dec 2026');
  });

  it('abbreviate September as Sep, as the screens do', () => {
    expect(formatDate(IsoDate.parse('2026-09-05'))).toBe('5 Sep 2026');
    expect(formatMonth(Month.parse('2026-09'))).toBe('Sep 2026');
    expect(formatMonth(Month.parse('2026-06'))).toBe('Jun 2026');
  });

  it('do not depend on the time zone', () => {
    const original = process.env.TZ;
    try {
      const results = ['UTC', 'Pacific/Auckland', 'America/Los_Angeles'].map((zone) => {
        process.env.TZ = zone;
        return [formatDate(IsoDate.parse('2026-03-01')), formatMonth(Month.parse('2026-03'))];
      });
      expect(new Set(results.map((r) => r.join('|')))).toEqual(new Set(['1 Mar 2026|Mar 2026']));
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
});

describe('money in the display currency (T5.6, D11)', () => {
  it('formats an EUR rate in each display currency with a narrow symbol', () => {
    expect(formatMoney(95, EUR)).toBe('€95.00');
    expect(formatMoney(95, USD)).toBe('$102.60');
    expect(formatMoney(95, GBP)).toBe('£80.75');
    expect(formatHourlyRate(95, EUR)).toBe('€95.00/h');
    expect(formatHourlyRate(80, USD)).toBe('$86.40/h');
  });

  it('groups thousands', () => {
    expect(formatMoney(7880, EUR)).toBe('€7,880.00');
  });

  it('converts to the display currency and back without rounding', () => {
    expect(toDisplayCurrency(95, USD)).toBeCloseTo(102.6, 10);
    expect(toEur(102.6, USD)).toBeCloseTo(95, 10);
    expect(toEur(toDisplayCurrency(97.123456, GBP), GBP)).toBeCloseTo(97.123456, 10);
    expect(toEur(1, USD)).toBe(1 / 1.08);
    expect(toEur(98, EUR)).toBe(98);
  });

  it('writes a stored rate as the text of an amount field', () => {
    expect(displayAmountText(95, EUR)).toBe('95.00');
    expect(displayAmountText(95, USD)).toBe('102.60');
    expect(displayAmountText(1200.5, EUR)).toBe('1200.50');
    // The prefill is what parseAmount reads back.
    expect(parseAmount(displayAmountText(95, USD))).toEqual({ ok: true, value: 102.6 });
  });
});

describe('equalsDisplayed', () => {
  it('is true for the prefilled text, in every currency, so an unchanged correction makes no write', () => {
    for (const currency of [EUR, USD, GBP]) {
      for (const stored of [80, 95, 97.123456, 106]) {
        const text = displayAmountText(stored, currency);
        const parsed = parseAmount(text);
        if (!parsed.ok) throw new Error('prefill must parse');
        expect(equalsDisplayed(parsed.value, stored, currency)).toBe(true);
      }
    }
  });

  it('is true when only digits beyond the displayed cents differ', () => {
    expect(equalsDisplayed(102.600001, 95, USD)).toBe(true);
    expect(equalsDisplayed(95, 95.001, EUR)).toBe(true);
  });

  it('is false for a different amount at the displayed precision', () => {
    expect(equalsDisplayed(102.61, 95, USD)).toBe(false);
    expect(equalsDisplayed(95.01, 95, EUR)).toBe(false);
    expect(equalsDisplayed(95, 95, USD)).toBe(false);
  });
});
