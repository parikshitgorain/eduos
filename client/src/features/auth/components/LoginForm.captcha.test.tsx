/**
 * Unit Tests for LoginForm CAPTCHA Functionality
 * Feature: login-authentication-ui
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LoginForm } from './LoginForm';
import { tenantService } from '../services/tenantService';

// Mock the services
vi.mock('../services/tenantService', () => ({
  tenantService: {
    searchTenants: vi.fn(),
  },
}));

// Mock react-google-recaptcha
vi.mock('react-google-recaptcha', () => ({
  default: vi.fn(({ onChange }) => (
    <div data-testid="recaptcha-mock">
      <button onClick={() => onChange('mock-captcha-token')}>Complete CAPTCHA</button>
    </div>
  )),
}));

// Helper to render with router
const renderWithRouter = (component: React.ReactElement) => {
  return render(<MemoryRouter>{component}</MemoryRouter>);
};

describe('LoginForm - CAPTCHA Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(tenantService.searchTenants).mockResolvedValue([
      { id: 'tenant-1', name: 'Test University', location: 'Test City' },
    ]);
  });

  /**
   * Task 7.7: Unit test for CAPTCHA trigger threshold
   * Validates: Requirement 7.1
   * 
   * Test that CAPTCHA appears after exactly 3 failed attempts
   */
  it('should display CAPTCHA after exactly 3 failed login attempts', async () => {
    const mockOnSubmit = vi.fn().mockRejectedValue(new Error('Invalid credentials'));
    const mockOnSuccess = vi.fn();
    const mockOnMFARequired = vi.fn();
    const mockOnSSOInitiate = vi.fn();

    const user = userEvent.setup();

    renderWithRouter(
      <LoginForm
        onSuccess={mockOnSuccess}
        onMFARequired={mockOnMFARequired}
        onSubmit={mockOnSubmit}
        onSSOInitiate={mockOnSSOInitiate}
      />
    );

    // CAPTCHA should not be visible initially
    expect(screen.queryByTestId('recaptcha-mock')).not.toBeInTheDocument();

    // Select a tenant
    const tenantInput = screen.getByRole('combobox');
    await user.type(tenantInput, 'Test');
    await waitFor(() => {
      expect(screen.getByText('Test University')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Test University'));

    // Enter email and password
    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');

    // First failed attempt - CAPTCHA should NOT appear
    const submitButton = screen.getByRole('button', { name: /sign in to your account/i });
    await user.click(submitButton);
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByTestId('recaptcha-mock')).not.toBeInTheDocument();

    // Second failed attempt - CAPTCHA should NOT appear
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByTestId('recaptcha-mock')).not.toBeInTheDocument();

    // Third failed attempt - CAPTCHA SHOULD appear
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledTimes(3);
    });
    
    // CAPTCHA should now be visible
    await waitFor(() => {
      expect(screen.getByTestId('recaptcha-mock')).toBeInTheDocument();
    });
  });

  /**
   * Task 7.7: CAPTCHA does not appear before 3 attempts
   * Validates: Requirement 7.1
   */
  it('should not display CAPTCHA after only 1 failed attempt', async () => {
    const mockOnSubmit = vi.fn().mockRejectedValue(new Error('Invalid credentials'));
    const mockOnSuccess = vi.fn();
    const mockOnMFARequired = vi.fn();
    const mockOnSSOInitiate = vi.fn();

    const user = userEvent.setup();

    renderWithRouter(
      <LoginForm
        onSuccess={mockOnSuccess}
        onMFARequired={mockOnMFARequired}
        onSubmit={mockOnSubmit}
        onSSOInitiate={mockOnSSOInitiate}
      />
    );

    // Select a tenant
    const tenantInput = screen.getByRole('combobox');
    await user.type(tenantInput, 'Test');
    await waitFor(() => {
      expect(screen.getByText('Test University')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Test University'));

    // Enter email and password
    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');

    // First failed attempt
    const submitButton = screen.getByRole('button', { name: /sign in to your account/i });
    await user.click(submitButton);
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });

    // CAPTCHA should not be visible
    expect(screen.queryByTestId('recaptcha-mock')).not.toBeInTheDocument();
  });

  /**
   * Task 7.7: CAPTCHA does not appear before 3 attempts
   * Validates: Requirement 7.1
   */
  it('should not display CAPTCHA after only 2 failed attempts', async () => {
    const mockOnSubmit = vi.fn().mockRejectedValue(new Error('Invalid credentials'));
    const mockOnSuccess = vi.fn();
    const mockOnMFARequired = vi.fn();
    const mockOnSSOInitiate = vi.fn();

    const user = userEvent.setup();

    renderWithRouter(
      <LoginForm
        onSuccess={mockOnSuccess}
        onMFARequired={mockOnMFARequired}
        onSubmit={mockOnSubmit}
        onSSOInitiate={mockOnSSOInitiate}
      />
    );

    // Select a tenant
    const tenantInput = screen.getByRole('combobox');
    await user.type(tenantInput, 'Test');
    await waitFor(() => {
      expect(screen.getByText('Test University')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Test University'));

    // Enter email and password
    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');

    // First failed attempt
    const submitButton = screen.getByRole('button', { name: /sign in to your account/i });
    await user.click(submitButton);
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });

    // Second failed attempt
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledTimes(2);
    });

    // CAPTCHA should not be visible yet
    expect(screen.queryByTestId('recaptcha-mock')).not.toBeInTheDocument();
  });

  /**
   * Task 7.7: CAPTCHA appears immediately on 3rd attempt
   * Validates: Requirement 7.1
   */
  it('should display CAPTCHA immediately when 3rd attempt fails', async () => {
    const mockOnSubmit = vi.fn().mockRejectedValue(new Error('Invalid credentials'));
    const mockOnSuccess = vi.fn();
    const mockOnMFARequired = vi.fn();
    const mockOnSSOInitiate = vi.fn();

    const user = userEvent.setup();

    renderWithRouter(
      <LoginForm
        onSuccess={mockOnSuccess}
        onMFARequired={mockOnMFARequired}
        onSubmit={mockOnSubmit}
        onSSOInitiate={mockOnSSOInitiate}
      />
    );

    // Select a tenant
    const tenantInput = screen.getByRole('combobox');
    await user.type(tenantInput, 'Test');
    await waitFor(() => {
      expect(screen.getByText('Test University')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Test University'));

    // Enter email and password
    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    await user.type(emailInput, 'test@example.com');

    const submitButton = screen.getByRole('button', { name: /sign in to your account/i });

    // Perform 3 failed attempts
    for (let i = 0; i < 3; i++) {
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(i + 1);
      });
    }

    // CAPTCHA should be visible after 3rd attempt
    await waitFor(() => {
      expect(screen.getByTestId('recaptcha-mock')).toBeInTheDocument();
    });
  });
});
