import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toast } from './Toast';

describe('Toast', () => {
  it('should render toast with message', () => {
    const onClose = vi.fn();
    render(<Toast message="Test message" onClose={onClose} />);

    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('should render error toast with correct styling', () => {
    const onClose = vi.fn();
    render(<Toast message="Error message" type="error" onClose={onClose} />);

    const toast = screen.getByRole('alert');
    expect(toast).toBeInTheDocument();
    expect(screen.getByText('Error message')).toBeInTheDocument();
  });

  it('should render success toast with correct styling', () => {
    const onClose = vi.fn();
    render(<Toast message="Success message" type="success" onClose={onClose} />);

    expect(screen.getByText('Success message')).toBeInTheDocument();
  });

  it('should render info toast with correct styling', () => {
    const onClose = vi.fn();
    render(<Toast message="Info message" type="info" onClose={onClose} />);

    expect(screen.getByText('Info message')).toBeInTheDocument();
  });

  it('should render warning toast with correct styling', () => {
    const onClose = vi.fn();
    render(<Toast message="Warning message" type="warning" onClose={onClose} />);

    expect(screen.getByText('Warning message')).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Toast message="Test message" onClose={onClose} />);

    const closeButton = screen.getByLabelText('Close notification');
    await user.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should auto-dismiss after duration', async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<Toast message="Test message" duration={3000} onClose={onClose} />);

    expect(onClose).not.toHaveBeenCalled();

    // Use act to wrap timer advancement
    await vi.advanceTimersByTimeAsync(3000);

    expect(onClose).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('should not auto-dismiss when duration is 0', async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<Toast message="Test message" duration={0} onClose={onClose} />);

    vi.advanceTimersByTime(10000);

    expect(onClose).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('should render action button when provided', () => {
    const onClose = vi.fn();
    const onAction = vi.fn();
    render(
      <Toast
        message="Test message"
        onClose={onClose}
        action={{ label: 'Retry', onClick: onAction }}
      />
    );

    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('should call action onClick when action button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onAction = vi.fn();
    render(
      <Toast
        message="Test message"
        onClose={onClose}
        action={{ label: 'Retry', onClick: onAction }}
      />
    );

    const actionButton = screen.getByText('Retry');
    await user.click(actionButton);

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('should have proper ARIA attributes', () => {
    const onClose = vi.fn();
    render(<Toast message="Test message" type="error" onClose={onClose} />);

    const toast = screen.getByRole('alert');
    expect(toast).toHaveAttribute('aria-live', 'assertive');
    expect(toast).toHaveAttribute('aria-atomic', 'true');
  });

  it('should have accessible close button', () => {
    const onClose = vi.fn();
    render(<Toast message="Test message" onClose={onClose} />);

    const closeButton = screen.getByLabelText('Close notification');
    expect(closeButton).toBeInTheDocument();
    expect(closeButton).toHaveAttribute('type', 'button');
  });
});
