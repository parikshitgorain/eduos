import axios, { AxiosError } from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

/**
 * API Error interface
 */
export interface APIError {
  code: string;
  message: string;
  field?: string;
  details?: Record<string, any>;
}

/**
 * Create and configure Axios client with interceptors
 */
function createAPIClient(): AxiosInstance {
  const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  const client = axios.create({
    baseURL,
    timeout: 30000, // 30 seconds
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor - Add auth token to requests
  client.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      // Get token from localStorage or cookies
      const token = localStorage.getItem('auth_token');
      
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      return config;
    },
    (error: AxiosError) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor - Handle errors globally
  client.interceptors.response.use(
    (response: AxiosResponse) => {
      return response;
    },
    (error: AxiosError<APIError>) => {
      // Handle network errors
      if (!error.response) {
        return Promise.reject({
          code: 'NETWORK_ERROR',
          message: 'Connection error. Please try again',
        } as APIError);
      }

      // Handle HTTP errors
      const apiError: APIError = {
        code: error.response.data?.code || 'UNKNOWN_ERROR',
        message: error.response.data?.message || 'An unexpected error occurred',
        field: error.response.data?.field,
        details: error.response.data?.details,
      };

      // Handle 401 Unauthorized - Session expired or invalid token
      if (error.response.status === 401) {
        // Clear token from localStorage
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_session');
        
        // Store current URL for redirect after login
        const currentPath = window.location.pathname;
        if (currentPath !== '/login' && currentPath !== '/mfa' && currentPath !== '/forgot-password') {
          sessionStorage.setItem('redirect_after_login', currentPath);
        }
        
        // Dispatch custom event for session expiration
        window.dispatchEvent(new CustomEvent('session-expired', {
          detail: { message: 'Session expired. Please log in again.' }
        }));
        
        // Return a specific error for session expiration
        return Promise.reject({
          code: 'SESSION_EXPIRED',
          message: 'Session expired. Please log in again.',
        } as APIError);
      }

      return Promise.reject(apiError);
    }
  );

  return client;
}

/**
 * Singleton API client instance
 */
export const apiClient = createAPIClient();

/**
 * Helper function to handle API errors
 */
export function isAPIError(error: unknown): error is APIError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error
  );
}
