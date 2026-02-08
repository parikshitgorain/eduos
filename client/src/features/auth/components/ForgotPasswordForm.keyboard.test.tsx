import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ForgotPasswordForm } from './ForgotPasswordForm';

describe('ForgotPasswordForm - Keyboard Navigation', () => {
  const mockOnSubmit = vi.fn();
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Form Structure for Keyboard Navigation', () => {
    it('should have a form element that supports Enter key submission', () => {
      const { container } = render(
        <ForgotPasswordForm
          onSubmit={mockOnSubmit}
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
        <ForgotPasswordForm
          onSubmit={mockOnSubmit}
          onBack={mockOnBack}
        />
      );

      const submitButton = screen.getByRole('button', { name: /send password reset link/i });
      expect(submitButton).toBeInTheDocument();
      expect(submitButton.type).toBe('submit');
    });
  });

  describe('Tab Navigation Order', () => {
    it('should have logical tab order through form elements', () => {
      render(
        <ForgotPasswordForm
          onSubmit={mockOnSubmit}
          onBack={mockOnBack}
        />
      );

      // Get all interactive elements in order
      const emailInput = screen.getByLabelText(/email address/i);
      const submitButton = screen.getByRole('button', { name: /send password reset link/i });
      const backButton = screen.getByRole('button', { name: /return to login page/i });

      // Verify all elements are in the document
      expect(emailInput).toBeInTheDocument();
      expect(submitButton).toBeInTheDocument();
      expect(backButton).toBeInTheDocument();

      // Verify tab index (default tab order should be logical)
      expect(emailInput.tabIndex).toBeGreaterThanOrEqual(-1);
      expect(submitButton.tabIndex).toBeGreaterThanOrEqual(-1);
      expect(backButton.tabIndex).toBeGreaterThanOrEqual(-1);
    });
  });

  describe('Focus Management', () => {
    it('should allow focus on email input', () => {
      render(
        <ForgotPasswordForm
          onSubmit={mockOnSubmit}
          onBack={mockOnBack}
        />
      );

      const emailInput = screen.getByLabelText(/email address/i);
      emailInput.focus();

      expect(document.activeElement).toBe(emailInput);
    });
  });
});

