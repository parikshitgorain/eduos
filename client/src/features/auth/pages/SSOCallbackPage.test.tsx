import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SSOCallbackPage } from './SSOCallbackPage';
import { authService } from '../services/authService';
import { tokenService } from '../services/tokenService';

// Mock the services
vi.mock('../services/authService');
vi.mock('../services/tokenService');

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('SSOCallbackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console errors in tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('displays loading state initially', async () => {
    // Mock to prevent the callback from executing
    vi.mocked(authService.handleSSOCallback).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(
      <MemoryRouter initialEntries={['/?code=abc123&state=xyz789']}>
        <SSOCallbackPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/completing authentication/i)).toBeInTheDocument();
  });

  it('handles successful SSO callback', async () => {
    const mockToken = 'mock-jwt-token';
    vi.mocked(authService.handleSSOCallback).mockResolvedValue({
      token: mockToken,
    });

    render(
      <MemoryRouter initialEntries={['/?code=abc123&state=xyz789']}>
        <SSOCallbackPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(authService.handleSSOCallback).toHaveBeenCalledWith('abc123', 'xyz789');
      expect(tokenService.setToken).toHaveBeenCalledWith(mockToken, false);
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    });
  });

  it('displays error when error parameter is present', async () => {
    render(
      <MemoryRouter initialEntries={['/?error=access_denied&error_description=User%20cancelled']}>
        <SSOCallbackPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/user cancelled/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /back to login/i })).toBeInTheDocument();
    });
  });

  it('displays error when code is missing', async () => {
    render(
      <MemoryRouter initialEntries={['/?state=xyz789']}>
        <SSOCallbackPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/invalid callback parameters/i)).toBeInTheDocument();
    });
  });

  it('displays error when state is missing', async () => {
    render(
      <MemoryRouter initialEntries={['/?code=abc123']}>
        <SSOCallbackPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/invalid callback parameters/i)).toBeInTheDocument();
    });
  });

  it('displays error when SSO callback fails', async () => {
    vi.mocked(authService.handleSSOCallback).mockRejectedValue(
      new Error('Network error')
    );

    render(
      <MemoryRouter initialEntries={['/?code=abc123&state=xyz789']}>
        <SSOCallbackPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/failed to complete sso authentication/i)).toBeInTheDocument();
    });
  });
});
