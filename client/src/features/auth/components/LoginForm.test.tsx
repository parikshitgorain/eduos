import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginForm } from './LoginForm';

// Mock the services
vi.mock('../services/tenantService', () => ({
  searchTenants: vi.fn().mockResolvedValue([
    { id: 'tenant-1', name: 'Test University', location: 'Test City' },
  ]),
}));

// Mock react-google-recaptcha
vi.mock('react-google-recaptcha', () => ({
  default: vi.fn(({ onChange }) => (
    <div data-testid="recaptcha-mock">
      <button onClick={() => onChange('mock-captcha-token')}>Complete CAPTCHA</button>
    </div>
  )),
}));

const mockOnSuccess = vi.fn();
const mockOnMFARequired = vi.fn();
const mockOnSubmit = vi.fn().mockResolvedValue({ requiresMFA: false });
const mockOnSSOInitiate = vi.fn().mockResolvedValue(undefined);

// Helper to render with router
const renderWithRouter = (component: React.ReactElement) => {
  return render(<MemoryRouter>{component}</MemoryRouter>);
};

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form with all required fields', () => {
    renderWithRouter(
      <LoginForm
        onSuccess={mockOnSuccess}
        onMFARequired={mockOnMFARequired}
        onSubmit={mockOnSubmit}
        onSSOInitiate={mockOnSSOInitiate}
      />
    );

    expect(screen.getByLabelText(/institution/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in to your account/i })).toBeInTheDocument();
  });

  it('renders remember me checkbox', () => {
    renderWithRouter(
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
    renderWithRouter(
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
    renderWithRouter(
      <LoginForm
        onSuccess={mockOnSuccess}
        onMFARequired={mockOnMFARequired}
        onSubmit={mockOnSubmit}
        onSSOInitiate={mockOnSSOInitiate}
      />
    );

    expect(screen.getByText(/contact administrator/i)).toBeInTheDocument();
  });

  it('does not show CAPTCHA initially', () => {
    renderWithRouter(
      <LoginForm
        onSuccess={mockOnSuccess}
        onMFARequired={mockOnMFARequired}
        onSubmit={mockOnSubmit}
        onSSOInitiate={mockOnSSOInitiate}
      />
    );

    expect(screen.queryByTestId('recaptcha-mock')).not.toBeInTheDocument();
  });
});
