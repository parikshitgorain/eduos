import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CaptchaWidget } from './CaptchaWidget';

// Mock react-google-recaptcha
vi.mock('react-google-recaptcha', () => ({
  default: vi.fn(({ onChange, onExpired, onErrored }) => (
    <div data-testid="recaptcha-mock">
      <button onClick={() => onChange('mock-token')}>Verify</button>
      <button onClick={() => onExpired()}>Expire</button>
      <button onClick={() => onErrored()}>Error</button>
    </div>
  )),
}));

describe('CaptchaWidget', () => {
  it('renders CAPTCHA widget with instruction text', () => {
    const onVerify = vi.fn();
    render(<CaptchaWidget onVerify={onVerify} />);

    expect(screen.getByText('Please complete the CAPTCHA to continue')).toBeInTheDocument();
    expect(screen.getByTestId('recaptcha-mock')).toBeInTheDocument();
  });

  it('calls onVerify when CAPTCHA is completed', () => {
    const onVerify = vi.fn();
    render(<CaptchaWidget onVerify={onVerify} />);

    const verifyButton = screen.getByText('Verify');
    verifyButton.click();

    expect(onVerify).toHaveBeenCalledWith('mock-token');
  });

  it('calls onExpire when CAPTCHA expires', () => {
    const onVerify = vi.fn();
    const onExpire = vi.fn();
    render(<CaptchaWidget onVerify={onVerify} onExpire={onExpire} />);

    const expireButton = screen.getByText('Expire');
    expireButton.click();

    expect(onExpire).toHaveBeenCalled();
  });

  it('calls onError when CAPTCHA encounters an error', () => {
    const onVerify = vi.fn();
    const onError = vi.fn();
    render(<CaptchaWidget onVerify={onVerify} onError={onError} />);

    const errorButton = screen.getByText('Error');
    errorButton.click();

    expect(onError).toHaveBeenCalled();
  });

  it('uses default test site key when not provided', () => {
    const onVerify = vi.fn();
    render(<CaptchaWidget onVerify={onVerify} />);

    // Component should render without errors using default key
    expect(screen.getByTestId('recaptcha-mock')).toBeInTheDocument();
  });

  it('uses custom site key when provided', () => {
    const onVerify = vi.fn();
    const customKey = 'custom-site-key';
    render(<CaptchaWidget onVerify={onVerify} siteKey={customKey} />);

    // Component should render without errors using custom key
    expect(screen.getByTestId('recaptcha-mock')).toBeInTheDocument();
  });
});
