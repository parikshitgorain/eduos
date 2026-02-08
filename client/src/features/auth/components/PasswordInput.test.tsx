import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PasswordInput } from './PasswordInput';

describe('PasswordInput', () => {
  it('renders password input field', () => {
    const { container } = render(
      <PasswordInput
        value=""
        onChange={() => {}}
      />
    );

    const input = container.querySelector('input[type="password"]');
    expect(input).toBeInTheDocument();
  });

  it('masks password by default', () => {
    const { container } = render(
      <PasswordInput
        value="secret123"
        onChange={() => {}}
      />
    );

    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.type).toBe('password');
  });

  it('toggles password visibility when eye icon is clicked', () => {
    const { container } = render(
      <PasswordInput
        value="secret123"
        onChange={() => {}}
      />
    );

    const input = container.querySelector('input') as HTMLInputElement;
    const toggleButton = screen.getByRole('button');

    expect(input.type).toBe('password');

    fireEvent.click(toggleButton);
    expect(input.type).toBe('text');

    fireEvent.click(toggleButton);
    expect(input.type).toBe('password');
  });

  it('displays error message when provided', () => {
    render(
      <PasswordInput
        value=""
        onChange={() => {}}
        error="Password is required"
      />
    );

    expect(screen.getByText(/password is required/i)).toBeInTheDocument();
  });
});
