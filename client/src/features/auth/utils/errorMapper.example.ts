/**
 * Example usage of the errorMapper utility
 * 
 * This file demonstrates how to use the error mapping functions
 * in various authentication scenarios.
 */

import { authService } from '../services/authService';
import { 
  getErrorMessage, 
  mapErrorToMessage, 
  isAuthenticationError,
  isRateLimitError,
  isNetworkError 
} from './errorMapper';
import type { APIError } from '../../../config/apiClient';

/**
 * Example 1: Basic login error handling
 */
async function handleLogin(email: string, password: string, tenantId: string) {
  try {
    const response = await authService.login({
      email,
      password,
      tenantId,
      rememberMe: false,
    });
    
    console.log('Login successful:', response);
  } catch (error) {
    // Convert any error to a user-friendly message
    const errorMessage = getErrorMessage(error);
    console.error('Login failed:', errorMessage);
    
    // Check if we should clear the password field
    if (error && typeof error === 'object' && 'code' in error) {
      const apiError = error as APIError;
      if (isAuthenticationError(apiError.code)) {
        console.log('Clearing password field for security');
        // Clear password field in your form
      }
    }
  }
}

/**
 * Example 2: Handling rate limit errors with dynamic values
 */
async function handleLoginWithRateLimit(email: string, password: string, tenantId: string) {
  try {
    const response = await authService.login({
      email,
      password,
      tenantId,
      rememberMe: false,
    });
    
    console.log('Login successful:', response);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      const apiError = error as APIError;
      
      // Check if it's a rate limit error
      if (isRateLimitError(apiError.code)) {
        // Get the message with the wait time filled in
        const message = mapErrorToMessage(apiError);
        console.error('Rate limited:', message);
        // Example output: "Too many attempts. Please wait 5 minutes"
        
        // You could also access the raw details
        const waitMinutes = apiError.details?.minutes;
        console.log(`Please wait ${waitMinutes} minutes before trying again`);
      } else {
        const message = getErrorMessage(error);
        console.error('Login failed:', message);
      }
    }
  }
}

/**
 * Example 3: Handling network errors with retry logic
 */
async function handleLoginWithRetry(
  email: string, 
  password: string, 
  tenantId: string,
  maxRetries: number = 3
) {
  let attempts = 0;
  
  while (attempts < maxRetries) {
    try {
      const response = await authService.login({
        email,
        password,
        tenantId,
        rememberMe: false,
      });
      
      console.log('Login successful:', response);
      return response;
    } catch (error) {
      attempts++;
      
      if (error && typeof error === 'object' && 'code' in error) {
        const apiError = error as APIError;
        
        // Only retry on network errors
        if (isNetworkError(apiError.code) && attempts < maxRetries) {
          const message = mapErrorToMessage(apiError);
          console.log(`${message}. Retrying... (Attempt ${attempts}/${maxRetries})`);
          
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
          continue;
        }
      }
      
      // If not a network error or max retries reached, throw the error
      const errorMessage = getErrorMessage(error);
      console.error('Login failed:', errorMessage);
      throw error;
    }
  }
}

/**
 * Example 4: Displaying errors in a React component
 */
function LoginFormExample() {
  // In a real component, you would use useState
  let errorMessage: string | null = null;
  
  const handleSubmit = async (email: string, password: string, tenantId: string) => {
    try {
      const response = await authService.login({
        email,
        password,
        tenantId,
        rememberMe: false,
      });
      
      // Handle success
      console.log('Login successful:', response);
    } catch (error) {
      // Convert error to user-friendly message
      errorMessage = getErrorMessage(error);
      
      // Check error type for additional handling
      if (error && typeof error === 'object' && 'code' in error) {
        const apiError = error as APIError;
        
        if (isAuthenticationError(apiError.code)) {
          // Clear password field
          console.log('Clearing password field');
        }
        
        if (isRateLimitError(apiError.code)) {
          // Disable form for the specified time
          console.log('Disabling form temporarily');
        }
        
        if (isNetworkError(apiError.code)) {
          // Show retry button
          console.log('Showing retry button');
        }
      }
    }
  };
  
  return {
    handleSubmit,
    errorMessage,
  };
}

/**
 * Example 5: Handling MFA verification errors
 */
async function handleMFAVerification(sessionId: string, otp: string) {
  try {
    const response = await authService.verifyMFA({
      sessionId,
      otp,
    });
    
    console.log('MFA verification successful:', response);
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error('MFA verification failed:', errorMessage);
    
    // Check for specific MFA errors
    if (error && typeof error === 'object' && 'code' in error) {
      const apiError = error as APIError;
      
      if (apiError.code === 'INVALID_OTP') {
        console.log('Show error: Invalid verification code');
      } else if (apiError.code === 'OTP_EXPIRED') {
        console.log('Show error: Code expired, offer to resend');
      }
    }
  }
}

/**
 * Example 6: Handling multiple error types in a single handler
 */
async function comprehensiveErrorHandling(email: string, password: string, tenantId: string) {
  try {
    const response = await authService.login({
      email,
      password,
      tenantId,
      rememberMe: false,
    });
    
    console.log('Login successful:', response);
  } catch (error) {
    // Get user-friendly message
    const errorMessage = getErrorMessage(error);
    
    // Display the message to the user
    console.error('Error:', errorMessage);
    
    // Perform additional actions based on error type
    if (error && typeof error === 'object' && 'code' in error) {
      const apiError = error as APIError;
      
      // Authentication errors - clear password
      if (isAuthenticationError(apiError.code)) {
        console.log('Action: Clear password field');
      }
      
      // Rate limit errors - show countdown
      if (isRateLimitError(apiError.code)) {
        const waitTime = apiError.details?.minutes || apiError.details?.seconds;
        console.log(`Action: Show countdown timer for ${waitTime} time units`);
      }
      
      // Network errors - show retry button
      if (isNetworkError(apiError.code)) {
        console.log('Action: Show retry button');
      }
      
      // Account locked - show contact admin
      if (apiError.code === 'ACCOUNT_LOCKED') {
        console.log('Action: Show "Contact Administrator" link prominently');
      }
      
      // CAPTCHA required - show CAPTCHA widget
      if (apiError.code === 'CAPTCHA_REQUIRED' || apiError.code === 'CAPTCHA_FAILED') {
        console.log('Action: Display CAPTCHA widget');
      }
    }
  }
}

// Export examples for documentation purposes
export {
  handleLogin,
  handleLoginWithRateLimit,
  handleLoginWithRetry,
  LoginFormExample,
  handleMFAVerification,
  comprehensiveErrorHandling,
};
