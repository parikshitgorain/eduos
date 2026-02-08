import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';
import fc from 'fast-check';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { authService } from './authService';
import type { LoginCredentials, LoginResponse, MFAVerificationRequest, MFAVerificationResponse } from '../types/auth.types';

/**
 * Property-based tests for authService API integration
 * Feature: login-authentication-ui
 */

// Setup MSW server for API mocking
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('authService - Property Tests', () => {
  /**
   * Feature: login-authentication-ui, Property 35: Login API Integration
   * Validates: Requirements 15.2
   * 
   * For any login form submission with valid data, the Login_Form should call
   * POST /api/v1/auth/login with the correct payload structure.
   */
  test('Property 35: Login API sends correct payload structure', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId: fc.string({ minLength: 1 }),
          email: fc.emailAddress(),
          password: fc.string({ minLength: 1 }),
          rememberMe: fc.boolean(),
          captchaToken: fc.option(fc.string(), { nil: undefined }),
        }),
        async (credentials: LoginCredentials) => {
          let receivedPayload: any = null;

          // Mock the API endpoint
          server.use(
            http.post('/api/v1/auth/login', async ({ request }) => {
              receivedPayload = await request.json();
              return HttpResponse.json({
                success: true,
                requiresMFA: false,
                token: 'mock-token',
              } as LoginResponse);
            })
          );

          // Call the service
          await authService.login(credentials);

          // Verify payload structure
          expect(receivedPayload).toBeDefined();
          expect(receivedPayload.tenantId).toBe(credentials.tenantId);
          expect(receivedPayload.email).toBe(credentials.email);
          expect(receivedPayload.password).toBe(credentials.password);
          expect(receivedPayload.rememberMe).toBe(credentials.rememberMe);
          
          if (credentials.captchaToken) {
            expect(receivedPayload.captchaToken).toBe(credentials.captchaToken);
          }
        }
      ),
      { numRuns: 50 } // Reduced runs for async tests
    );
  });

  test('Property 35: Login API returns expected response structure', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId: fc.string({ minLength: 1 }),
          email: fc.emailAddress(),
          password: fc.string({ minLength: 1 }),
          rememberMe: fc.boolean(),
        }),
        fc.boolean(), // requiresMFA
        async (credentials: LoginCredentials, requiresMFA: boolean) => {
          // Mock the API endpoint
          server.use(
            http.post('/api/v1/auth/login', () => {
              return HttpResponse.json({
                success: true,
                requiresMFA,
                sessionId: requiresMFA ? 'mock-session-id' : undefined,
                token: !requiresMFA ? 'mock-token' : undefined,
              } as LoginResponse);
            })
          );

          // Call the service
          const response = await authService.login(credentials);

          // Verify response structure
          expect(response.success).toBe(true);
          expect(response.requiresMFA).toBe(requiresMFA);
          
          if (requiresMFA) {
            expect(response.sessionId).toBeDefined();
          } else {
            expect(response.token).toBeDefined();
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Feature: login-authentication-ui, Property 36: MFA API Integration
   * Validates: Requirements 15.3
   * 
   * For any OTP submission, the MFA_Screen should call POST /api/v1/auth/mfa/verify
   * with the session ID and OTP code.
   */
  test('Property 36: MFA API sends correct payload structure', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          sessionId: fc.string({ minLength: 1 }),
          otp: fc.stringMatching(/^\d{6}$/),
        }),
        async (request: MFAVerificationRequest) => {
          let receivedPayload: any = null;

          // Mock the API endpoint
          server.use(
            http.post('/api/v1/auth/mfa/verify', async ({ request: req }) => {
              receivedPayload = await req.json();
              return HttpResponse.json({
                success: true,
                token: 'mock-token',
              } as MFAVerificationResponse);
            })
          );

          // Call the service
          await authService.verifyMFA(request);

          // Verify payload structure
          expect(receivedPayload).toBeDefined();
          expect(receivedPayload.sessionId).toBe(request.sessionId);
          expect(receivedPayload.otp).toBe(request.otp);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 36: MFA API returns token on success', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          sessionId: fc.string({ minLength: 1 }),
          otp: fc.stringMatching(/^\d{6}$/),
        }),
        async (request: MFAVerificationRequest) => {
          const mockToken = 'mock-jwt-token-' + Math.random();

          // Mock the API endpoint
          server.use(
            http.post('/api/v1/auth/mfa/verify', () => {
              return HttpResponse.json({
                success: true,
                token: mockToken,
              } as MFAVerificationResponse);
            })
          );

          // Call the service
          const response = await authService.verifyMFA(request);

          // Verify response
          expect(response.success).toBe(true);
          expect(response.token).toBe(mockToken);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 36: MFA API handles invalid OTP', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          sessionId: fc.string({ minLength: 1 }),
          otp: fc.stringMatching(/^\d{6}$/),
        }),
        async (request: MFAVerificationRequest) => {
          // Mock the API endpoint to return error
          server.use(
            http.post('/api/v1/auth/mfa/verify', () => {
              return HttpResponse.json(
                {
                  success: false,
                  message: 'Invalid OTP',
                },
                { status: 400 }
              );
            })
          );

          // Call the service and expect it to throw
          await expect(authService.verifyMFA(request)).rejects.toThrow();
        }
      ),
      { numRuns: 50 }
    );
  });
});
