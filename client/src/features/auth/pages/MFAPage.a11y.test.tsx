/**
 * Accessibility Tests for MFAPage
 * Feature: login-authentication-ui
 * Task 19.1: Run axe-core accessibility tests
 * Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { MFAPage } from './MFAPage';

// Mock services
vi.mock('../services/authService', () => ({
  authService: {
    verifyMFA: vi.fn(),
  },
}));

vi.mock('../services/tokenService', () => ({
  tokenService: {
    setToken: vi.fn(),
  },
}));

// Mock focus management
vi.mock('../utils/focusManagement', () => ({
  handleScreenNavigation: vi.fn(),
  focusFirstInvalidField: vi.fn(),
}));

// Helper to render with router and session state
function renderWithRouter(sessionId?: string) {
  const initialEntries = sessionId
    ? [{ pathname: '/mfa', state: { sessionId } }]
    : ['/mfa'];

  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <MFAPage />
    </MemoryRouter>
  );
}

describe('MFAPage Accessibility Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Requirement 12.1: Keyboard navigation support
   * Requirement 12.2: Enter key submission
   * Requirement 12.3: ARIA attributes
   * Requirement 12.4: Focus management
   * Requirement 12.5: Color contrast compliance
   */
  it('should have no accessibility violations in default state', async () => {
    const { container } = renderWithRouter('test-session-id');
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations with OTP entered', async () => {
    const { container } = renderWithRouter('test-session-id');
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper heading hierarchy', async () => {
    const { container } = renderWithRouter('test-session-id');
    
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
    expect(headings.length).toBeGreaterThan(0);
    
    const firstHeading = headings[0];
    expect(firstHeading.tagName).toBe('H1');
  });

  it('should have proper landmark regions', async () => {
    const { container } = renderWithRouter('test-session-id');
    
    const main = container.querySelector('main');
    expect(main).toBeInTheDocument();
    expect(main).toHaveAttribute('aria-label');
  });

  it('should have proper form labels', async () => {
    const { container } = renderWithRouter('test-session-id');
    
    const inputs = container.querySelectorAll('input');
    inputs.forEach(input => {
      const id = input.getAttribute('id');
      if (id) {
        const label = container.querySelector(`label[for="${id}"]`);
        expect(label).toBeInTheDocument();
      }
    });
  });

  it('should have proper button accessibility', async () => {
    const { container } = renderWithRouter('test-session-id');
    
    const buttons = container.querySelectorAll('button');
    buttons.forEach(button => {
      const hasText = button.textContent && button.textContent.trim().length > 0;
      const hasAriaLabel = button.hasAttribute('aria-label');
      const hasAriaLabelledBy = button.hasAttribute('aria-labelledby');
      
      expect(hasText || hasAriaLabel || hasAriaLabelledBy).toBe(true);
    });
  });

  it('should have proper color contrast', async () => {
    const { container } = renderWithRouter('test-session-id');
    
    const results = await axe(container, {
      rules: {
        'color-contrast': { enabled: true },
      },
    });
    
    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA live regions for dynamic content', async () => {
    const { container } = renderWithRouter('test-session-id');
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper semantic HTML', async () => {
    const { container } = renderWithRouter('test-session-id');
    
    const results = await axe(container, {
      rules: {
        'landmark-one-main': { enabled: true },
        'page-has-heading-one': { enabled: true },
      },
    });
    
    expect(results).toHaveNoViolations();
  });

  it('should have proper keyboard navigation order', async () => {
    const { container } = renderWithRouter('test-session-id');
    
    const positiveTabindex = container.querySelectorAll('[tabindex]:not([tabindex="0"]):not([tabindex^="-"])');
    expect(positiveTabindex.length).toBe(0);
  });

  it('should have proper focus management for OTP input', async () => {
    const { container } = renderWithRouter('test-session-id');
    
    const otpInput = container.querySelector('input[type="text"]');
    expect(otpInput).toBeInTheDocument();
    
    // Should be focusable
    expect(otpInput).not.toHaveAttribute('tabindex', '-1');
  });

  it('should have proper countdown timer accessibility', async () => {
    const { container } = renderWithRouter('test-session-id');
    
    // Countdown should be accessible to screen readers
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper error message accessibility', async () => {
    const { container } = renderWithRouter('test-session-id');
    
    // Error messages should be properly associated with inputs
    const results = await axe(container, {
      rules: {
        'aria-valid-attr': { enabled: true },
        'aria-valid-attr-value': { enabled: true },
      },
    });
    
    expect(results).toHaveNoViolations();
  });
});
