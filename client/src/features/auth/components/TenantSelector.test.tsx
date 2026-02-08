import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TenantSelector } from './TenantSelector';

vi.mock('../services/tenantService', () => ({
  searchTenants: vi.fn().mockResolvedValue([]),
}));

describe('TenantSelector', () => {
  it('renders tenant selector', () => {
    const { container } = render(
      <TenantSelector
        value=""
        onChange={() => {}}
      />
    );

    const input = container.querySelector('input');
    expect(input).toBeInTheDocument();
  });

  it('displays search placeholder', () => {
    render(
      <TenantSelector
        value=""
        onChange={() => {}}
      />
    );

    expect(screen.getByPlaceholderText(/institution id or name/i)).toBeInTheDocument();
  });

  it('displays error message when provided', () => {
    render(
      <TenantSelector
        value=""
        onChange={() => {}}
        error="Institution is required"
      />
    );

    expect(screen.getByText(/institution is required/i)).toBeInTheDocument();
  });
});
