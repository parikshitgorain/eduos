import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ForgotPasswordForm } from '../components/ForgotPasswordForm';
import { authService } from '../services/authService';
import { handleScreenNavigation } from '../utils/focusManagement';

/**
 * ForgotPasswordPage Component
 * Password reset request page with forgot password form
 */
export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manage focus when page loads
  useEffect(() => {
    handleScreenNavigation('Password reset page', 'email');
  }, []);

  const handleSubmit = async (email: string) => {
    setIsLoading(true);
    setError(null);

    try {
      await authService.forgotPassword({ email });
      // Success is handled by the form component showing confirmation
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send reset link. Please try again.');
      throw err; // Re-throw to let form handle it
    } finally {
      setIsLoading(false);
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
          <main className="bg-white rounded-lg shadow-md p-8" role="main" aria-label="Password reset">
            {/* Logo */}
            <header className="text-center mb-8">
              <h1 className="text-3xl font-bold text-primary-600">EduOS</h1>
            </header>

            {/* Heading */}
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Reset Password</h2>
              <p className="mt-2 text-sm text-gray-600">
                Forgot your password? No problem, we'll help you reset it.
              </p>
            </div>

            {/* Forgot Password Form */}
            <ForgotPasswordForm
              onSubmit={handleSubmit}
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
