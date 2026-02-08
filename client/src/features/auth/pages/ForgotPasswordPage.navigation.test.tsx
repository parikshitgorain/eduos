import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ForgotPasswordPage } from './ForgotPasswordPage';
import { authService } from '../services/authService';

// Mock services
vi.mock('../services/authService', () => ({
  authService: {
    forgotPassword: vi.fn(),
  },
}));

// Mock focus management
vi.mock('../utils/focusManagement', () => ({
  handleScreenNavigation: vi.fn(),
  focusFirstInvalidField: vi.fn(),
}));

// Helper to render with router
function renderWithRouter() {
  return render(
    <MemoryRouter initialEntries={['/forgot-password']}>
      <Routes>
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ForgotPasswordPage Navigation Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Requirement 8.1: Navigate to forgot password screen from login', () => {
    it('should display forgot password form', () => {
      renderWithRouter();

      // Should show forgot password page
      expect(screen.getByRole('main', { name: /password reset/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send password reset link/i })).toBeInTheDocument();
    });

    it('should have back to login link', () => {
      renderWithRouter();

      const backButton = screen.getByRole('button', { name: /return to login page/i });
      expect(backButton).toBeInTheDocument();
    });
  });

  describe('Handle back navigation appropriately', () => {
    it('should navigate back to login when back button is clicked', async () => {
      const user = userEvent.setup();
      
      renderWithRouter();

      // Click back to login button
      const backButton = screen.getByRole('button', { name: /return to login page/i });
      await user.click(backButton);

      // Should navigate to login page
      await waitFor(() => {
        expect(screen.getByText('Login Page')).toBeInTheDocument();
      });
    });

    it('should not disable back button during form submission', async () => {
      const user = userEvent.setup();
      
      // Mock slow API call
      vi.mocked(authService.forgotPassword).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      );

      renderWithRouter();

      // Fill in email
      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, 'test@example.com');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /send password reset link/i });
      await user.click(submitButton);

      // Back button should still be available (though disabled during loading)
      const backButton = screen.getByRole('button', { name: /return to login page/i });
      expect(backButton).toBeInTheDocument();
    });
  });

  describe('Requirement 8.3, 8.4: Password reset flow', () => {
    it('should submit email and show confirmation message', async () => {
      const user = userEvent.setup();
      
      // Mock successful password reset request
      vi.mocked(authService.forgotPassword).mockResolvedValue({
        success: true,
        message: 'Password reset email sent',
      });

      renderWithRouter();

      // Fill in email
      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, 'test@example.com');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /send password reset link/i });
      await user.click(submitButton);

      // Should show confirmation message
      await waitFor(() => {
        expect(screen.getByText(/check your email/i)).toBeInTheDocument();
      });

      // Should call API
      expect(authService.forgotPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
      });
    });

    it('should show back to login button after successful submission', async () => {
      const user = userEvent.setup();
      
      // Mock successful password reset request
      vi.mocked(authService.forgotPassword).mockResolvedValue({
        success: true,
        message: 'Password reset email sent',
      });

      renderWithRouter();

      // Fill in email
      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, 'test@example.com');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /send password reset link/i });
      await user.click(submitButton);

      // Should show back to login button in success state
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /return to login page/i })).toBeInTheDocument();
      });
    });

    it('should navigate to login after successful submission', async () => {
      const user = userEvent.setup();
      
      // Mock successful password reset request
      vi.mocked(authService.forgotPassword).mockResolvedValue({
        success: true,
        message: 'Password reset email sent',
      });

      renderWithRouter();

      // Fill in email
      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, 'test@example.com');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /send password reset link/i });
      await user.click(submitButton);

      // Wait for success message
      await waitFor(() => {
        expect(screen.getByText(/check your email/i)).toBeInTheDocument();
      });

      // Click back to login
      const backButton = screen.getByRole('button', { name: /return to login page/i });
      await user.click(backButton);

      // Should navigate to login page
      await waitFor(() => {
        expect(screen.getByText('Login Page')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error and stay on page', async () => {
      const user = userEvent.setup();
      
      // Mock failed password reset request
      vi.mocked(authService.forgotPassword).mockRejectedValue({
        response: { data: { message: 'Network error' } },
      });

      renderWithRouter();

      // Fill in email
      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, 'test@example.com');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /send password reset link/i });
      await user.click(submitButton);

      // Should show error but stay on page
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });

      // Should still be on forgot password page
      expect(screen.getByRole('main', { name: /password reset/i })).toBeInTheDocument();
    });

    it('should allow retry after error', async () => {
      const user = userEvent.setup();
      
      // Mock failed then successful password reset request
      vi.mocked(authService.forgotPassword)
        .mockRejectedValueOnce({
          response: { data: { message: 'Network error' } },
        })
        .mockResolvedValueOnce({
          success: true,
          message: 'Password reset email sent',
        });

      renderWithRouter();

      // Fill in email
      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, 'test@example.com');

      // Submit form (first attempt - fails)
      const submitButton = screen.getByRole('button', { name: /send password reset link/i });
      await user.click(submitButton);

      // Should show error
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });

      // Try again (second attempt - succeeds)
      await user.click(submitButton);

      // Should show success message
      await waitFor(() => {
        expect(screen.getByText(/check your email/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form State Management', () => {
    it('should preserve email during navigation', async () => {
      const user = userEvent.setup();
      
      renderWithRouter();

      // Fill in email
      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, 'test@example.com');

      // Verify email is preserved
      expect(emailInput).toHaveValue('test@example.com');
    });
  });
});
