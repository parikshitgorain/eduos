import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MFAPage } from './MFAPage';
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

describe('MFAPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders MFA page with form', () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/mfa', state: { sessionId: 'session-123' } }]}>
        <Routes>
          <Route path="/mfa" element={<MFAPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Use getAllByText to handle multiple matches (heading + screen reader announcement)
    const headings = screen.getAllByText(/two-factor authentication/i);
    expect(headings.length).toBeGreaterThan(0);
    expect(screen.getByText(/we've sent a verification code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
  });

  it('redirects to login if no session ID', () => {
    render(
      <MemoryRouter initialEntries={['/mfa']}>
        <Routes>
          <Route path="/mfa" element={<MFAPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('handles successful MFA verification', async () => {
    const user = userEvent.setup();
    const mockToken = 'mock-jwt-token';
    
    vi.mocked(authService.verifyMFA).mockResolvedValue({
      success: true,
      token: mockToken,
    });

    render(
      <MemoryRouter initialEntries={[{ pathname: '/mfa', state: { sessionId: 'session-123' } }]}>
        <Routes>
          <Route path="/mfa" element={<MFAPage />} />
        </Routes>
      </MemoryRouter>
    );

    const otpInput = screen.getByLabelText(/verification code/i);
    await user.type(otpInput, '123456');

    await waitFor(() => {
      expect(authService.verifyMFA).toHaveBeenCalledWith({
        sessionId: 'session-123',
        otp: '123456',
      });
      expect(tokenService.setToken).toHaveBeenCalledWith(mockToken, false);
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    });
  });

  it('displays error message on verification failure', async () => {
    const user = userEvent.setup();
    
    vi.mocked(authService.verifyMFA).mockRejectedValue({
      response: {
        data: {
          message: 'Invalid verification code',
        },
      },
    });

    render(
      <MemoryRouter initialEntries={[{ pathname: '/mfa', state: { sessionId: 'session-123' } }]}>
        <Routes>
          <Route path="/mfa" element={<MFAPage />} />
        </Routes>
      </MemoryRouter>
    );

    const otpInput = screen.getByLabelText(/verification code/i);
    await user.type(otpInput, '123456');

    await waitFor(() => {
      expect(screen.getByText(/invalid verification code/i)).toBeInTheDocument();
    });
  });

  it('navigates back to login when back button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={[{ pathname: '/mfa', state: { sessionId: 'session-123' } }]}>
        <Routes>
          <Route path="/mfa" element={<MFAPage />} />
        </Routes>
      </MemoryRouter>
    );

    const backButton = screen.getByRole('button', { name: /return to login page/i });
    await user.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('displays EduOS logo and footer', () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/mfa', state: { sessionId: 'session-123' } }]}>
        <Routes>
          <Route path="/mfa" element={<MFAPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('EduOS')).toBeInTheDocument();
    expect(screen.getByText(/terms of service/i)).toBeInTheDocument();
    expect(screen.getByText(/privacy policy/i)).toBeInTheDocument();
    expect(screen.getByText(/© \d{4} EduOS/)).toBeInTheDocument();
  });
});
