import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingIndicator, ButtonLoadingIndicator, InlineLoadingIndicator } from './LoadingIndicator';

describe('LoadingIndicator', () => {
  it('renders loading spinner', () => {
    const { container } = render(<LoadingIndicator />);

    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('renders with small size', () => {
    const { container } = render(<LoadingIndicator size="sm" />);

    const spinner = container.querySelector('.w-4');
    expect(spinner).toBeInTheDocument();
  });

  it('renders with medium size', () => {
    const { container } = render(<LoadingIndicator size="md" />);

    const spinner = container.querySelector('.w-6');
    expect(spinner).toBeInTheDocument();
  });

  it('renders with large size', () => {
    const { container } = render(<LoadingIndicator size="lg" />);

    const spinner = container.querySelector('.w-8');
    expect(spinner).toBeInTheDocument();
  });
});

describe('ButtonLoadingIndicator', () => {
  it('renders button loading spinner', () => {
    const { container } = render(<ButtonLoadingIndicator />);

    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('renders spinner inside button context', () => {
    const { container } = render(<ButtonLoadingIndicator />);

    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });
});

describe('InlineLoadingIndicator', () => {
  it('renders inline loading spinner', () => {
    const { container } = render(<InlineLoadingIndicator />);

    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('renders small spinner for inline use', () => {
    const { container } = render(<InlineLoadingIndicator />);

    const spinner = container.querySelector('.w-4');
    expect(spinner).toBeInTheDocument();
  });
});
