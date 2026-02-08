import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import fc from 'fast-check';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { AuthProvider, AuthContext } from './AuthContext';
import { tokenService } from '../services/tokenService';
import type { LoginCredentials, LoginResponse } from '../types/auth.types';
import type { ReactNode } from 'react';

/**
 * Property-based tests for AuthContext
 * Feature: login-authentication-ui
 */

const server = setupServer();

beforeEach(() => {
  server.listen({ onUnhandledRequest: 'error' });
  localStorage.clear();
});

afterEach(() => {
  server.resetHandlers();
  server.close();
  localStorage.clear();
});

// Wrapper component for testing
const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('AuthContext - Property Tests', () => {
  /**
   * Feature: login-authentication-ui, Property 7: Authentication Flow with Token Storage
   * Validates: Requirements 2.4, 2.5, 9.1
   * 
   * For any valid login credentials, when authentication succeeds without MFA,
   * the Session_Manager should store the JWT token and redirect to the dashboard.
   */
  test('Property 7: Successful login stores token in tokenService', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId: fc.string({ minLength: 1 }),
          email: fc.emailAddress(),
          password: fc.string({ minLength: 1 }),
          rememberMe: fc.boolean(),
        }),
        fc.string({ minLength: 20 }), // Mock token
        async (credentials: LoginCredentials, mockToken: string) => {
          // Mock successful login without MFA
          server.use(
            http.post('/api/v1/auth/login', () => {
              return HttpResponse.json({
                success: true,
                requiresMFA: false,
                token: mockToken,
              } as LoginResponse);
            })
          );

          const { result } = renderHook(() => AuthContext, { wrapper });

          // Wait for initial loading to complete
          await waitFor(() => {
            expect(result.current?.isLoading).toBe(false);
          });

          // Perform login
          await act(async () => {
            const response = await result.current!.login(credentials);
            expect(response.requiresMFA).toBe(false);
          });

          // Verify token is stored
          const storedToken = tokenService.getToken();
          expect(storedToken).toBe(mockToken);

          // Verify auth state is updated
          expect(result.current?.token).toBe(mockToken);
          expect(result.current?.isAuthenticated).toBe(true);
        }
      ),
      { numRuns: 20 } // Reduced for React rendering tests
    );
  });

  test('Property 7: Remember me flag affects token expiration', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId: fc.string({ minLength: 1 }),
          email: fc.emailAddress(),
          password: fc.string({ minLength: 1 }),
          rememberMe: fc.boolean(),
        }),
        fc.string({ minLength: 20 }),
        async (credentials: LoginCredentials, mockToken: string) => {
          server.use(
            http.post('/api/v1/auth/login', () => {
              return HttpResponse.json({
                success: true,
                requiresMFA: false,
                token: mockToken,
              } as LoginResponse);
            })
          );

          const { result } = renderHook(() => AuthContext, { wrapper });

          await waitFor(() => {
            expect(result.current?.isLoading).toBe(false);
          });

          await act(async () => {
            await result.current!.login(credentials);
          });

          // Verify remember me flag is stored correctly
          const hasRememberMe = tokenService.hasRememberMe();
          expect(hasRememberMe).toBe(credentials.rememberMe);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Property 7: Login with MFA does not store token immediately', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId: fc.string({ minLength: 1 }),
          email: fc.emailAddress(),
          password: fc.string({ minLength: 1 }),
          rememberMe: fc.boolean(),
        }),
        fc.string({ minLength: 10 }), // Session ID
        async (credentials: LoginCredentials, sessionId: string) => {
          // Mock login requiring MFA
          server.use(
            http.post('/api/v1/auth/login', () => {
              return HttpResponse.json({
                success: true,
                requiresMFA: true,
                sessionId,
              } as LoginResponse);
            })
          );

          const { result } = renderHook(() => AuthContext, { wrapper });

          await waitFor(() => {
            expect(result.current?.isLoading).toBe(false);
          });

          await act(async () => {
            const response = await result.current!.login(credentials);
            expect(response.requiresMFA).toBe(true);
            expect(response.sessionId).toBe(sessionId);
          });

          // Verify token is NOT stored yet
          const storedToken = tokenService.getToken();
          expect(storedToken).toBeNull();

          // Verify auth state is NOT authenticated
          expect(result.current?.isAuthenticated).toBe(false);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Property 7: Logout clears token from storage', () => {
    fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 20 }),
        fc.boolean(),
        async (mockToken: string, rememberMe: boolean) => {
          // Set up initial authenticated state
          tokenService.setToken(mockToken, rememberMe);

          server.use(
            http.post('/api/v1/auth/logout', () => {
              return HttpResponse.json({ success: true });
            })
          );

          const { result } = renderHook(() => AuthContext, { wrapper });

          await waitFor(() => {
            expect(result.current?.isLoading).toBe(false);
          });

          // Perform logout
          await act(async () => {
            await result.current!.logout();
          });

          // Verify token is cleared
          const storedToken = tokenService.getToken();
          expect(storedToken).toBeNull();

          // Verify auth state is cleared
          expect(result.current?.token).toBeNull();
          expect(result.current?.isAuthenticated).toBe(false);
          expect(result.current?.user).toBeNull();
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Property 7: Failed login does not store token', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId: fc.string({ minLength: 1 }),
          email: fc.emailAddress(),
          password: fc.string({ minLength: 1 }),
          rememberMe: fc.boolean(),
        }),
        async (credentials: LoginCredentials) => {
          // Mock failed login
          server.use(
            http.post('/api/v1/auth/login', () => {
              return HttpResponse.json(
                {
                  success: false,
                  message: 'Invalid credentials',
                },
                { status: 401 }
              );
            })
          );

          const { result } = renderHook(() => AuthContext, { wrapper });

          await waitFor(() => {
            expect(result.current?.isLoading).toBe(false);
          });

          // Attempt login (should fail)
          await act(async () => {
            try {
              await result.current!.login(credentials);
            } catch (error) {
              // Expected to throw
            }
          });

          // Verify token is NOT stored
          const storedToken = tokenService.getToken();
          expect(storedToken).toBeNull();

          // Verify auth state is NOT authenticated
          expect(result.current?.isAuthenticated).toBe(false);
        }
      ),
      { numRuns: 20 }
    );
  });
});
