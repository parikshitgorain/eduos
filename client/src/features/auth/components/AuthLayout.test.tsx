import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthLayout } from './AuthLayout';

describe('AuthLayout', () => {
  it('renders children content', () => {
    render(
      <AuthLayout title="Test Title">
        <div>Test Content</div>
      </AuthLayout>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('displays title', () => {
    render(
      <AuthLayout title="Login">
        <div>Content</div>
      </AuthLayout>
    );

    expect(screen.getByText('Login')).toBeInTheDocument();
  });

  it('displays subtitle when provided', () => {
    render(
      <AuthLayout title="Login" subtitle="Welcome back">
        <div>Content</div>
      </AuthLayout>
    );

    expect(screen.getByText('Welcome back')).toBeInTheDocument();
  });

  it('does not display subtitle when not provided', () => {
    render(
      <AuthLayout title="Login">
        <div>Content</div>
      </AuthLayout>
    );

    expect(screen.queryByText('Welcome back')).not.toBeInTheDocument();
  });

  it('displays EduOS logo', () => {
    render(
      <AuthLayout title="Login">
        <div>Content</div>
      </AuthLayout>
    );

    expect(screen.getByText('EduOS')).toBeInTheDocument();
  });

  it('displays footer with links', () => {
    render(
      <AuthLayout title="Login">
        <div>Content</div>
      </AuthLayout>
    );

    expect(screen.getByText(/terms of service/i)).toBeInTheDocument();
    expect(screen.getByText(/privacy policy/i)).toBeInTheDocument();
    expect(screen.getByText(/© \d{4} EduOS/)).toBeInTheDocument();
  });

  it('applies responsive layout classes', () => {
    const { container } = render(
      <AuthLayout title="Login">
        <div>Content</div>
      </AuthLayout>
    );

    // Check for responsive wrapper classes
    const wrapper = container.querySelector('.max-w-\\[480px\\]');
    expect(wrapper).toBeInTheDocument();
  });

  it('applies card styling', () => {
    const { container } = render(
      <AuthLayout title="Login">
        <div>Content</div>
      </AuthLayout>
    );

    // Check for card styling classes
    const card = container.querySelector('.bg-white.rounded-lg.shadow-md');
    expect(card).toBeInTheDocument();
  });
});
