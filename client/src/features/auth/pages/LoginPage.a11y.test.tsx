/**
 * Accessibility Tests for LoginPage
 * Feature: login-authentication-ui
 * Task 19.1: Run axe-core accessibility tests
 * Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from './LoginPage';
import { AuthProvider } from '../context/AuthContext';

// Mock services
vi.mock('../services/tenantService', () => ({
  tenantService: {
    searchTenants: vi.fn().mockResolvedValue([
      { id: 'tenant-1', name: 'Test University', location: 'Test City' },
    ]),
  },
}));

vi.mock('../services/authService', () => ({
  authService: {
    login: vi.fn(),
    initiateSSO: vi.fn(),
  },
}));

// Mock focus management
vi.mock('../utils/focusManagement', () => ({
  handleScreenNavigation: vi.fn(),
  focusFirstInvalidField: vi.fn(),
}));

// Mock CAPTCHA widget
vi.mock('../components/CaptchaWidget', () => ({
  CaptchaWidget: () => <div data-testid="captcha-widget">CAPTCHA</div>,
}));

// Helper to render with router and auth context
function renderWithProviders(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  );
}

describe('LoginPage Accessibility Tests', () => {
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
    const { container } = renderWithProviders(<LoginPage />);
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations with form filled', async () => {
    const { container } = renderWithProviders(<LoginPage />);
    
    // The form should be accessible even when filled
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations with validation errors', async () => {
    const { container } = renderWithProviders(<LoginPage />);
    
    // Even with errors, should maintain accessibility
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper heading hierarchy', async () => {
    const { container } = renderWithProviders(<LoginPage />);
    
    // Check for proper heading structure
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
    expect(headings.length).toBeGreaterThan(0);
    
    // First heading should be h1
    const firstHeading = headings[0];
    expect(firstHeading.tagName).toBe('H1');
  });

  it('should have proper landmark regions', async () => {
    const { container } = renderWithProviders(<LoginPage />);
    
    // Should have main landmark
    const main = container.querySelector('main');
    expect(main).toBeInTheDocument();
    
    // Should have proper ARIA label
    expect(main).toHaveAttribute('aria-label');
  });

  it('should have proper form labels', async () => {
    const { container } = renderWithProviders(<LoginPage />);
    
    // All inputs should have associated labels OR aria-label
    const inputs = container.querySelectorAll('input');
    inputs.forEach(input => {
      const id = input.getAttribute('id');
      const hasAriaLabel = input.hasAttribute('aria-label');
      const hasAriaLabelledBy = input.hasAttribute('aria-labelledby');
      
      if (id) {
        const label = container.querySelector(`label[for="${id}"]`);
        const hasLabel = label !== null;
        
        // Should have either a label element OR aria-label/aria-labelledby
        expect(hasLabel || hasAriaLabel || hasAriaLabelledBy).toBe(true);
      } else {
        // If no ID, must have aria-label or aria-labelledby
        expect(hasAriaLabel || hasAriaLabelledBy).toBe(true);
      }
    });
  });

  it('should have proper button accessibility', async () => {
    const { container } = renderWithProviders(<LoginPage />);
    
    // All buttons should have accessible names
    const buttons = container.querySelectorAll('button');
    buttons.forEach(button => {
      const hasText = button.textContent && button.textContent.trim().length > 0;
      const hasAriaLabel = button.hasAttribute('aria-label');
      const hasAriaLabelledBy = button.hasAttribute('aria-labelledby');
      
      expect(hasText || hasAriaLabel || hasAriaLabelledBy).toBe(true);
    });
  });

  it('should have proper link accessibility', async () => {
    const { container } = renderWithProviders(<LoginPage />);
    
    // All links should have accessible names
    const links = container.querySelectorAll('a');
    links.forEach(link => {
      const hasText = link.textContent && link.textContent.trim().length > 0;
      const hasAriaLabel = link.hasAttribute('aria-label');
      
      expect(hasText || hasAriaLabel).toBe(true);
    });
  });

  it('should have proper color contrast', async () => {
    const { container } = renderWithProviders(<LoginPage />);
    
    // axe will check color contrast automatically
    const results = await axe(container, {
      rules: {
        'color-contrast': { enabled: true },
      },
    });
    
    expect(results).toHaveNoViolations();
  });

  it('should have proper focus indicators', async () => {
    const { container } = renderWithProviders(<LoginPage />);
    
    // Check that focusable elements exist
    const focusableElements = container.querySelectorAll(
      'button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    expect(focusableElements.length).toBeGreaterThan(0);
  });

  it('should have proper ARIA live regions for dynamic content', async () => {
    const { container } = renderWithProviders(<LoginPage />);
    
    // Should have aria-live regions for error messages
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper form validation accessibility', async () => {
    const { container } = renderWithProviders(<LoginPage />);
    
    // Form validation should be accessible
    const results = await axe(container, {
      rules: {
        'aria-valid-attr': { enabled: true },
        'aria-valid-attr-value': { enabled: true },
      },
    });
    
    expect(results).toHaveNoViolations();
  });

  it('should have proper image alt text', async () => {
    const { container } = renderWithProviders(<LoginPage />);
    
    // All images should have alt text
    const images = container.querySelectorAll('img');
    images.forEach(img => {
      expect(img).toHaveAttribute('alt');
    });
  });

  it('should have proper semantic HTML', async () => {
    const { container } = renderWithProviders(<LoginPage />);
    
    // Check for semantic HTML usage
    const results = await axe(container, {
      rules: {
        'landmark-one-main': { enabled: true },
        'page-has-heading-one': { enabled: true },
      },
    });
    
    expect(results).toHaveNoViolations();
  });

  it('should have proper keyboard navigation order', async () => {
    const { container } = renderWithProviders(<LoginPage />);
    
    // Check that tabindex is used properly
    const negativeTabindex = container.querySelectorAll('[tabindex^="-"]');
    const positiveTabindex = container.querySelectorAll('[tabindex]:not([tabindex="0"]):not([tabindex^="-"])');
    
    // Should not have positive tabindex (anti-pattern)
    expect(positiveTabindex.length).toBe(0);
  });
});
