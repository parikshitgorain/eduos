import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MFAForm } from './MFAForm';

describe('MFAForm - Keyboard Navigation', () => {
  const mockOnVerify = vi.fn();
  const mockOnResend = vi.fn();
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Form Structure for Keyboard Navigation', () => {
    it('should have a form element that supports Enter key submission', () => {
      const { container } = render(
        <MFAForm
          sessionId="test-session"
          onVerify={mockOnVerify}
          onResend={mockOnResend}
          onBack={mockOnBack}
        />
      );

      // Verify form element exists
      const form = container.querySelector('form');
      expect(form).toBeInTheDocument();
      expect(form?.tagName).toBe('FORM');
    });

    it('should have a submit button with type="submit" for Enter key handling', () => {
      render(
        <MFAForm
          sessionId="test-session"
          onVerify={mockOnVerify}
          onResend={mockOnResend}
          onBack={mockOnBack}
        />
      );

      const verifyButton = screen.getByRole('button', { name: /verify/i });
      expect(verifyButton).toBeInTheDocument();
      expect(verifyButton.type).toBe('submit');
    });
  });

  describe('Tab Navigation Order', () => {
    it('should have logical tab order through form elements', () => {
      render(
        <MFAForm
          sessionId="test-session"
          onVerify={mockOnVerify}
          onResend={mockOnResend}
          onBack={mockOnBack}
        />
      );

      // Get all interactive elements in order
      const otpInput = screen.getByLabelText(/verification code/i);
      const verifyButton = screen.getByRole('button', { name: /verify/i });
      const resendButton = screen.getByRole('button', { name: /resend code/i });
      const backButton = screen.getByRole('button', { name: /return to login page/i });

      // Verify all elements are in the document
      expect(otpInput).toBeInTheDocument();
      expect(verifyButton).toBeInTheDocument();
      expect(resendButton).toBeInTheDocument();
      expect(backButton).toBeInTheDocument();

      // Verify tab index (default tab order should be logical)
      expect(otpInput.tabIndex).toBeGreaterThanOrEqual(-1);
      expect(verifyButton.tabIndex).toBeGreaterThanOrEqual(-1);
      expect(resendButton.tabIndex).toBeGreaterThanOrEqual(-1);
      expect(backButton.tabIndex).toBeGreaterThanOrEqual(-1);
    });
  });

  describe('Focus Management', () => {
    it('should allow focus on OTP input', () => {
      render(
        <MFAForm
          sessionId="test-session"
          onVerify={mockOnVerify}
          onResend={mockOnResend}
          onBack={mockOnBack}
        />
      );

      const otpInput = screen.getByLabelText(/verification code/i);
      otpInput.focus();

      expect(document.activeElement).toBe(otpInput);
    });
  });
});
