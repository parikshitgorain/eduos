import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SSOButtons } from './SSOButtons';

describe('SSOButtons', () => {
  it('renders Google and Microsoft SSO buttons', () => {
    const mockOnInitiate = vi.fn();
    
    render(
      <SSOButtons
        tenantId="tenant-123"
        onInitiate={mockOnInitiate}
      />
    );

    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in with microsoft/i })).toBeInTheDocument();
  });

  it('disables buttons when no tenant is selected', () => {
    const mockOnInitiate = vi.fn();
    
    render(
      <SSOButtons
        tenantId=""
        onInitiate={mockOnInitiate}
      />
    );

    const googleButton = screen.getByRole('button', { name: /sign in with google/i });
    const microsoftButton = screen.getByRole('button', { name: /sign in with microsoft/i });

    expect(googleButton).toBeDisabled();
    expect(microsoftButton).toBeDisabled();
  });

  it('calls onInitiate with correct provider when Google button is clicked', async () => {
    const user = userEvent.setup();
    const mockOnInitiate = vi.fn().mockResolvedValue(undefined);
    
    render(
      <SSOButtons
        tenantId="tenant-123"
        onInitiate={mockOnInitiate}
      />
    );

    const googleButton = screen.getByRole('button', { name: /sign in with google/i });
    await user.click(googleButton);

    expect(mockOnInitiate).toHaveBeenCalledWith('google');
  });

  it('calls onInitiate with correct provider when Microsoft button is clicked', async () => {
    const user = userEvent.setup();
    const mockOnInitiate = vi.fn().mockResolvedValue(undefined);
    
    render(
      <SSOButtons
        tenantId="tenant-123"
        onInitiate={mockOnInitiate}
      />
    );

    const microsoftButton = screen.getByRole('button', { name: /sign in with microsoft/i });
    await user.click(microsoftButton);

    expect(mockOnInitiate).toHaveBeenCalledWith('microsoft');
  });

  it('disables buttons when disabled prop is true', () => {
    const mockOnInitiate = vi.fn();
    
    render(
      <SSOButtons
        tenantId="tenant-123"
        onInitiate={mockOnInitiate}
        disabled={true}
      />
    );

    const googleButton = screen.getByRole('button', { name: /sign in with google/i });
    const microsoftButton = screen.getByRole('button', { name: /sign in with microsoft/i });

    expect(googleButton).toBeDisabled();
    expect(microsoftButton).toBeDisabled();
  });

  it('disables buttons when isLoading is true', () => {
    const mockOnInitiate = vi.fn();
    
    render(
      <SSOButtons
        tenantId="tenant-123"
        onInitiate={mockOnInitiate}
        isLoading={true}
      />
    );

    const googleButton = screen.getByRole('button', { name: /sign in with google/i });
    const microsoftButton = screen.getByRole('button', { name: /sign in with microsoft/i });

    expect(googleButton).toBeDisabled();
    expect(microsoftButton).toBeDisabled();
  });

  it('does not call onInitiate when button is disabled', async () => {
    const user = userEvent.setup();
    const mockOnInitiate = vi.fn();
    
    render(
      <SSOButtons
        tenantId=""
        onInitiate={mockOnInitiate}
      />
    );

    const googleButton = screen.getByRole('button', { name: /sign in with google/i });
    await user.click(googleButton);

    expect(mockOnInitiate).not.toHaveBeenCalled();
  });
});
