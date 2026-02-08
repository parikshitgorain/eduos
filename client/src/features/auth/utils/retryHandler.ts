/**
 * Retry handler with exponential backoff for network requests
 * 
 * Implements exponential backoff strategy:
 * - 1st retry: 1 second delay
 * - 2nd retry: 2 seconds delay
 * - 3rd retry: 4 seconds delay
 * 
 * Requirements: 6.3
 */

export interface RetryConfig {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  shouldRetry?: (error: any) => boolean;
}

const DEFAULT_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 8000, // 8 seconds
  shouldRetry: () => true,
};

/**
 * Executes a function with retry logic and exponential backoff
 * 
 * @param fn - Async function to execute
 * @param config - Retry configuration
 * @returns Promise that resolves with the function result
 * @throws The last error if all retries fail
 * 
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => apiClient.post('/api/v1/auth/login', credentials),
 *   { maxRetries: 3 }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const { maxRetries, initialDelay, maxDelay, shouldRetry } = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  let lastError: any;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      attempt++;

      // Don't retry if we've exhausted attempts
      if (attempt > maxRetries) {
        break;
      }

      // Don't retry if the error shouldn't be retried
      if (!shouldRetry(error)) {
        break;
      }

      // Calculate delay with exponential backoff: delay = initialDelay * 2^(attempt-1)
      const delay = Math.min(initialDelay * Math.pow(2, attempt - 1), maxDelay);

      // Wait before retrying
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Sleep utility for delays
 * 
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after the delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Determines if an error should be retried
 * Only network errors should be retried, not authentication or validation errors
 * 
 * @param error - Error to check
 * @returns True if the error should be retried
 */
export function shouldRetryError(error: any): boolean {
  // Retry network errors
  const networkErrorCodes = [
    'NETWORK_ERROR',
    'TIMEOUT_ERROR',
    'SERVICE_UNAVAILABLE',
    'SERVER_ERROR',
  ];

  if (error?.code && networkErrorCodes.includes(error.code)) {
    return true;
  }

  // Don't retry authentication or validation errors
  const noRetryErrorCodes = [
    'INVALID_CREDENTIALS',
    'INVALID_EMAIL',
    'INVALID_PASSWORD',
    'ACCOUNT_LOCKED',
    'ACCOUNT_DISABLED',
    'RATE_LIMITED',
    'CAPTCHA_REQUIRED',
    'CAPTCHA_FAILED',
    'INVALID_OTP',
    'OTP_EXPIRED',
  ];

  if (error?.code && noRetryErrorCodes.includes(error.code)) {
    return false;
  }

  // Default to retrying for unknown errors
  return true;
}
