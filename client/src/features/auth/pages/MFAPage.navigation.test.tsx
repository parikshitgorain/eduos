import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MFAPage } from './MFAPage';
import { authService } from '../services/authService';
import { tokenService } from '../services/tokenService';

// Mock services
vi.mock('../services/authService', () => ({
  authService: {
    verifyMFA: vi.fn(),
  },
}));

vi.mock('../services/tokenService', () => ({
  tokenService: {
    setToken: vi.fn(),
  },
}));

// Mock focus management
vi.mock('../utils/focusManagement', () => ({
  handleScreenNavigation: vi.fn(),
  focusFirstInvalidField: vi.fn(),
}));

// Helper to render with router and state
function renderWithRouter(sessionId?: string) {
  const initialEntries = sessionId
    ? [{ pathname: '/mfa', state: { sessionId } }]
    : ['/mfa'];

  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/mfa" element={<MFAPage />} />
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('MFAPage Navigation Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Requirement 2.6: Navigate to MFA screen when MFA is required', () => {
    it('should redirect to login if no session ID is provided', () => {
      renderWithRouter();

      // Should redirect to login page
      expect(screen.queryByRole('main', { name: /two-factor authentication/i })).not.toBeInTheDocument();
    });

    it('should display MFA form when session ID is provided', () => {
      renderWithRouter('test-session-id');

      // Should show MFA page
      expect(screen.getByRole('main', { name: /two-factor authentication/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
    });
  });

  describe('Requirement 2.5: Redirect to dashboard on successful authentication', () => {
    it('should navigate to dashboard after successful MFA verification', async () => {
      const user = userEvent.setup();
      
      // Mock successful MFA verification
      vi.mocked(authService.verifyMFA).mockResolvedValue({
        success: true,
        token: 'test-token',
      });

      renderWithRouter('test-session-id');

      // Enter OTP
      const otpInput = screen.getByLabelText(/verification code/i);
      await user.type(otpInput, '123456');

      // Verify MFA service was called
      await waitFor(() => {
        expect(authService.verifyMFA).toHaveBeenCalledWith({
          sessionId: 'test-session-id',
          otp: '123456',
        });
      });

      // Verify token was stored
      await waitFor(() => {
        expect(tokenService.setToken).toHaveBeenCalledWith('test-token', false);
      });
    });
  });

  describe('Handle back navigation appropriately', () => {
    it('should navigate back to login when back button is clicked', async () => {
      const user = userEvent.setup();
      
      renderWithRouter('test-session-id');

      // Click back to login button
      const backButton = screen.getByRole('button', { name: /return to login page/i });
      await user.click(backButton);

      // Should navigate to login page
      await waitFor(() => {
        expect(screen.getByText('Login Page')).toBeInTheDocument();
      });
    });

    it('should allow user to return to login and try again', () => {
      renderWithRouter('test-session-id');

      // Verify back button exists
      const backButton = screen.getByRole('button', { name: /return to login page/i });
      expect(backButton).toBeInTheDocument();
      expect(backButton).not.toBeDisabled();
    });
  });

  describe('MFA Error Handling', () => {
    it('should display error and allow retry without navigation', async () => {
      const user = userEvent.setup();
      
      // Mock failed MFA verification
      vi.mocked(authService.verifyMFA).mockRejectedValue({
        response: { data: { message: 'Invalid OTP' } },
      });

      renderWithRouter('test-session-id');

      // Enter invalid OTP
      const otpInput = screen.getByLabelText(/verification code/i);
      await user.type(otpInput, '000000');

      // Should show error but stay on MFA page
      await waitFor(() => {
        expect(screen.getByText(/invalid otp/i)).toBeInTheDocument();
      });

      // Should still be on MFA page
      expect(screen.getByRole('main', { name: /two-factor authentication/i })).toBeInTheDocument();
    });
  });

  describe('MFA Auto-Submit', () => {
    it('should auto-submit when 6 digits are entered', async () => {
      const user = userEvent.setup();
      
      // Mock successful MFA verification
      vi.mocked(authService.verifyMFA).mockResolvedValue({
        success: true,
        token: 'test-token',
      });

      renderWithRouter('test-session-id');

      // Enter 6-digit OTP
      const otpInput = screen.getByLabelText(/verification code/i);
      await user.type(otpInput, '123456');

      // Should auto-submit
      await waitFor(() => {
        expect(authService.verifyMFA).toHaveBeenCalled();
      });
    });
  });

  describe('Resend Code Navigation', () => {
    it('should allow resending code without leaving page', () => {
      renderWithRouter('test-session-id');

      // Initially, resend button should be disabled
      const resendButton = screen.getByRole('button', { name: /resend code available in \d+ seconds/i });
      expect(resendButton).toBeDisabled();

      // The button exists and will be enabled after countdown
      expect(resendButton).toBeInTheDocument();
    });
  });
});
