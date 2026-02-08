import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import * as useAuthModule from '../hooks/useAuth';

// Mock the useAuth hook
vi.mock('../hooks/useAuth');

// Mock LoadingIndicator
vi.mock('../../../shared/components/LoadingIndicator', () => ({
  LoadingIndicator: () => <div data-testid="loading-indicator">Loading...</div>,
}));

describe('ProtectedRoute', () => {
  const mockUseAuth = vi.mocked(useAuthModule.useAuth);

  const renderProtectedRoute = (children: React.ReactNode) => {
    return render(
      <BrowserRouter>
        <ProtectedRoute>{children}</ProtectedRoute>
      </BrowserRouter>
    );
  };

  it('should render children when authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: null,
      token: 'test-token',
      error: null,
      login: vi.fn(),
      verifyMFA: vi.fn(),
      logout: vi.fn(),
      clearError: vi.fn(),
      setUser: vi.fn(),
    });

    renderProtectedRoute(<div>Protected Content</div>);

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should show loading indicator when loading', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      user: null,
      token: null,
      error: null,
      login: vi.fn(),
      verifyMFA: vi.fn(),
      logout: vi.fn(),
      clearError: vi.fn(),
      setUser: vi.fn(),
    });

    renderProtectedRoute(<div>Protected Content</div>);

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('should redirect to login when not authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      token: null,
      error: null,
      login: vi.fn(),
      verifyMFA: vi.fn(),
      logout: vi.fn(),
      clearError: vi.fn(),
      setUser: vi.fn(),
    });

    renderProtectedRoute(<div>Protected Content</div>);

    // When not authenticated, should not render protected content
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('should not render children when not authenticated and not loading', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      token: null,
      error: null,
      login: vi.fn(),
      verifyMFA: vi.fn(),
      logout: vi.fn(),
      clearError: vi.fn(),
      setUser: vi.fn(),
    });

    renderProtectedRoute(<div>Protected Content</div>);

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
  });
});
