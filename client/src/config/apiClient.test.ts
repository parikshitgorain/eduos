import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import type { AxiosError } from 'axios';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

describe('API Client - Session Expiration Handling', () => {
  let mockCreate: any;
  let mockInterceptors: any;
  let responseInterceptor: any;

  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();
    sessionStorage.clear();

    // Setup mock interceptors
    mockInterceptors = {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    };

    mockCreate = vi.fn(() => ({
      interceptors: mockInterceptors,
    }));

    mockedAxios.create = mockCreate;

    // Capture the response interceptor
    mockInterceptors.response.use.mockImplementation((success: any, error: any) => {
      responseInterceptor = { success, error };
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should clear token and dispatch session-expired event on 401 error', async () => {
    // Import after mocking
    const { apiClient } = await import('./apiClient');

    // Set up initial token
    localStorage.setItem('auth_token', 'test-token');
    localStorage.setItem('auth_session', JSON.stringify({
      token: 'test-token',
      expiresAt: Date.now() + 1000000,
      rememberMe: false,
    }));

    // Create mock 401 error
    const mockError: Partial<AxiosError> = {
      response: {
        status: 401,
        data: {
          code: 'UNAUTHORIZED',
          message: 'Token expired',
        },
        statusText: 'Unauthorized',
        headers: {},
        config: {} as any,
      },
      config: {} as any,
      isAxiosError: true,
      toJSON: () => ({}),
      name: 'AxiosError',
      message: 'Request failed with status code 401',
    };

    // Mock event listener
    const eventListener = vi.fn();
    window.addEventListener('session-expired', eventListener);

    // Call the error interceptor
    try {
      await responseInterceptor.error(mockError);
    } catch (error: any) {
      // Verify token was cleared
      expect(localStorage.getItem('auth_token')).toBeNull();
      expect(localStorage.getItem('auth_session')).toBeNull();

      // Verify error code
      expect(error.code).toBe('SESSION_EXPIRED');
      expect(error.message).toBe('Session expired. Please log in again.');

      // Verify event was dispatched
      expect(eventListener).toHaveBeenCalled();
    }

    window.removeEventListener('session-expired', eventListener);
  });

  it('should store redirect URL when session expires on protected route', async () => {
    // Import after mocking
    const { apiClient } = await import('./apiClient');

    // Mock current location
    Object.defineProperty(window, 'location', {
      value: { pathname: '/dashboard' },
      writable: true,
    });

    // Create mock 401 error
    const mockError: Partial<AxiosError> = {
      response: {
        status: 401,
        data: {
          code: 'UNAUTHORIZED',
          message: 'Token expired',
        },
        statusText: 'Unauthorized',
        headers: {},
        config: {} as any,
      },
      config: {} as any,
      isAxiosError: true,
      toJSON: () => ({}),
      name: 'AxiosError',
      message: 'Request failed with status code 401',
    };

    // Call the error interceptor
    try {
      await responseInterceptor.error(mockError);
    } catch (error) {
      // Verify redirect URL was stored
      expect(sessionStorage.getItem('redirect_after_login')).toBe('/dashboard');
    }
  });

  it('should not store redirect URL when session expires on login page', async () => {
    // Import after mocking
    const { apiClient } = await import('./apiClient');

    // Mock current location
    Object.defineProperty(window, 'location', {
      value: { pathname: '/login' },
      writable: true,
    });

    // Create mock 401 error
    const mockError: Partial<AxiosError> = {
      response: {
        status: 401,
        data: {
          code: 'UNAUTHORIZED',
          message: 'Token expired',
        },
        statusText: 'Unauthorized',
        headers: {},
        config: {} as any,
      },
      config: {} as any,
      isAxiosError: true,
      toJSON: () => ({}),
      name: 'AxiosError',
      message: 'Request failed with status code 401',
    };

    // Call the error interceptor
    try {
      await responseInterceptor.error(mockError);
    } catch (error) {
      // Verify redirect URL was NOT stored
      expect(sessionStorage.getItem('redirect_after_login')).toBeNull();
    }
  });
});
