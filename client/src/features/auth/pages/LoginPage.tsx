import { useNavigate } from 'react-router-dom';
import { LoginForm } from '../components/LoginForm';
import { useAuth } from '../hooks/useAuth';

/**
 * LoginPage Component
 * Main login page with form and authentication logic
 */
export function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading, error } = useAuth();

  const handleSuccess = () => {
    // Redirect to dashboard on successful login
    navigate('/dashboard');
  };

  const handleMFARequired = (sessionId: string) => {
    // Navigate to MFA verification page
    navigate('/mfa', { state: { sessionId } });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Logo */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-primary-600">EduOS</h1>
          <p className="mt-2 text-sm text-gray-600">Sign in to your account</p>
        </div>

        {/* Login Form Card */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <LoginForm
            onSuccess={handleSuccess}
            onMFARequired={handleMFARequired}
            onSubmit={login}
            isLoading={isLoading}
            error={error}
          />
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-600">
          <a href="/terms" className="hover:text-gray-900">
            Terms of Service
          </a>
          {' · '}
          <a href="/privacy" className="hover:text-gray-900">
            Privacy Policy
          </a>
          <div className="mt-2">© 2026 EduOS. All rights reserved.</div>
        </div>
      </div>
    </div>
  );
}
