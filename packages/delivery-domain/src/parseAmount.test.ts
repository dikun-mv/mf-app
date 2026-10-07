import { describe, expect, it } from '@rstest/core';
import { parseAmount } from './parseAmount';

const value = (text: string): number | string => {
  const parsed = parseAmount(text);
  return parsed.ok ? parsed.value : parsed.error;
};

describe('parseAmount (D34)', () => {
  it('reads plain numbers with . as the decimal point', () => {
    expect(value('7880')).toBe(7880);
    expect(value('0.5')).toBe(0.5);
    expect(value('.5')).toBe(0.5);
    expect(value('5.')).toBe(5);
    expect(value('  12.25  ')).toBe(12.25);
  });

  it('accepts , only between groups of three digits', () => {
    expect(value('7,880')).toBe(7880);
    expect(value('7,880.5')).toBe(7880.5);
    expect(value('1,234,567.89')).toBe(1234567.89);
  });

  it('refuses a comma anywhere else as ambiguous', () => {
    for (const text of ['0,5', '7,88', '1,2345', ',5', '7,880,', '1,23,456', '12,5%']) {
      expect(value(text)).toBe('notANumber');
    }
  });

  it('drops a leading currency symbol and a trailing % or h', () => {
    expect(value('€7,880.00')).toBe(7880);
    expect(value('$ 12.5')).toBe(12.5);
    expect(value('£3')).toBe(3);
    expect(value('50%')).toBe(50);
    expect(value('50 %')).toBe(50);
    expect(value('88h')).toBe(88);
    expect(value('88.5 H')).toBe(88.5);
  });

  it('says empty for blank text, and notANumber for text with no number in it', () => {
    expect(value('')).toBe('empty');
    expect(value('   ')).toBe('empty');
    for (const text of ['abc', '€', '%', 'h', '1e3', '1 000', '5\n6', '5..5', 'Infinity', '--5', '€-€5', '5€']) {
      expect(value(text)).toBe('notANumber');
    }
  });

  it('refuses a negative amount, before or after the symbol, but not minus zero', () => {
    expect(value('-5')).toBe('negative');
    expect(value('-€5')).toBe('negative');
    expect(value('€-5')).toBe('negative');
    expect(value('- 0.5%')).toBe('negative');
    expect(value('-0')).toBe(0);
    expect(value('+5')).toBe(5);
    expect(value('+€5')).toBe(5);
  });

  it('refuses two signs', () => {
    expect(value('-€-5')).toBe('notANumber');
    expect(value('+€-5')).toBe('notANumber');
  });
});
