import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from './Footer';

describe('Footer', () => {
  it('renders Terms of Service link', () => {
    render(<Footer />);
    
    const termsLink = screen.getByText(/terms of service/i);
    expect(termsLink).toBeInTheDocument();
    expect(termsLink).toHaveAttribute('href', '/terms');
  });

  it('renders Privacy Policy link', () => {
    render(<Footer />);
    
    const privacyLink = screen.getByText(/privacy policy/i);
    expect(privacyLink).toBeInTheDocument();
    expect(privacyLink).toHaveAttribute('href', '/privacy');
  });

  it('displays copyright with current year', () => {
    render(<Footer />);
    
    const currentYear = new Date().getFullYear();
    expect(screen.getByText(new RegExp(`© ${currentYear} EduOS`))).toBeInTheDocument();
  });

  it('displays separator between links', () => {
    render(<Footer />);
    
    expect(screen.getByText('•')).toBeInTheDocument();
  });
});
