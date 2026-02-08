import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

// Mock all page components
vi.mock('./features/auth/pages/LoginPage', () => ({
  LoginPage: () => <div data-testid="login-page">Login Page</div>,
}));

vi.mock('./features/auth/pages/MFAPage', () => ({
  MFAPage: () => <div data-testid="mfa-page">MFA Page</div>,
}));

vi.mock('./features/auth/pages/ForgotPasswordPage', () => ({
  ForgotPasswordPage: () => <div data-testid="forgot-password-page">Forgot Password Page</div>,
}));

vi.mock('./features/auth/pages/SSOCallbackPage', () => ({
  SSOCallbackPage: () => <div data-testid="sso-callback-page">SSO Callback Page</div>,
}));

vi.mock('./features/auth/components/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <div data-testid="protected-route">{children}</div>,
}));

// Mock AuthProvider
vi.mock('./features/auth/context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('App Routing', () => {
  beforeEach(() => {
    // Reset window.location before each test
    window.history.pushState({}, '', '/');
  });

  it('should render login page at /login route', () => {
    window.history.pushState({}, '', '/login');
    render(<App />);
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  it('should render MFA page at /mfa route', () => {
    window.history.pushState({}, '', '/mfa');
    render(<App />);
    expect(screen.getByTestId('mfa-page')).toBeInTheDocument();
  });

  it('should render forgot password page at /forgot-password route', () => {
    window.history.pushState({}, '', '/forgot-password');
    render(<App />);
    expect(screen.getByTestId('forgot-password-page')).toBeInTheDocument();
  });

  it('should render SSO callback page at /auth/callback route', () => {
    window.history.pushState({}, '', '/auth/callback');
    render(<App />);
    expect(screen.getByTestId('sso-callback-page')).toBeInTheDocument();
  });

  it('should render protected dashboard at /dashboard route', () => {
    window.history.pushState({}, '', '/dashboard');
    render(<App />);
    expect(screen.getByTestId('protected-route')).toBeInTheDocument();
    expect(screen.getByText(/Welcome to EduOS/i)).toBeInTheDocument();
  });

  it('should redirect root path to login', () => {
    window.history.pushState({}, '', '/');
    render(<App />);
    // After redirect, should show login page
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  it('should redirect unknown paths to login', () => {
    window.history.pushState({}, '', '/unknown-route');
    render(<App />);
    // After redirect, should show login page
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });
});

describe('App Structure', () => {
  it('should wrap routes with AuthProvider', () => {
    render(<App />);
    // If AuthProvider is working, the app should render without errors
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  it('should use BrowserRouter for routing', () => {
    // This test verifies that the app renders without router errors
    expect(() => render(<App />)).not.toThrow();
  });
});
