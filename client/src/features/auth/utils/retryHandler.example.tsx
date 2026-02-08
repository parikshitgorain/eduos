/**
 * Example: Using Retry Handler with Network Error Handling
 * 
 * This file demonstrates how to use the retry handler and toast notifications
 * for network error handling in authentication flows.
 * 
 * Requirements: 6.3
 */

import React from 'react';
import { LoginForm } from '../components/LoginForm';
import { authService } from '../services/authService';
import { useRetryableRequest } from '../hooks/useRetryableRequest';
import { getErrorMessage } from './errorMapper';
import type { LoginFormData } from './validationSchemas';

/**
 * Example 1: Using useRetryableRequest hook in a page component
 * 
 * This is the recommended approach for handling network errors with automatic retry
 */
export function LoginPageWithRetry() {
  const { execute, isLoading, error } = useRetryableRequest({
    maxRetries: 3,
    showToastOnError: true, // Automatically show toast for network errors
  });

  const handleLogin = async (data: LoginFormData) => {
    // The execute function automatically:
    // 1. Retries network errors with exponential backoff
    // 2. Shows toast notifications with "Retry" button
    // 3. Manages loading state
    return await execute(() => authService.login(data));
  };

  const handleMFARequired = (sessionId: string) => {
    // Navigate to MFA page
    console.log('MFA required:', sessionId);
  };

  const handleSuccess = () => {
    // Navigate to dashboard
    console.log('Login successful');
  };

  const handleSSOInitiate = async (provider: 'google' | 'microsoft', tenantId: string) => {
    return await execute(() => authService.initiateSSO(provider, tenantId));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full">
        <LoginForm
          onSubmit={handleLogin}
          onMFARequired={handleMFARequired}
          onSuccess={handleSuccess}
          onSSOInitiate={handleSSOInitiate}
          isLoading={isLoading}
          error={error ? getErrorMessage(error) : null}
        />
      </div>
    </div>
  );
}

/**
 * Example 2: Manual retry handling with custom error handling
 * 
 * This approach gives you more control over the retry logic
 */
export function LoginPageWithManualRetry() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { execute, retry } = useRetryableRequest({
    maxRetries: 3,
    showToastOnError: false, // We'll handle errors manually
    onError: (err) => {
      // Custom error handling
      setError(getErrorMessage(err));
    },
  });

  const handleLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await execute(() => authService.login(data));
      setIsLoading(false);
      return result;
    } catch (err) {
      setIsLoading(false);
      throw err;
    }
  };

  const handleRetry = async () => {
    setError(null);
    await retry();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-900">{error}</p>
            <button
              onClick={handleRetry}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )}
        <LoginForm
          onSubmit={handleLogin}
          onMFARequired={(sessionId) => console.log('MFA required:', sessionId)}
          onSuccess={() => console.log('Login successful')}
          onSSOInitiate={async (provider, tenantId) => {
            await execute(() => authService.initiateSSO(provider, tenantId));
          }}
          isLoading={isLoading}
          error={error}
        />
      </div>
    </div>
  );
}

/**
 * Example 3: Using withRetry directly for one-off requests
 * 
 * This is useful when you don't need the full hook functionality
 */
import { withRetry, shouldRetryError } from './retryHandler';

export async function loginWithRetry(credentials: LoginFormData) {
  try {
    const result = await withRetry(
      () => authService.login(credentials),
      {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 8000,
        shouldRetry: shouldRetryError,
      }
    );
    return result;
  } catch (error) {
    console.error('Login failed after retries:', error);
    throw error;
  }
}

/**
 * Example 4: Wrapping the entire app with ToastProvider
 * 
 * Add this to your App.tsx or main.tsx
 */
import { ToastProvider } from '../../../shared/context/ToastContext';
import { BrowserRouter } from 'react-router-dom';

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        {/* Your app routes and components */}
        <LoginPageWithRetry />
      </ToastProvider>
    </BrowserRouter>
  );
}

/**
 * Example 5: Using toast notifications directly
 * 
 * You can also use the toast context directly for custom notifications
 */
import { useToast } from '../../../shared/context/ToastContext';

export function CustomComponent() {
  const { showError, showSuccess, showInfo } = useToast();

  const handleAction = async () => {
    try {
      await authService.login({ tenantId: '1', email: 'test@example.com', password: 'password', rememberMe: false });
      showSuccess('Login successful!');
    } catch (error) {
      showError('Connection error. Please try again', {
        label: 'Retry',
        onClick: handleAction,
      });
    }
  };

  return (
    <button onClick={handleAction}>
      Login
    </button>
  );
}

/**
 * Example 6: Testing components with retry logic
 * 
 * Here's how to test components that use the retry handler
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

export function testLoginWithRetry() {
  it('should retry on network error and show toast', async () => {
    const user = userEvent.setup();
    
    // Mock authService to fail once then succeed
    const loginMock = vi.spyOn(authService, 'login')
      .mockRejectedValueOnce({ code: 'NETWORK_ERROR', message: 'Connection error' })
      .mockResolvedValueOnce({ requiresMFA: false, token: 'test-token' });

    render(
      <ToastProvider>
        <LoginPageWithRetry />
      </ToastProvider>
    );

    // Fill in form and submit
    await user.type(screen.getByLabelText('Email address'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    // Wait for toast to appear
    await waitFor(() => {
      expect(screen.getByText('Connection error')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    // Click retry button
    await user.click(screen.getByText('Retry'));

    // Wait for success
    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledTimes(2);
    });
  });
}
