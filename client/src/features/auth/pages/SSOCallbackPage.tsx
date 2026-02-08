import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../services/authService';
import { tokenService } from '../services/tokenService';
import { LoadingIndicator } from '../../../shared/components/LoadingIndicator';
import { ErrorDisplay } from '../../../shared/components/ErrorDisplay';

/**
 * SSOCallbackPage Component
 * Handles OAuth callback from SSO providers
 */
export function SSOCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get authorization code from URL
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const errorParam = searchParams.get('error');

        // Check for error from provider
        if (errorParam) {
          const errorDescription = searchParams.get('error_description') || 'SSO authentication failed';
          setError(errorDescription);
          return;
        }

        // Validate required parameters
        if (!code || !state) {
          setError('Invalid callback parameters');
          return;
        }

        // Exchange authorization code for token
        const response = await authService.handleSSOCallback(code, state);

        // Store token
        tokenService.setToken(response.token, false);

        // Redirect to dashboard
        navigate('/dashboard', { replace: true });
      } catch (err) {
        console.error('SSO callback error:', err);
        setError('Failed to complete SSO authentication. Please try again.');
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Authentication Error</h1>
            </div>

            <ErrorDisplay message={error} className="mb-6" />

            <button
              onClick={() => navigate('/login')}
              className="w-full h-12 rounded-lg font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <LoadingIndicator size="lg" />
        <p className="mt-4 text-gray-600">Completing authentication...</p>
      </div>
    </div>
  );
}
