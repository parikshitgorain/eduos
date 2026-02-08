import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './features/auth/context/AuthContext';
import { LoginPage } from './features/auth/pages/LoginPage';

/**
 * Main App Component
 * Sets up routing and authentication context
 */
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
          {/* TODO: Add more routes (MFA, forgot password, dashboard, etc.) */}
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
