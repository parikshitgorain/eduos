import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoginForm } from '../components/LoginForm';
import { useAuth } from '../hooks/useAuth';
import { authService } from '../services/authService';
import type { SSOProvider } from '../components/SSOButtons';
import { handleScreenNavigation } from '../utils/focusManagement';

/**
 * LoginPage Component
 * Main login page with form and authentication logic
 */
export function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading, error } = useAuth();
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null);

  // Manage focus when page loads and check for session expiration message
  useEffect(() => {
    handleScreenNavigation('Login page', 'tenantId');
    
    // Check if we have a session expired message from the auth context
    if (error && error.includes('Session expired')) {
      setSessionExpiredMessage(error);
    }
  }, [error]);

  const handleSuccess = () => {
    // Check for redirect URL from session expiration
    const redirectUrl = sessionStorage.getItem('redirect_after_login');
    
    if (redirectUrl) {
      // Clear the stored redirect URL
      sessionStorage.removeItem('redirect_after_login');
      // Navigate to the stored URL
      navigate(redirectUrl);
    } else {
      // Default redirect to dashboard
      navigate('/dashboard');
    }
  };

  const handleMFARequired = (sessionId: string) => {
    // Navigate to MFA verification page
    navigate('/mfa', { state: { sessionId } });
  };

  const handleSSOInitiate = async (provider: SSOProvider, tenantId: string) => {
    try {
      // Call SSO initiation endpoint
      const response = await authService.initiateSSO(provider, tenantId);
      
      // Redirect to provider's authorization URL
      window.location.href = response.authorizationUrl;
    } catch (err) {
      // Error will be handled by the auth service
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 flex items-center justify-center py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-6">
          {/* Logo */}
          <header className="text-center">
            <h1 className="text-4xl font-bold text-primary-600">EduOS</h1>
            <p className="mt-2 text-sm text-gray-600">Sign in to your account</p>
          </header>

          {/* Login Form Card */}
          <main className="bg-white rounded-lg shadow-md p-8" role="main" aria-label="Login">
            {/* Session expired message */}
            {sessionExpiredMessage && (
              <div 
                className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md"
                role="alert"
                aria-live="polite"
              >
                <p className="text-sm text-yellow-800">{sessionExpiredMessage}</p>
              </div>
            )}
            
            <LoginForm
              onSuccess={handleSuccess}
              onMFARequired={handleMFARequired}
              onSubmit={login}
              onSSOInitiate={handleSSOInitiate}
              isLoading={isLoading}
              error={error}
            />
          </main>

          {/* Footer */}
          <footer className="text-center text-sm text-gray-600 pb-4" role="contentinfo">
            <div className="flex items-center justify-center gap-4">
              <a 
                href="/terms" 
                className="text-primary-600 hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded px-2 py-2 min-h-[44px] inline-flex items-center"
              >
                Terms of Service
              </a>
              <span aria-hidden="true">·</span>
              <a 
                href="/privacy" 
                className="text-primary-600 hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded px-2 py-2 min-h-[44px] inline-flex items-center"
              >
                Privacy Policy
              </a>
            </div>
            <div className="mt-2">© 2026 EduOS. All rights reserved.</div>
          </footer>
        </div>
      </div>
    </div>
  );
}
