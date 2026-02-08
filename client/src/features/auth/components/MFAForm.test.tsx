import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MFAForm } from './MFAForm';

describe('MFAForm', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('renders OTP input field and verify button', () => {
    const mockOnVerify = vi.fn();
    const mockOnResend = vi.fn();
    const mockOnBack = vi.fn();

    render(
      <MFAForm
        sessionId="session-123"
        onVerify={mockOnVerify}
        onResend={mockOnResend}
        onBack={mockOnBack}
      />
    );

    expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /verify/i })).toBeInTheDocument();
    expect(screen.getByText(/enter the 6-digit code/i)).toBeInTheDocument();
  });

  it('auto-submits when 6 digits are entered', async () => {
    vi.useRealTimers(); // Use real timers for userEvent
    const user = userEvent.setup();
    const mockOnVerify = vi.fn().mockResolvedValue(undefined);
    const mockOnResend = vi.fn();
    const mockOnBack = vi.fn();

    render(
      <MFAForm
        sessionId="session-123"
        onVerify={mockOnVerify}
        onResend={mockOnResend}
        onBack={mockOnBack}
      />
    );

    const otpInput = screen.getByLabelText(/verification code/i);
    await user.type(otpInput, '123456');

    await waitFor(() => {
      expect(mockOnVerify).toHaveBeenCalledWith('session-123', '123456');
    });
  });

  it('displays validation error for invalid OTP', async () => {
    vi.useRealTimers(); // Use real timers for userEvent
    const user = userEvent.setup();
    const mockOnVerify = vi.fn();
    const mockOnResend = vi.fn();
    const mockOnBack = vi.fn();

    render(
      <MFAForm
        sessionId="session-123"
        onVerify={mockOnVerify}
        onResend={mockOnResend}
        onBack={mockOnBack}
      />
    );

    const otpInput = screen.getByLabelText(/verification code/i);
    await user.type(otpInput, '12345'); // Only 5 digits

    await waitFor(() => {
      expect(screen.getByText(/otp must be 6 digits/i)).toBeInTheDocument();
    });
  });

  it('disables resend button initially and shows countdown', () => {
    const mockOnVerify = vi.fn();
    const mockOnResend = vi.fn();
    const mockOnBack = vi.fn();

    render(
      <MFAForm
        sessionId="session-123"
        onVerify={mockOnVerify}
        onResend={mockOnResend}
        onBack={mockOnBack}
      />
    );

    const resendButton = screen.getByRole('button', { name: /resend code available in 60 seconds/i });
    expect(resendButton).toBeDisabled();
  });

  it('calls onBack when back to login is clicked', async () => {
    vi.useRealTimers(); // Use real timers for userEvent
    const user = userEvent.setup();
    const mockOnVerify = vi.fn();
    const mockOnResend = vi.fn();
    const mockOnBack = vi.fn();

    render(
      <MFAForm
        sessionId="session-123"
        onVerify={mockOnVerify}
        onResend={mockOnResend}
        onBack={mockOnBack}
      />
    );

    const backButton = screen.getByRole('button', { name: /return to login page/i });
    await user.click(backButton);

    expect(mockOnBack).toHaveBeenCalled();
  });

  it('displays error message when error prop is provided', () => {
    const mockOnVerify = vi.fn();
    const mockOnResend = vi.fn();
    const mockOnBack = vi.fn();

    render(
      <MFAForm
        sessionId="session-123"
        onVerify={mockOnVerify}
        onResend={mockOnResend}
        onBack={mockOnBack}
        error="Invalid verification code"
      />
    );

    expect(screen.getByText(/invalid verification code/i)).toBeInTheDocument();
  });

  it('disables all inputs when isLoading is true', () => {
    const mockOnVerify = vi.fn();
    const mockOnResend = vi.fn();
    const mockOnBack = vi.fn();

    render(
      <MFAForm
        sessionId="session-123"
        onVerify={mockOnVerify}
        onResend={mockOnResend}
        onBack={mockOnBack}
        isLoading={true}
      />
    );

    expect(screen.getByLabelText(/verification code/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /verifying/i })).toBeDisabled();
  });
});
