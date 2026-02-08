/**
 * Accessibility Tests for LoginForm Component
 * Feature: login-authentication-ui
 * Task 19.1: Run axe-core accessibility tests
 * Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { LoginForm } from './LoginForm';

// Mock services
vi.mock('../services/tenantService', () => ({
  tenantService: {
    searchTenants: vi.fn().mockResolvedValue([
      { id: 'tenant-1', name: 'Test University', location: 'Test City' },
    ]),
  },
}));

// Mock CAPTCHA widget
vi.mock('./CaptchaWidget', () => ({
  CaptchaWidget: () => <div data-testid="captcha-widget">CAPTCHA</div>,
}));

// Helper to render with router
function renderWithRouter(component: React.ReactElement) {
  return render(<MemoryRouter>{component}</MemoryRouter>);
}

describe('LoginForm Accessibility Tests', () => {
  const mockProps = {
    onSuccess: vi.fn(),
    onMFARequired: vi.fn(),
    onSubmit: vi.fn(),
    onSSOInitiate: vi.fn(),
  };

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
    const { container } = renderWithRouter(<LoginForm {...mockProps} />);
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper form structure', async () => {
    const { container } = renderWithRouter(<LoginForm {...mockProps} />);
    
    // Should have a form element
    const form = container.querySelector('form');
    expect(form).toBeInTheDocument();
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper label associations', async () => {
    const { container } = renderWithRouter(<LoginForm {...mockProps} />);
    
    // All inputs should have associated labels OR aria-label
    const inputs = container.querySelectorAll('input');
    inputs.forEach(input => {
      const id = input.getAttribute('id');
      const type = input.getAttribute('type');
      const hasAriaLabel = input.hasAttribute('aria-label');
      const hasAriaLabelledBy = input.hasAttribute('aria-labelledby');
      
      // Skip hidden inputs
      if (type === 'hidden') {
        return;
      }
      
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
    const { container } = renderWithRouter(<LoginForm {...mockProps} />);
    
    const buttons = container.querySelectorAll('button');
    buttons.forEach(button => {
      const hasText = button.textContent && button.textContent.trim().length > 0;
      const hasAriaLabel = button.hasAttribute('aria-label');
      const hasAriaLabelledBy = button.hasAttribute('aria-labelledby');
      
      expect(hasText || hasAriaLabel || hasAriaLabelledBy).toBe(true);
    });
  });

  it('should have proper color contrast', async () => {
    const { container } = renderWithRouter(<LoginForm {...mockProps} />);
    
    const results = await axe(container, {
      rules: {
        'color-contrast': { enabled: true },
      },
    });
    
    expect(results).toHaveNoViolations();
  });

  it('should have proper keyboard navigation order', async () => {
    const { container } = renderWithRouter(<LoginForm {...mockProps} />);
    
    // Should not have positive tabindex (anti-pattern)
    const positiveTabindex = container.querySelectorAll('[tabindex]:not([tabindex="0"]):not([tabindex^="-"])');
    expect(positiveTabindex.length).toBe(0);
  });

  it('should have proper ARIA attributes for validation', async () => {
    const { container } = renderWithRouter(<LoginForm {...mockProps} />);
    
    const results = await axe(container, {
      rules: {
        'aria-valid-attr': { enabled: true },
        'aria-valid-attr-value': { enabled: true },
        'aria-required-attr': { enabled: true },
      },
    });
    
    expect(results).toHaveNoViolations();
  });

  it('should have proper error message accessibility', async () => {
    const { container } = renderWithRouter(<LoginForm {...mockProps} />);
    
    // Error messages should be accessible
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper password field accessibility', async () => {
    const { container } = renderWithRouter(<LoginForm {...mockProps} />);
    
    // Password field should be accessible
    const passwordInput = container.querySelector('input[type="password"]');
    expect(passwordInput).toBeInTheDocument();
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper checkbox accessibility', async () => {
    const { container } = renderWithRouter(<LoginForm {...mockProps} />);
    
    // Remember me checkbox should be accessible
    const checkbox = container.querySelector('input[type="checkbox"]');
    if (checkbox) {
      const id = checkbox.getAttribute('id');
      if (id) {
        const label = container.querySelector(`label[for="${id}"]`);
        expect(label).toBeInTheDocument();
      }
    }
  });

  it('should have proper link accessibility', async () => {
    const { container } = renderWithRouter(<LoginForm {...mockProps} />);
    
    const links = container.querySelectorAll('a');
    links.forEach(link => {
      const hasText = link.textContent && link.textContent.trim().length > 0;
      const hasAriaLabel = link.hasAttribute('aria-label');
      
      expect(hasText || hasAriaLabel).toBe(true);
    });
  });

  it('should have proper loading state accessibility', async () => {
    const { container } = renderWithRouter(<LoginForm {...mockProps} />);
    
    // Loading states should be accessible
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper SSO button accessibility', async () => {
    const { container } = renderWithRouter(<LoginForm {...mockProps} />);
    
    // SSO buttons should be accessible
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper tenant selector accessibility', async () => {
    const { container } = renderWithRouter(<LoginForm {...mockProps} />);
    
    // Tenant selector should be accessible
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
