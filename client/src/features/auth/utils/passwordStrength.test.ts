import { describe, it, expect } from 'vitest';
import { calculatePasswordStrength } from './passwordStrength';

describe('calculatePasswordStrength', () => {
  it('returns weak for short passwords', () => {
    const result = calculatePasswordStrength('abc');
    expect(result.strength).toBe('weak');
    expect(result.score).toBeLessThan(40);
  });

  it('returns weak for passwords without variety', () => {
    const result = calculatePasswordStrength('abcdefgh');
    expect(result.strength).toBe('weak');
  });

  it('returns medium for passwords with some variety', () => {
    const result = calculatePasswordStrength('Abcdefgh1');
    expect(result.strength).toBe('medium');
    expect(result.score).toBeGreaterThanOrEqual(40);
    expect(result.score).toBeLessThan(70);
  });

  it('returns strong for complex passwords', () => {
    const result = calculatePasswordStrength('Abcd1234!@#$');
    expect(result.strength).toBe('strong');
    expect(result.score).toBeGreaterThanOrEqual(70);
  });

  it('penalizes passwords with sequential characters', () => {
    const weak = calculatePasswordStrength('Abc123!@#$');
    const strong = calculatePasswordStrength('Axz987!@#$');
    expect(weak.score).toBeLessThanOrEqual(strong.score);
  });

  it('returns score of 0 for empty password', () => {
    const result = calculatePasswordStrength('');
    expect(result.score).toBe(0);
    expect(result.strength).toBe('weak');
  });
});
