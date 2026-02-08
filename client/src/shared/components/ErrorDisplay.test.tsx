import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorDisplay } from './ErrorDisplay';

describe('ErrorDisplay', () => {
  it('renders error message', () => {
    render(<ErrorDisplay message="This is an error" />);

    expect(screen.getByText(/this is an error/i)).toBeInTheDocument();
  });

  it('does not render when message is empty', () => {
    const { container } = render(<ErrorDisplay message="" />);

    expect(container.firstChild).toBeNull();
  });

  it('has aria-live region for screen readers', () => {
    render(<ErrorDisplay message="Error occurred" />);

    const errorElement = screen.getByText(/error occurred/i).closest('div');
    expect(errorElement).toHaveAttribute('aria-live', 'polite');
  });

  it('has error role for accessibility', () => {
    render(<ErrorDisplay message="Error occurred" />);

    const errorElement = screen.getByText(/error occurred/i).closest('div');
    expect(errorElement).toHaveAttribute('role', 'alert');
  });
});
