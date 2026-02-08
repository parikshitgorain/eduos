import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoginForm } from './LoginForm';

// Mock the services
vi.mock('../services/tenantService', () => ({
  searchTenants: vi.fn().mockResolvedValue([]),
}));

const mockOnSuccess = vi.fn();
const mockOnMFARequired = vi.fn();
const mockOnSubmit = vi.fn().mockResolvedValue({ requiresMFA: false });
const mockOnSSOInitiate = vi.fn().mockResolvedValue(undefined);

describe('LoginForm', () => {
  it('renders login form with all required fields', () => {
    render(
      <LoginForm
        onSuccess={mockOnSuccess}
        onMFARequired={mockOnMFARequired}
        onSubmit={mockOnSubmit}
        onSSOInitiate={mockOnSSOInitiate}
      />
    );

    expect(screen.getByLabelText(/institution/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
  });

  it('renders remember me checkbox', () => {
    render(
      <LoginForm
        onSuccess={mockOnSuccess}
        onMFARequired={mockOnMFARequired}
        onSubmit={mockOnSubmit}
        onSSOInitiate={mockOnSSOInitiate}
      />
    );

    expect(screen.getByLabelText(/remember me/i)).toBeInTheDocument();
  });

  it('renders forgot password link', () => {
    render(
      <LoginForm
        onSuccess={mockOnSuccess}
        onMFARequired={mockOnMFARequired}
        onSubmit={mockOnSubmit}
        onSSOInitiate={mockOnSSOInitiate}
      />
    );

    expect(screen.getByText(/forgot password/i)).toBeInTheDocument();
  });

  it('renders contact administrator link', () => {
    render(
      <LoginForm
        onSuccess={mockOnSuccess}
        onMFARequired={mockOnMFARequired}
        onSubmit={mockOnSubmit}
        onSSOInitiate={mockOnSSOInitiate}
      />
    );

    expect(screen.getByText(/contact administrator/i)).toBeInTheDocument();
  });
});
