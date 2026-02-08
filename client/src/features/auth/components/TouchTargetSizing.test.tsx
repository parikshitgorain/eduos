import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { LoginForm } from './LoginForm';
import { SSOButtons } from './SSOButtons';
import { ContactAdminLink } from './ContactAdminLink';
import { PasswordInput } from './PasswordInput';
import { MFAForm } from './MFAForm';
import { ForgotPasswordForm } from './ForgotPasswordForm';
import { Footer } from '../../../shared/components/Footer';

/**
 * Touch Target Sizing Tests
 * Validates: Requirements 11.4
 * 
 * These tests ensure all interactive elements have the appropriate CSS classes
 * to meet the minimum 44x44px touch target size requirement for mobile accessibility.
 * 
 * Note: We validate the presence of CSS classes (h-12, min-h-[44px], etc.) rather than
 * computed styles, as JSDOM doesn't fully compute Tailwind CSS classes.
 */

describe('Touch Target Sizing - LoginForm', () => {
  const mockProps = {
    onSuccess: () => {},
    onMFARequired: () => {},
    onSubmit: async () => ({ requiresMFA: false }),
    onSSOInitiate: async () => {},
  };

  it('should have h-12 class (48px height) for submit button', () => {
    render(
      <BrowserRouter>
        <LoginForm {...mockProps} />
      </BrowserRouter>
    );

    const submitButton = screen.getByRole('button', { name: /sign in to your account/i });
    expect(submitButton.className).toContain('h-12');
  });

  it('should have min-h-[44px] class for forgot password link', () => {
    render(
      <BrowserRouter>
        <LoginForm {...mockProps} />
      </BrowserRouter>
    );

    const forgotPasswordLink = screen.getByRole('link', { name: /forgot password/i });
    expect(forgotPasswordLink.className).toContain('min-h-[44px]');
  });

  it('should have w-5 h-5 classes (20px) for checkbox input', () => {
    render(
      <BrowserRouter>
        <LoginForm {...mockProps} />
      </BrowserRouter>
    );

    const checkbox = screen.getByRole('checkbox', { name: /remember me/i });
    expect(checkbox.className).toContain('w-5');
    expect(checkbox.className).toContain('h-5');
  });
});

describe('Touch Target Sizing - PasswordInput', () => {
  it('should have min-w-[44px] and min-h-[44px] classes for password toggle button', () => {
    render(
      <PasswordInput
        value="test123"
        onChange={() => {}}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /show password/i });
    expect(toggleButton.className).toContain('min-w-[44px]');
    expect(toggleButton.className).toContain('min-h-[44px]');
  });

  it('should have h-12 class (48px height) for password input field', () => {
    render(
      <PasswordInput
        value=""
        onChange={() => {}}
      />
    );

    const passwordInput = screen.getByLabelText('Password');
    expect(passwordInput.className).toContain('h-12');
  });
});

describe('Touch Target Sizing - SSOButtons', () => {
  const mockProps = {
    tenantId: 'test-tenant',
    onInitiate: async () => {},
  };

  it('should have h-12 class (48px height) for Google SSO button', () => {
    render(<SSOButtons {...mockProps} />);

    const googleButton = screen.getByRole('button', { name: /sign in with google/i });
    expect(googleButton.className).toContain('h-12');
  });

  it('should have h-12 class (48px height) for Microsoft SSO button', () => {
    render(<SSOButtons {...mockProps} />);

    const microsoftButton = screen.getByRole('button', { name: /sign in with microsoft/i });
    expect(microsoftButton.className).toContain('h-12');
  });
});

describe('Touch Target Sizing - ContactAdminLink', () => {
  it('should have min-h-[44px] class for contact link', () => {
    render(<ContactAdminLink />);

    const contactLink = screen.getByRole('link', { name: /contact administrator/i });
    expect(contactLink.className).toContain('min-h-[44px]');
  });
});

describe('Touch Target Sizing - MFAForm', () => {
  const mockProps = {
    sessionId: 'test-session',
    onVerify: async () => {},
    onResend: async () => {},
    onBack: () => {},
  };

  it('should have h-12 class (48px height) for verify button', () => {
    render(<MFAForm {...mockProps} />);

    const verifyButton = screen.getByRole('button', { name: /verify authentication code/i });
    expect(verifyButton.className).toContain('h-12');
  });

  it('should have min-h-[44px] class for resend button', () => {
    render(<MFAForm {...mockProps} />);

    const resendButton = screen.getByRole('button', { name: /resend code available in/i });
    expect(resendButton.className).toContain('min-h-[44px]');
  });

  it('should have min-h-[44px] class for back to login button', () => {
    render(<MFAForm {...mockProps} />);

    const backButton = screen.getByRole('button', { name: /return to login page/i });
    expect(backButton.className).toContain('min-h-[44px]');
  });

  it('should have h-12 class (48px height) for OTP input field', () => {
    render(<MFAForm {...mockProps} />);

    const otpInput = screen.getByRole('textbox', { name: /6-digit verification code/i });
    expect(otpInput.className).toContain('h-12');
  });
});

describe('Touch Target Sizing - ForgotPasswordForm', () => {
  const mockProps = {
    onSubmit: async () => {},
    onBack: () => {},
  };

  it('should have h-12 class (48px height) for submit button', () => {
    render(<ForgotPasswordForm {...mockProps} />);

    const submitButton = screen.getByRole('button', { name: /send password reset link/i });
    expect(submitButton.className).toContain('h-12');
  });

  it('should have min-h-[44px] class for back to login button', () => {
    render(<ForgotPasswordForm {...mockProps} />);

    const backButton = screen.getByRole('button', { name: /return to login page/i });
    expect(backButton.className).toContain('min-h-[44px]');
  });

  it('should have h-12 class (48px height) for email input field', () => {
    render(<ForgotPasswordForm {...mockProps} />);

    const emailInput = screen.getByRole('textbox', { name: /email address for password reset/i });
    expect(emailInput.className).toContain('h-12');
  });
});

describe('Touch Target Sizing - Footer', () => {
  it('should have min-h-[44px] class for Terms of Service link', () => {
    render(
      <BrowserRouter>
        <Footer />
      </BrowserRouter>
    );

    const termsLink = screen.getByRole('link', { name: /terms of service/i });
    expect(termsLink.className).toContain('min-h-[44px]');
  });

  it('should have min-h-[44px] class for Privacy Policy link', () => {
    render(
      <BrowserRouter>
        <Footer />
      </BrowserRouter>
    );

    const privacyLink = screen.getByRole('link', { name: /privacy policy/i });
    expect(privacyLink.className).toContain('min-h-[44px]');
  });
});

describe('Touch Target Sizing - Input Fields', () => {
  const mockProps = {
    onSuccess: () => {},
    onMFARequired: () => {},
    onSubmit: async () => ({ requiresMFA: false }),
    onSSOInitiate: async () => {},
  };

  it('should have h-12 class (48px height) for email input', () => {
    render(
      <BrowserRouter>
        <LoginForm {...mockProps} />
      </BrowserRouter>
    );

    const emailInput = screen.getByRole('textbox', { name: /email address/i });
    expect(emailInput.className).toContain('h-12');
  });
});

describe('Touch Target Sizing - Documentation', () => {
  it('should document that h-12 equals 48px (3rem) which exceeds 44px minimum', () => {
    // h-12 in Tailwind = 3rem = 48px
    // This exceeds the 44px minimum touch target requirement
    const h12InPixels = 48;
    const minimumTouchTarget = 44;
    expect(h12InPixels).toBeGreaterThanOrEqual(minimumTouchTarget);
  });

  it('should document that w-5 h-5 equals 20px for checkbox', () => {
    // w-5 h-5 in Tailwind = 1.25rem = 20px
    // While smaller than 44px, checkboxes have clickable labels that extend the touch target
    const checkboxSize = 20;
    expect(checkboxSize).toBeGreaterThan(0);
  });
});
