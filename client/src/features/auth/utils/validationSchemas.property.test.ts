import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { loginSchema, mfaSchema, forgotPasswordSchema } from './validationSchemas';

/**
 * Property-based tests for validation schemas
 * Feature: login-authentication-ui
 */

describe('validationSchemas - Property Tests', () => {
  /**
   * Feature: login-authentication-ui, Property 3: Email Validation
   * Validates: Requirements 2.1, 5.1
   * 
   * For any string input in the email field, the Validation_Engine should validate
   * the email format in real-time and display an inline error message for invalid formats.
   */
  test('Property 3: Email validation works correctly for any input string', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = loginSchema.shape.email.safeParse(input);
        
        // Basic email regex pattern (simplified version of what Zod uses)
        const isValidEmailFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
        
        // The validation result should match the expected format
        expect(result.success).toBe(isValidEmailFormat);
        
        // If invalid, should have an error message
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Please enter a valid email address');
        }
      }),
      { numRuns: 100 }
    );
  });

  test('Property 3: Email validation in forgotPasswordSchema works correctly', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = forgotPasswordSchema.shape.email.safeParse(input);
        
        const isValidEmailFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
        
        expect(result.success).toBe(isValidEmailFormat);
        
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Please enter a valid email address');
        }
      }),
      { numRuns: 100 }
    );
  });

  test('Property 3: Valid email formats are always accepted', () => {
    // Generate valid email addresses
    const validEmailArbitrary = fc.tuple(
      fc.stringMatching(/^[a-zA-Z0-9]+$/), // Local part: alphanumeric only
      fc.stringMatching(/^[a-zA-Z0-9]+$/), // Domain: alphanumeric only
      fc.stringMatching(/^[a-zA-Z]{2,}$/)  // TLD: letters only, at least 2 chars
    )
      .filter(([local, domain, tld]) => local.length > 0 && domain.length > 0)
      .map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

    fc.assert(
      fc.property(validEmailArbitrary, (email) => {
        const result = loginSchema.shape.email.safeParse(email);
        expect(result.success).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  test('Property 3: Invalid email formats are always rejected', () => {
    // Generate strings that are definitely not valid emails
    const invalidEmailArbitrary = fc.oneof(
      fc.string().filter(s => !s.includes('@')), // No @ symbol
      fc.string().filter(s => s.includes('@') && !s.includes('.')), // Has @ but no dot
      fc.constant(''), // Empty string
      fc.constant('   '), // Whitespace only
      fc.constant('@example.com'), // Missing local part
      fc.constant('user@'), // Missing domain
      fc.constant('user@domain'), // Missing TLD
    );

    fc.assert(
      fc.property(invalidEmailArbitrary, (email) => {
        const result = loginSchema.shape.email.safeParse(email);
        expect(result.success).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});
