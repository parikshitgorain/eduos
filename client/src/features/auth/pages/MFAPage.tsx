import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MFAForm } from '../components/MFAForm';
import { authService } from '../services/authService';
import { tokenService } from '../services/tokenService';
import { handleScreenNavigation } from '../utils/focusManagement';

/**
 * MFAPage Component
 * Two-factor authentication page with MFA form
 */
export function MFAPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get session ID from location state (passed from login)
  const sessionId = location.state?.sessionId as string | undefined;

  // Manage focus when page loads
  useEffect(() => {
    handleScreenNavigation('Two-factor authentication page', 'otp');
  }, []);

  // Redirect to login if no session ID
  if (!sessionId) {
    navigate('/login', { replace: true });
    return null;
  }

  const handleVerify = async (sessionId: string, otp: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.verifyMFA({ sessionId, otp });
      
      // Store token
      tokenService.setToken(response.token, false);

      // Redirect to dashboard
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid verification code. Please try again.');
      throw err; // Re-throw to let form handle it
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async (_sessionId: string) => {
    setError(null);
    
    try {
      // In a real implementation, we'd need to store the original credentials
      // TODO: Implement resend MFA code endpoint on backend
      // For now, this is a placeholder
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to resend code. Please try again.');
      throw err;
    }
  };

  const handleBack = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 flex items-center justify-center py-8 px-4">
        <div className="max-w-md w-full space-y-6">
          {/* Card */}
          <main className="bg-white rounded-lg shadow-md p-8" role="main" aria-label="Two-factor authentication">
            {/* Logo */}
            <header className="text-center mb-8">
              <h1 className="text-3xl font-bold text-primary-600">EduOS</h1>
            </header>

            {/* Heading */}
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Two-Factor Authentication</h2>
              <p className="mt-2 text-sm text-gray-600">
                We've sent a verification code to your authenticator app
              </p>
            </div>

            {/* MFA Form */}
            <MFAForm
              sessionId={sessionId}
              onVerify={handleVerify}
              onResend={handleResend}
              onBack={handleBack}
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
              <span aria-hidden="true">•</span>
              <a 
                href="/privacy" 
                className="text-primary-600 hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded px-2 py-2 min-h-[44px] inline-flex items-center"
              >
                Privacy Policy
              </a>
            </div>
            <p className="mt-2">© {new Date().getFullYear()} EduOS. All rights reserved.</p>
          </footer>
        </div>
      </div>
    </div>
  );
}
