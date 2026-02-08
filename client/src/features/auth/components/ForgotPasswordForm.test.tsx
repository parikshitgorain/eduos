import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ForgotPasswordForm } from './ForgotPasswordForm';

describe('ForgotPasswordForm', () => {
  it('renders email input and submit button', () => {
    const mockOnSubmit = vi.fn();
    const mockOnBack = vi.fn();

    render(<ForgotPasswordForm onSubmit={mockOnSubmit} onBack={mockOnBack} />);

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send password reset link/i })).toBeInTheDocument();
    expect(screen.getByText(/enter your email address/i)).toBeInTheDocument();
  });

  it('validates email format', async () => {
    const user = userEvent.setup();
    const mockOnSubmit = vi.fn();
    const mockOnBack = vi.fn();

    render(<ForgotPasswordForm onSubmit={mockOnSubmit} onBack={mockOnBack} />);

    const emailInput = screen.getByLabelText(/email address/i);
    await user.type(emailInput, 'invalid-email');

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
    });
  });

  it('calls onSubmit with email when form is submitted', async () => {
    const user = userEvent.setup();
    const mockOnSubmit = vi.fn().mockResolvedValue(undefined);
    const mockOnBack = vi.fn();

    render(<ForgotPasswordForm onSubmit={mockOnSubmit} onBack={mockOnBack} />);

    const emailInput = screen.getByLabelText(/email address/i);
    await user.type(emailInput, 'test@example.com');

    const submitButton = screen.getByRole('button', { name: /send password reset link/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith('test@example.com');
    });
  });

  it('displays success message after submission', async () => {
    const user = userEvent.setup();
    const mockOnSubmit = vi.fn().mockResolvedValue(undefined);
    const mockOnBack = vi.fn();

    render(<ForgotPasswordForm onSubmit={mockOnSubmit} onBack={mockOnBack} />);

    const emailInput = screen.getByLabelText(/email address/i);
    await user.type(emailInput, 'test@example.com');

    const submitButton = screen.getByRole('button', { name: /send password reset link/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
      expect(screen.getByText(/we've sent you a password reset link/i)).toBeInTheDocument();
    });
  });

  it('displays error message when provided', () => {
    const mockOnSubmit = vi.fn();
    const mockOnBack = vi.fn();

    render(
      <ForgotPasswordForm
        onSubmit={mockOnSubmit}
        onBack={mockOnBack}
        error="Network error occurred"
      />
    );

    expect(screen.getByText(/network error occurred/i)).toBeInTheDocument();
  });

  it('disables inputs when loading', () => {
    const mockOnSubmit = vi.fn();
    const mockOnBack = vi.fn();

    render(<ForgotPasswordForm onSubmit={mockOnSubmit} onBack={mockOnBack} isLoading={true} />);

    expect(screen.getByLabelText(/email address/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /sending reset link, please wait/i })).toBeDisabled();
  });

  it('calls onBack when back button is clicked', async () => {
    const user = userEvent.setup();
    const mockOnSubmit = vi.fn();
    const mockOnBack = vi.fn();

    render(<ForgotPasswordForm onSubmit={mockOnSubmit} onBack={mockOnBack} />);

    const backButton = screen.getByRole('button', { name: /return to login page/i });
    await user.click(backButton);

    expect(mockOnBack).toHaveBeenCalled();
  });

  it('shows back to login button after successful submission', async () => {
    const user = userEvent.setup();
    const mockOnSubmit = vi.fn().mockResolvedValue(undefined);
    const mockOnBack = vi.fn();

    render(<ForgotPasswordForm onSubmit={mockOnSubmit} onBack={mockOnBack} />);

    const emailInput = screen.getByLabelText(/email address/i);
    await user.type(emailInput, 'test@example.com');

    const submitButton = screen.getByRole('button', { name: /send password reset link/i });
    await user.click(submitButton);

    await waitFor(() => {
      const backButton = screen.getByRole('button', { name: /return to login page/i });
      expect(backButton).toBeInTheDocument();
    });

    const backButton = screen.getByRole('button', { name: /return to login page/i });
    await user.click(backButton);

    expect(mockOnBack).toHaveBeenCalled();
  });
});

