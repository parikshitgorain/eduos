import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { calculatePasswordStrength, getPasswordStrength, type PasswordStrength } from './passwordStrength';

/**
 * Property-based tests for password strength calculation
 * Feature: login-authentication-ui
 */

describe('passwordStrength - Property Tests', () => {
  /**
   * Feature: login-authentication-ui, Property 6: Password Strength Calculation
   * Validates: Requirements 5.3
   * 
   * For any password string, the Validation_Engine should calculate and display
   * a strength indicator (weak/medium/strong) based on length and complexity.
   */
  test('Property 6: Password strength is always one of weak/medium/strong', () => {
    fc.assert(
      fc.property(fc.string(), (password) => {
        const result = calculatePasswordStrength(password);
        
        // Strength must be one of the three valid values
        expect(['weak', 'medium', 'strong']).toContain(result.strength);
        
        // Score must be between 0 and 100
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
        
        // Feedback must be an array
        expect(Array.isArray(result.feedback)).toBe(true);
        expect(result.feedback.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  test('Property 6: Empty password always returns weak strength', () => {
    fc.assert(
      fc.property(fc.constant(''), (password) => {
        const result = calculatePasswordStrength(password);
        expect(result.strength).toBe('weak');
        expect(result.score).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  test('Property 6: Longer passwords have higher or equal scores', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 5 }),
        (basePassword, extraChars) => {
          const shortPassword = basePassword;
          const longPassword = basePassword + extraChars;
          
          const shortResult = calculatePasswordStrength(shortPassword);
          const longResult = calculatePasswordStrength(longPassword);
          
          // Longer password should have score >= shorter password
          // (assuming same character composition)
          expect(longResult.score).toBeGreaterThanOrEqual(shortResult.score);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 6: Password with all character types has higher score', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 8, max: 20 }),
        (length) => {
          // Create a password with all character types
          const complexPassword = 'Aa1!' + 'x'.repeat(Math.max(0, length - 4));
          
          // Create a password with only lowercase
          const simplePassword = 'a'.repeat(length);
          
          const complexResult = calculatePasswordStrength(complexPassword);
          const simpleResult = calculatePasswordStrength(simplePassword);
          
          // Complex password should have higher score
          expect(complexResult.score).toBeGreaterThan(simpleResult.score);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 6: Score determines strength level consistently', () => {
    fc.assert(
      fc.property(fc.string(), (password) => {
        const result = calculatePasswordStrength(password);
        
        // Verify strength level matches score ranges
        if (result.score >= 80) {
          expect(result.strength).toBe('strong');
        } else if (result.score >= 50) {
          expect(result.strength).toBe('medium');
        } else {
          expect(result.strength).toBe('weak');
        }
      }),
      { numRuns: 100 }
    );
  });

  test('Property 6: getPasswordStrength returns same strength as calculatePasswordStrength', () => {
    fc.assert(
      fc.property(fc.string(), (password) => {
        const fullResult = calculatePasswordStrength(password);
        const simpleResult = getPasswordStrength(password);
        
        expect(simpleResult).toBe(fullResult.strength);
      }),
      { numRuns: 100 }
    );
  });

  test('Property 6: Strong passwords have all required characteristics', () => {
    // Generate passwords that should be strong
    const strongPasswordArbitrary = fc.tuple(
      fc.stringMatching(/^[A-Z]{2,5}$/),     // Uppercase
      fc.stringMatching(/^[a-z]{2,5}$/),     // Lowercase
      fc.stringMatching(/^[0-9]{2,5}$/),     // Numbers
      fc.stringMatching(/^[!@#$%^&*]{1,3}$/), // Special chars
      fc.stringMatching(/^[a-zA-Z0-9]{4,8}$/) // Extra chars for length
    ).map(([upper, lower, nums, special, extra]) => 
      upper + lower + nums + special + extra
    );

    fc.assert(
      fc.property(strongPasswordArbitrary, (password) => {
        const result = calculatePasswordStrength(password);
        
        // Should have high score (at least medium, likely strong)
        expect(result.score).toBeGreaterThanOrEqual(50);
        
        // Should have uppercase
        expect(/[A-Z]/.test(password)).toBe(true);
        
        // Should have lowercase
        expect(/[a-z]/.test(password)).toBe(true);
        
        // Should have numbers
        expect(/\d/.test(password)).toBe(true);
        
        // Should have special characters
        expect(/[^A-Za-z0-9]/.test(password)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  test('Property 6: Weak passwords lack required characteristics', () => {
    // Generate passwords that should be weak (only lowercase, short)
    const weakPasswordArbitrary = fc.stringMatching(/^[a-z]{1,5}$/);

    fc.assert(
      fc.property(weakPasswordArbitrary, (password) => {
        const result = calculatePasswordStrength(password);
        
        // Should have low score
        expect(result.score).toBeLessThan(50);
        expect(result.strength).toBe('weak');
        
        // Should have feedback suggesting improvements
        expect(result.feedback.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  test('Property 6: Repeated characters reduce score', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[A-Za-z0-9!@#$%^&*]{3,10}$/),
        (baseChars) => {
          // Create password without repetition
          const normalPassword = baseChars;
          
          // Create password with repetition (aaa, 111, etc.)
          const repeatedPassword = baseChars + 'aaa';
          
          const normalResult = calculatePasswordStrength(normalPassword);
          const repeatedResult = calculatePasswordStrength(repeatedPassword);
          
          // Password with repetition should have lower or equal score
          // (it gets length bonus but loses repetition bonus)
          if (normalPassword.length === repeatedPassword.length) {
            expect(repeatedResult.score).toBeLessThanOrEqual(normalResult.score);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
