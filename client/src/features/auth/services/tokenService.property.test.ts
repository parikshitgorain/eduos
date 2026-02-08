import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import { tokenService } from './tokenService';

/**
 * Property-based tests for tokenService
 * Feature: login-authentication-ui
 */

describe('tokenService - Property Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  /**
   * Feature: login-authentication-ui, Property 20: Remember Me Token Expiration
   * Validates: Requirements 9.2, 9.3
   * 
   * For any successful authentication, the Session_Manager should set token expiration
   * to 30 days when "Remember me" is checked, and 24 hours when unchecked.
   */
  test('Property 20: Remember me sets 30-day expiration', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10 }),
        (token: string) => {
          const beforeTime = Date.now();
          
          // Set token with remember me
          tokenService.setToken(token, true);
          
          const afterTime = Date.now();
          const expiration = tokenService.getTokenExpiration();
          
          expect(expiration).not.toBeNull();
          
          if (expiration) {
            const expirationTime = expiration.getTime();
            const expectedMin = beforeTime + 30 * 24 * 60 * 60 * 1000;
            const expectedMax = afterTime + 30 * 24 * 60 * 60 * 1000;
            
            // Expiration should be approximately 30 days from now
            expect(expirationTime).toBeGreaterThanOrEqual(expectedMin);
            expect(expirationTime).toBeLessThanOrEqual(expectedMax);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 20: Without remember me sets 24-hour expiration', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10 }),
        (token: string) => {
          const beforeTime = Date.now();
          
          // Set token without remember me
          tokenService.setToken(token, false);
          
          const afterTime = Date.now();
          const expiration = tokenService.getTokenExpiration();
          
          expect(expiration).not.toBeNull();
          
          if (expiration) {
            const expirationTime = expiration.getTime();
            const expectedMin = beforeTime + 24 * 60 * 60 * 1000;
            const expectedMax = afterTime + 24 * 60 * 60 * 1000;
            
            // Expiration should be approximately 24 hours from now
            expect(expirationTime).toBeGreaterThanOrEqual(expectedMin);
            expect(expirationTime).toBeLessThanOrEqual(expectedMax);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 20: Remember me flag is stored correctly', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10 }),
        fc.boolean(),
        (token: string, rememberMe: boolean) => {
          tokenService.setToken(token, rememberMe);
          
          const hasRememberMe = tokenService.hasRememberMe();
          expect(hasRememberMe).toBe(rememberMe);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: login-authentication-ui, Property 21: Token Expiration Handling
   * Validates: Requirements 9.4
   * 
   * For any expired token, the Session_Manager should clear the session
   * and redirect to the login page.
   */
  test('Property 21: Expired token returns null', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10 }),
        (token: string) => {
          // Set token with past expiration
          tokenService.setToken(token, false);
          
          // Manually set expiration to past
          const session = tokenService.getSession();
          if (session) {
            session.expiresAt = Date.now() - 1000; // 1 second ago
            localStorage.setItem('auth_session', JSON.stringify(session));
          }
          
          // Try to get token
          const retrievedToken = tokenService.getToken();
          
          // Should return null for expired token
          expect(retrievedToken).toBeNull();
          
          // Token should be cleared
          expect(localStorage.getItem('auth_token')).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 21: Valid token is returned', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10 }),
        (token: string) => {
          // Set token with future expiration
          tokenService.setToken(token, false);
          
          // Get token
          const retrievedToken = tokenService.getToken();
          
          // Should return the token
          expect(retrievedToken).toBe(token);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 21: isTokenValid returns false for expired tokens', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10 }),
        (token: string) => {
          // Set token
          tokenService.setToken(token, false);
          
          // Manually expire it
          const session = tokenService.getSession();
          if (session) {
            session.expiresAt = Date.now() - 1000;
            localStorage.setItem('auth_session', JSON.stringify(session));
          }
          
          // Check validity
          const isValid = tokenService.isTokenValid();
          expect(isValid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: login-authentication-ui, Property 22: Logout Session Cleanup
   * Validates: Requirements 9.5
   * 
   * For any logout action, the Session_Manager should clear all authentication
   * tokens and session data from storage.
   */
  test('Property 22: clearToken removes all session data', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10 }),
        fc.boolean(),
        (token: string, rememberMe: boolean) => {
          // Set token
          tokenService.setToken(token, rememberMe);
          
          // Verify token is stored
          expect(localStorage.getItem('auth_token')).toBe(token);
          expect(localStorage.getItem('auth_session')).not.toBeNull();
          
          // Clear token
          tokenService.clearToken();
          
          // Verify all data is cleared
          expect(localStorage.getItem('auth_token')).toBeNull();
          expect(localStorage.getItem('auth_session')).toBeNull();
          expect(tokenService.getToken()).toBeNull();
          expect(tokenService.getSession()).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 22: clearToken is idempotent', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10 }),
        (token: string) => {
          // Set token
          tokenService.setToken(token, false);
          
          // Clear multiple times
          tokenService.clearToken();
          tokenService.clearToken();
          tokenService.clearToken();
          
          // Should still be cleared
          expect(tokenService.getToken()).toBeNull();
          expect(localStorage.getItem('auth_token')).toBeNull();
          expect(localStorage.getItem('auth_session')).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 22: After logout, hasRememberMe returns false', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10 }),
        fc.boolean(),
        (token: string, rememberMe: boolean) => {
          // Set token
          tokenService.setToken(token, rememberMe);
          
          // Clear token
          tokenService.clearToken();
          
          // hasRememberMe should return false
          expect(tokenService.hasRememberMe()).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
