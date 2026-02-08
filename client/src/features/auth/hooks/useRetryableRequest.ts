import { useState, useCallback } from 'react';
import { useToast } from '../../../shared/context/ToastContext';
import { withRetry, shouldRetryError } from '../utils/retryHandler';
import { isNetworkError } from '../utils/errorMapper';
import type { APIError } from '../../../config/apiClient';

/**
 * Hook for making retryable API requests with toast notifications
 * 
 * Provides automatic retry with exponential backoff for network errors
 * Shows toast notifications for errors with a "Retry" button
 * 
 * Requirements: 6.3
 */

interface UseRetryableRequestOptions {
  maxRetries?: number;
  showToastOnError?: boolean;
  onError?: (error: APIError) => void;
}

interface UseRetryableRequestResult<T> {
  execute: (fn: () => Promise<T>) => Promise<T>;
  isLoading: boolean;
  error: APIError | null;
  retry: () => Promise<void>;
}

/**
 * Hook for making retryable API requests
 * 
 * @param options - Configuration options
 * @returns Object with execute function, loading state, error, and retry function
 * 
 * @example
 * ```typescript
 * const { execute, isLoading, error, retry } = useRetryableRequest();
 * 
 * const handleLogin = async () => {
 *   try {
 *     const result = await execute(() => 
 *       authService.login(credentials)
 *     );
 *     // Handle success
 *   } catch (err) {
 *     // Error is already handled by the hook
 *   }
 * };
 * ```
 */
export function useRetryableRequest<T = any>(
  options: UseRetryableRequestOptions = {}
): UseRetryableRequestResult<T> {
  const {
    maxRetries = 3,
    showToastOnError = true,
    onError,
  } = options;

  const { showError } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<APIError | null>(null);
  const [lastRequest, setLastRequest] = useState<(() => Promise<T>) | null>(null);

  const execute = useCallback(
    async (fn: () => Promise<T>): Promise<T> => {
      setIsLoading(true);
      setError(null);
      setLastRequest(() => fn);

      try {
        const result = await withRetry(fn, {
          maxRetries,
          shouldRetry: shouldRetryError,
        });

        setIsLoading(false);
        return result;
      } catch (err) {
        const apiError = err as APIError;
        setError(apiError);
        setIsLoading(false);

        // Call custom error handler if provided
        if (onError) {
          onError(apiError);
        }

        // Show toast notification for network errors
        if (showToastOnError && isNetworkError(apiError.code)) {
          showError(apiError.message, {
            label: 'Retry',
            onClick: async () => {
              if (lastRequest) {
                await execute(lastRequest);
              }
            },
          });
        }

        throw apiError;
      }
    },
    [maxRetries, showToastOnError, onError, showError, lastRequest]
  );

  const retry = useCallback(async () => {
    if (lastRequest) {
      await execute(lastRequest);
    }
  }, [lastRequest, execute]);

  return {
    execute,
    isLoading,
    error,
    retry,
  };
}
