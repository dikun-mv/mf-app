import { describe, expect, it } from '@rstest/core';
import { parseAmount } from './amount';

const okValue = (text: string): number | string => {
  const result = parseAmount(text);
  return result.ok ? result.value : result.error;
};

describe('parseAmount (D34)', () => {
  it('reads plain numbers with a . decimal point', () => {
    expect(okValue('95')).toBe(95);
    expect(okValue('95.5')).toBe(95.5);
    expect(okValue('0.25')).toBe(0.25);
    expect(okValue('.5')).toBe(0.5);
    expect(okValue('0')).toBe(0);
  });

  it('trims, and drops a leading currency symbol and a trailing % or h', () => {
    expect(okValue('  98.00  ')).toBe(98);
    expect(okValue('€7880')).toBe(7880);
    expect(okValue('$ 12.5')).toBe(12.5);
    expect(okValue('£3')).toBe(3);
    expect(okValue('50%')).toBe(50);
    expect(okValue('88.5 h')).toBe(88.5);
    expect(okValue('€95h')).toBe(95);
  });

  it('accepts , only between groups of three digits', () => {
    expect(okValue('7,880.5')).toBe(7880.5);
    expect(okValue('1,234,567')).toBe(1234567);
    expect(okValue('€7,880.00')).toBe(7880);
  });

  it('refuses a , that could be a decimal comma', () => {
    for (const text of ['0,5', '1,23', '7,88', '7,8800', ',500', '1,,000', '7,880,5', '1.234,5']) {
      expect(okValue(text)).toBe('notANumber');
    }
  });

  it('refuses empty text', () => {
    expect(okValue('')).toBe('empty');
    expect(okValue('   ')).toBe('empty');
  });

  it('refuses text that is not a number', () => {
    for (const text of ['abc', '€', '-', '%', 'h', '.', '1e3', '12 34', '1.2.3', '5.', '€€5', '5%%', '5 euro', 'NaN']) {
      expect(okValue(text)).toBe('notANumber');
    }
  });

  it('refuses a number too large to be finite', () => {
    expect(okValue('9'.repeat(400))).toBe('notANumber');
  });

  it('refuses a negative amount, but not minus zero', () => {
    expect(okValue('-5')).toBe('negative');
    expect(okValue('-€5.5')).toBe('negative');
    expect(okValue('- 5')).toBe('negative');
    expect(okValue('-0')).toBe(0);
  });
});
