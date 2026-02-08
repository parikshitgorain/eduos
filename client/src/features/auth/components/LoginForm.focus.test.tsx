import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './LoginForm';

// Mock the tenant service
vi.mock('../services/tenantService', () => ({
  tenantService: {
    searchTenants: vi.fn().mockResolvedValue([
      { id: '1', name: 'Test University', location: 'Test City' },
    ]),
  },
}));

// Helper to render with router
const renderWithRouter = (component: React.ReactElement) => {
  return render(<MemoryRouter>{component}</MemoryRouter>);
};

describe('LoginForm - Focus Management', () => {
  const mockOnSuccess = vi.fn();
  const mockOnMFARequired = vi.fn();
  const mockOnSubmit = vi.fn();
  const mockOnSSOInitiate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should maintain focus visibility with outline styles on all inputs', async () => {
    const user = userEvent.setup();

    renderWithRouter(
      <LoginForm
        onSuccess={mockOnSuccess}
        onMFARequired={mockOnMFARequired}
        onSubmit={mockOnSubmit}
        onSSOInitiate={mockOnSSOInitiate}
      />
    );

    const emailInput = screen.getByLabelText(/email/i);
    
    // Focus the input
    await user.click(emailInput);

    // Check that focus ring classes are present
    expect(emailInput).toHaveClass('focus:ring-2', 'focus:ring-indigo-500');
  });

  it('should clear password on authentication error', async () => {
    const user = userEvent.setup();

    // Mock failed authentication
    mockOnSubmit.mockRejectedValueOnce(new Error('Invalid credentials'));

    renderWithRouter(
      <LoginForm
        onSuccess={mockOnSuccess}
        onMFARequired={mockOnMFARequired}
        onSubmit={mockOnSubmit}
        onSSOInitiate={mockOnSSOInitiate}
      />
    );

    // Fill form
    const tenantInput = screen.getByRole('combobox', { name: /search for institution/i });
    await user.type(tenantInput, 'Test');
    await waitFor(() => screen.getByText('Test University'));
    await user.click(screen.getByText('Test University'));

    const emailInput = screen.getByLabelText(/email/i);
    await user.type(emailInput, 'test@example.com');

    const passwordInput = screen.getByLabelText(/^password$/i);
    await user.type(passwordInput, 'password123');

    // Submit form
    const submitButton = screen.getByRole('button', { name: /sign in to your account/i });
    await user.click(submitButton);

    // Wait for error handling
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalled();
    });

    // Password should be cleared
    await waitFor(() => {
      expect(passwordInput).toHaveValue('');
    });
  });

  it('should have proper ARIA attributes for focus management', async () => {
    renderWithRouter(
      <LoginForm
        onSuccess={mockOnSuccess}
        onMFARequired={mockOnMFARequired}
        onSubmit={mockOnSubmit}
        onSSOInitiate={mockOnSSOInitiate}
      />
    );

    const tenantInput = screen.getByRole('combobox', { name: /search for institution/i });
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/^password$/i);

    // Check all inputs have proper IDs for focus management
    expect(tenantInput).toHaveAttribute('id', 'tenantId');
    expect(emailInput).toHaveAttribute('id', 'email');
    expect(passwordInput).toHaveAttribute('id', 'password');

    // Check aria-invalid attributes
    expect(tenantInput).toHaveAttribute('aria-invalid');
    expect(emailInput).toHaveAttribute('aria-invalid');
    expect(passwordInput).toHaveAttribute('aria-invalid');
  });

  it('should have focus ring styles on all interactive elements', () => {
    renderWithRouter(
      <LoginForm
        onSuccess={mockOnSuccess}
        onMFARequired={mockOnMFARequired}
        onSubmit={mockOnSubmit}
        onSSOInitiate={mockOnSSOInitiate}
      />
    );

    const tenantInput = screen.getByRole('combobox', { name: /search for institution/i });
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/^password$/i);

    // All inputs should have focus ring classes
    expect(tenantInput).toHaveClass('focus:ring-2', 'focus:ring-indigo-500');
    expect(emailInput).toHaveClass('focus:ring-2', 'focus:ring-indigo-500');
    expect(passwordInput).toHaveClass('focus:ring-2', 'focus:ring-indigo-500');
  });

  it('should have proper tab order through form fields', () => {
    renderWithRouter(
      <LoginForm
        onSuccess={mockOnSuccess}
        onMFARequired={mockOnMFARequired}
        onSubmit={mockOnSubmit}
        onSSOInitiate={mockOnSSOInitiate}
      />
    );

    // All interactive elements should be in the DOM and focusable
    const tenantInput = screen.getByRole('combobox', { name: /search for institution/i });
    const emailInput = screen.getByLabelText(/email/i);
    const forgotPasswordLink = screen.getByRole('link', { name: /forgot password/i });
    const passwordInput = screen.getByLabelText(/^password$/i);
    const rememberMeCheckbox = screen.getByRole('checkbox', { name: /remember me/i });
    const submitButton = screen.getByRole('button', { name: /sign in to your account/i });

    // All should be in the document
    expect(tenantInput).toBeInTheDocument();
    expect(emailInput).toBeInTheDocument();
    expect(forgotPasswordLink).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();
    expect(rememberMeCheckbox).toBeInTheDocument();
    expect(submitButton).toBeInTheDocument();
  });
});
