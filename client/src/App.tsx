import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './features/auth/context/AuthContext';
import { LoginPage } from './features/auth/pages/LoginPage';
import { MFAPage } from './features/auth/pages/MFAPage';
import { ForgotPasswordPage } from './features/auth/pages/ForgotPasswordPage';
import { SSOCallbackPage } from './features/auth/pages/SSOCallbackPage';
import { ProtectedRoute } from './features/auth/components/ProtectedRoute';

/**
 * Main App Component
 * Sets up routing and authentication context for the EduOS platform
 * 
 * Routes:
 * - /login: Main login page with institution selection and credentials
 * - /mfa: Multi-factor authentication verification page
 * - /forgot-password: Password recovery page
 * - /auth/callback: SSO callback handler for Google/Microsoft authentication
 * - /dashboard: Protected dashboard (placeholder for authenticated content)
 * - /: Redirects to login or dashboard based on authentication state
 * 
 * Requirements: 2.5, 2.6, 4.4, 8.1
 */
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public authentication routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/mfa" element={<MFAPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/auth/callback" element={<SSOCallbackPage />} />
          
          {/* Protected routes - require authentication */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPlaceholder />
              </ProtectedRoute>
            }
          />
          
          {/* Root redirect - goes to login if not authenticated, dashboard if authenticated */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          
          {/* Catch-all redirect to login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

/**
 * Placeholder dashboard component
 * This will be replaced with actual dashboard implementation
 */
function DashboardPlaceholder() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Welcome to EduOS</h1>
        <p className="text-gray-600">Dashboard coming soon...</p>
      </div>
    </div>
  );
}

export default App;
