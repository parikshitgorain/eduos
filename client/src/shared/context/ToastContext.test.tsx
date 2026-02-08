import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from './ToastContext';

// Test component that uses the toast hook
function TestComponent() {
  const { showError, showSuccess, showInfo, showWarning } = useToast();

  return (
    <div>
      <button onClick={() => showError('Error message', { label: 'Retry', onClick: vi.fn() })}>
        Show Error
      </button>
      <button onClick={() => showSuccess('Success message')}>Show Success</button>
      <button onClick={() => showInfo('Info message')}>Show Info</button>
      <button onClick={() => showWarning('Warning message')}>Show Warning</button>
    </div>
  );
}

describe('ToastContext', () => {
  it('should throw error when useToast is used outside provider', () => {
    // Suppress console.error for this test
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useToast must be used within a ToastProvider');

    consoleError.mockRestore();
  });

  it('should show error toast with retry button', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    const button = screen.getByText('Show Error');
    await user.click(button);

    expect(screen.getByText('Error message')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('should show success toast', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    const button = screen.getByText('Show Success');
    await user.click(button);

    expect(screen.getByText('Success message')).toBeInTheDocument();
  });

  it('should show info toast', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    const button = screen.getByText('Show Info');
    await user.click(button);

    expect(screen.getByText('Info message')).toBeInTheDocument();
  });

  it('should show warning toast', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    const button = screen.getByText('Show Warning');
    await user.click(button);

    expect(screen.getByText('Warning message')).toBeInTheDocument();
  });

  it('should close toast when close button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    const button = screen.getByText('Show Info');
    await user.click(button);

    expect(screen.getByText('Info message')).toBeInTheDocument();

    const closeButton = screen.getByLabelText('Close notification');
    await user.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByText('Info message')).not.toBeInTheDocument();
    });
  });

  it('should show multiple toasts', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    await user.click(screen.getByText('Show Error'));
    await user.click(screen.getByText('Show Success'));

    expect(screen.getByText('Error message')).toBeInTheDocument();
    expect(screen.getByText('Success message')).toBeInTheDocument();
  });
});
