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

      // Handle 401 Unauthorized - Clear token and redirect to login
      if (error.response.status === 401) {
        localStorage.removeItem('auth_token');
        // Optionally redirect to login page
        // window.location.href = '/login';
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
