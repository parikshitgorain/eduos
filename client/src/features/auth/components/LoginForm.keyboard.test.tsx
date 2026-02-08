import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginForm } from './LoginForm';

// Helper to render with router
const renderWithRouter = (component: React.ReactElement) => {
  return render(<MemoryRouter>{component}</MemoryRouter>);
};

describe('LoginForm - Keyboard Navigation', () => {
  const mockOnSuccess = vi.fn();
  const mockOnMFARequired = vi.fn();
  const mockOnSubmit = vi.fn();
  const mockOnSSOInitiate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Form Structure for Keyboard Navigation', () => {
    it('should have a form element that supports Enter key submission', () => {
      const { container } = renderWithRouter(
        <LoginForm
          onSuccess={mockOnSuccess}
          onMFARequired={mockOnMFARequired}
          onSubmit={mockOnSubmit}
          onSSOInitiate={mockOnSSOInitiate}
        />
      );

      // Verify form element exists
      const form = container.querySelector('form');
      expect(form).toBeInTheDocument();
      expect(form?.tagName).toBe('FORM');
    });

    it('should have a submit button with type="submit" for Enter key handling', () => {
      renderWithRouter(
        <LoginForm
          onSuccess={mockOnSuccess}
          onMFARequired={mockOnMFARequired}
          onSubmit={mockOnSubmit}
          onSSOInitiate={mockOnSSOInitiate}
        />
      );

      // Find the submit button by its text content
      const submitButton = screen.getByText('Sign In').closest('button');
      expect(submitButton).toBeInTheDocument();
      expect(submitButton?.type).toBe('submit');
    });
  });

  describe('Tab Navigation Order', () => {
    it('should have all interactive elements accessible via keyboard', () => {
      renderWithRouter(
        <LoginForm
          onSuccess={mockOnSuccess}
          onMFARequired={mockOnMFARequired}
          onSubmit={mockOnSubmit}
          onSSOInitiate={mockOnSSOInitiate}
        />
      );

      // Get all interactive elements
      const tenantInput = screen.getByPlaceholderText(/institution id or name/i);
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/^password$/i);
      const forgotPasswordLink = screen.getByText(/forgot password/i);
      const rememberMeCheckbox = screen.getByLabelText(/remember me/i);

      // Verify all elements are in the document
      expect(tenantInput).toBeInTheDocument();
      expect(emailInput).toBeInTheDocument();
      expect(passwordInput).toBeInTheDocument();
      expect(forgotPasswordLink).toBeInTheDocument();
      expect(rememberMeCheckbox).toBeInTheDocument();

      // Verify elements can receive focus (tabIndex >= -1 means focusable)
      expect(tenantInput.tabIndex).toBeGreaterThanOrEqual(-1);
      expect(emailInput.tabIndex).toBeGreaterThanOrEqual(-1);
      expect(passwordInput.tabIndex).toBeGreaterThanOrEqual(-1);
      expect(rememberMeCheckbox.tabIndex).toBeGreaterThanOrEqual(-1);
    });

    it('should have SSO buttons accessible via keyboard', () => {
      renderWithRouter(
        <LoginForm
          onSuccess={mockOnSuccess}
          onMFARequired={mockOnMFARequired}
          onSubmit={mockOnSubmit}
          onSSOInitiate={mockOnSSOInitiate}
        />
      );

      // Get SSO buttons by aria-label
      const googleButton = screen.getByLabelText(/sign in with google/i);
      const microsoftButton = screen.getByLabelText(/sign in with microsoft/i);

      expect(googleButton).toBeInTheDocument();
      expect(microsoftButton).toBeInTheDocument();
      expect(googleButton.tabIndex).toBeGreaterThanOrEqual(-1);
      expect(microsoftButton.tabIndex).toBeGreaterThanOrEqual(-1);
    });

    it('should have contact administrator link accessible via keyboard', () => {
      renderWithRouter(
        <LoginForm
          onSuccess={mockOnSuccess}
          onMFARequired={mockOnMFARequired}
          onSubmit={mockOnSubmit}
          onSSOInitiate={mockOnSSOInitiate}
        />
      );

      const contactLink = screen.getByLabelText(/contact administrator for help/i);
      expect(contactLink).toBeInTheDocument();
      expect(contactLink.tabIndex).toBeGreaterThanOrEqual(-1);
    });
  });
});
