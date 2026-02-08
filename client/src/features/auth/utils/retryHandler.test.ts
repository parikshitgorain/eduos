import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry, shouldRetryError } from './retryHandler';

describe('retryHandler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('withRetry', () => {
    it('should return result on first success', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const promise = withRetry(fn);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce({ code: 'NETWORK_ERROR' })
        .mockResolvedValue('success');

      const promise = withRetry(fn, { maxRetries: 3 });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should implement exponential backoff', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce({ code: 'NETWORK_ERROR' })
        .mockRejectedValueOnce({ code: 'NETWORK_ERROR' })
        .mockResolvedValue('success');

      const promise = withRetry(fn, { maxRetries: 3, initialDelay: 1000 });

      // First call fails immediately
      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledTimes(1);

      // First retry after 1 second
      await vi.advanceTimersByTimeAsync(1000);
      expect(fn).toHaveBeenCalledTimes(2);

      // Second retry after 2 seconds
      await vi.advanceTimersByTimeAsync(2000);
      expect(fn).toHaveBeenCalledTimes(3);

      const result = await promise;
      expect(result).toBe('success');
    });

    it('should throw error after max retries', async () => {
      const error = { code: 'NETWORK_ERROR', message: 'Network error' };
      const fn = vi.fn().mockRejectedValue(error);

      const promise = withRetry(fn, { maxRetries: 2 });
      
      // Run timers and catch the error
      vi.runAllTimersAsync();
      await expect(promise).rejects.toEqual(error);

      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should not retry if shouldRetry returns false', async () => {
      const error = { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' };
      const fn = vi.fn().mockRejectedValue(error);

      const promise = withRetry(fn, {
        maxRetries: 3,
        shouldRetry: () => false,
      });

      // Run timers and catch the error
      vi.runAllTimersAsync();
      await expect(promise).rejects.toEqual(error);

      expect(fn).toHaveBeenCalledTimes(1); // No retries
    });

    it('should respect maxDelay', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce({ code: 'NETWORK_ERROR' })
        .mockRejectedValueOnce({ code: 'NETWORK_ERROR' })
        .mockRejectedValueOnce({ code: 'NETWORK_ERROR' })
        .mockResolvedValue('success');

      const promise = withRetry(fn, {
        maxRetries: 4,
        initialDelay: 1000,
        maxDelay: 3000,
      });

      // First retry: 1 second
      await vi.advanceTimersByTimeAsync(1000);
      expect(fn).toHaveBeenCalledTimes(2);

      // Second retry: 2 seconds
      await vi.advanceTimersByTimeAsync(2000);
      expect(fn).toHaveBeenCalledTimes(3);

      // Third retry: should be 4 seconds but capped at 3 seconds (maxDelay)
      await vi.advanceTimersByTimeAsync(3000);
      expect(fn).toHaveBeenCalledTimes(4);

      const result = await promise;
      expect(result).toBe('success');
    });
  });

  describe('shouldRetryError', () => {
    it('should return true for network errors', () => {
      expect(shouldRetryError({ code: 'NETWORK_ERROR' })).toBe(true);
      expect(shouldRetryError({ code: 'TIMEOUT_ERROR' })).toBe(true);
      expect(shouldRetryError({ code: 'SERVICE_UNAVAILABLE' })).toBe(true);
      expect(shouldRetryError({ code: 'SERVER_ERROR' })).toBe(true);
    });

    it('should return false for authentication errors', () => {
      expect(shouldRetryError({ code: 'INVALID_CREDENTIALS' })).toBe(false);
      expect(shouldRetryError({ code: 'INVALID_EMAIL' })).toBe(false);
      expect(shouldRetryError({ code: 'INVALID_PASSWORD' })).toBe(false);
      expect(shouldRetryError({ code: 'ACCOUNT_LOCKED' })).toBe(false);
      expect(shouldRetryError({ code: 'ACCOUNT_DISABLED' })).toBe(false);
    });

    it('should return false for rate limit errors', () => {
      expect(shouldRetryError({ code: 'RATE_LIMITED' })).toBe(false);
    });

    it('should return false for CAPTCHA errors', () => {
      expect(shouldRetryError({ code: 'CAPTCHA_REQUIRED' })).toBe(false);
      expect(shouldRetryError({ code: 'CAPTCHA_FAILED' })).toBe(false);
    });

    it('should return false for MFA errors', () => {
      expect(shouldRetryError({ code: 'INVALID_OTP' })).toBe(false);
      expect(shouldRetryError({ code: 'OTP_EXPIRED' })).toBe(false);
    });

    it('should return true for unknown errors', () => {
      expect(shouldRetryError({ code: 'UNKNOWN_ERROR' })).toBe(true);
      expect(shouldRetryError({ code: 'SOME_OTHER_ERROR' })).toBe(true);
    });

    it('should return true for errors without code', () => {
      expect(shouldRetryError({})).toBe(true);
      expect(shouldRetryError(null)).toBe(true);
      expect(shouldRetryError(undefined)).toBe(true);
    });
  });
});
