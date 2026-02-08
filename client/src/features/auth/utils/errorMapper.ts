import type { APIError } from '../../../config/apiClient';

/**
 * Error code to user-friendly message mapping
 * Maps backend error codes to messages that users can understand and act upon
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */
export const ERROR_MESSAGES: Record<string, string> = {
  // Authentication errors (Requirement 6.1)
  INVALID_CREDENTIALS: 'Invalid email or password',
  INVALID_EMAIL: 'Invalid email or password',
  INVALID_PASSWORD: 'Invalid email or password',
  
  // Account status errors (Requirement 6.2)
  ACCOUNT_LOCKED: 'Account locked. Contact your administrator',
  ACCOUNT_DISABLED: 'Account disabled. Contact your administrator',
  ACCOUNT_SUSPENDED: 'Account suspended. Contact your administrator',
  
  // Network and server errors (Requirement 6.3)
  NETWORK_ERROR: 'Connection error. Please try again',
  SERVER_ERROR: 'Server error. Please try again later',
  TIMEOUT_ERROR: 'Request timed out. Please try again',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable. Please try again later',
  
  // Rate limiting errors (Requirement 6.4)
  RATE_LIMITED: 'Too many attempts. Please wait {minutes} minutes',
  TOO_MANY_REQUESTS: 'Too many requests. Please wait {seconds} seconds',
  
  // MFA errors
  INVALID_OTP: 'Invalid verification code',
  OTP_EXPIRED: 'Verification code expired. Request a new one',
  MFA_REQUIRED: 'Multi-factor authentication is required',
  
  // Tenant errors
  TENANT_NOT_FOUND: 'Institution not found',
  TENANT_DISABLED: 'Institution access is disabled',
  
  // CAPTCHA errors
  CAPTCHA_REQUIRED: 'Please complete the CAPTCHA',
  CAPTCHA_FAILED: 'CAPTCHA verification failed',
  CAPTCHA_EXPIRED: 'CAPTCHA expired. Please try again',
  
  // Session errors
  SESSION_EXPIRED: 'Session expired. Please log in again',
  INVALID_SESSION: 'Invalid session. Please log in again',
  
  // SSO errors
  SSO_FAILED: 'Single sign-on failed. Please try again',
  SSO_PROVIDER_ERROR: 'Authentication provider error. Please try again',
  SSO_CANCELLED: 'Sign-in was cancelled',
  
  // Password reset errors
  PASSWORD_RESET_FAILED: 'Failed to send reset email. Please try again',
  INVALID_RESET_TOKEN: 'Invalid or expired reset link',
  
  // Generic fallback
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again',
};

/**
 * Maps a backend error code to a user-friendly message
 * Handles placeholder replacement for dynamic values (e.g., {minutes}, {seconds})
 * 
 * @param error - API error object with code, message, and optional details
 * @returns User-friendly error message
 * 
 * @example
 * ```typescript
 * const error = { code: 'RATE_LIMITED', details: { minutes: 5 } };
 * const message = mapErrorToMessage(error);
 * // Returns: "Too many attempts. Please wait 5 minutes"
 * ```
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */
export function mapErrorToMessage(error: APIError | string): string {
  // Handle string error codes
  if (typeof error === 'string') {
    return ERROR_MESSAGES[error] || ERROR_MESSAGES.UNKNOWN_ERROR;
  }

  // Get the base message from the error code
  // If error code is not in our mapping, use UNKNOWN_ERROR message
  const baseMessage = ERROR_MESSAGES[error.code] || ERROR_MESSAGES.UNKNOWN_ERROR;

  // If there are no details, return the base message
  if (!error.details || Object.keys(error.details).length === 0) {
    return baseMessage;
  }

  // Replace placeholders with actual values from details
  // Supports patterns like {minutes}, {seconds}, {count}, etc.
  return baseMessage.replace(/\{(\w+)\}/g, (match, key) => {
    const value = error.details?.[key];
    return value !== undefined ? String(value) : match;
  });
}

/**
 * Gets a user-friendly error message from various error types
 * Handles APIError objects, Error objects, and unknown error types
 * 
 * @param error - Error of any type
 * @returns User-friendly error message
 * 
 * @example
 * ```typescript
 * try {
 *   await authService.login(credentials);
 * } catch (err) {
 *   const message = getErrorMessage(err);
 *   setError(message);
 * }
 * ```
 */
export function getErrorMessage(error: unknown): string {
  // Handle APIError objects
  if (isAPIError(error)) {
    return mapErrorToMessage(error);
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    return error.message || ERROR_MESSAGES.UNKNOWN_ERROR;
  }

  // Handle string errors
  if (typeof error === 'string') {
    return error;
  }

  // Fallback for unknown error types
  return ERROR_MESSAGES.UNKNOWN_ERROR;
}

/**
 * Type guard to check if an error is an APIError
 * 
 * @param error - Error to check
 * @returns True if error is an APIError
 */
function isAPIError(error: unknown): error is APIError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error
  );
}

/**
 * Checks if an error code indicates an authentication failure
 * Used to determine if password field should be cleared
 * 
 * @param errorCode - Error code to check
 * @returns True if error is an authentication failure
 * 
 * Requirements: 6.5
 */
export function isAuthenticationError(errorCode: string): boolean {
  const authErrors = [
    'INVALID_CREDENTIALS',
    'INVALID_EMAIL',
    'INVALID_PASSWORD',
    'ACCOUNT_LOCKED',
    'ACCOUNT_DISABLED',
    'ACCOUNT_SUSPENDED',
    'RATE_LIMITED',
    'TOO_MANY_REQUESTS',
    'CAPTCHA_REQUIRED',
    'CAPTCHA_FAILED',
  ];
  
  return authErrors.includes(errorCode);
}

/**
 * Checks if an error code indicates a rate limiting error
 * Used to determine if rate limit UI should be shown
 * 
 * @param errorCode - Error code to check
 * @returns True if error is a rate limiting error
 * 
 * Requirements: 6.4
 */
export function isRateLimitError(errorCode: string): boolean {
  return errorCode === 'RATE_LIMITED' || errorCode === 'TOO_MANY_REQUESTS';
}

/**
 * Checks if an error code indicates a network error
 * Used to determine if retry UI should be shown
 * 
 * @param errorCode - Error code to check
 * @returns True if error is a network error
 * 
 * Requirements: 6.3
 */
export function isNetworkError(errorCode: string): boolean {
  const networkErrors = [
    'NETWORK_ERROR',
    'TIMEOUT_ERROR',
    'SERVICE_UNAVAILABLE',
    'SERVER_ERROR',
  ];
  
  return networkErrors.includes(errorCode);
}
