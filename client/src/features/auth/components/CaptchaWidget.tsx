import { useRef, useEffect } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';

/**
 * CaptchaWidget component props
 */
export interface CaptchaWidgetProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  siteKey?: string;
}

/**
 * CaptchaWidget Component
 * Google reCAPTCHA v2 widget for bot protection
 */
export function CaptchaWidget({
  onVerify,
  onExpire,
  onError,
  siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI', // Test key by default
}: CaptchaWidgetProps) {
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  useEffect(() => {
    // Reset CAPTCHA when component unmounts
    return () => {
      if (recaptchaRef.current) {
        recaptchaRef.current.reset();
      }
    };
  }, []);

  const handleChange = (token: string | null) => {
    if (token) {
      onVerify(token);
    }
  };

  const handleExpired = () => {
    if (onExpire) {
      onExpire();
    }
  };

  const handleError = () => {
    if (onError) {
      onError();
    }
  };

  return (
    <div 
      className="p-4 bg-gray-50 border border-gray-300 rounded-lg"
      role="region"
      aria-label="CAPTCHA verification"
    >
      <p className="text-sm text-gray-700 mb-3" id="captcha-instructions">
        Please complete the CAPTCHA to continue
      </p>
      <div className="flex justify-center">
        <ReCAPTCHA
          ref={recaptchaRef}
          sitekey={siteKey}
          onChange={handleChange}
          onExpired={handleExpired}
          onErrored={handleError}
          theme="light"
          aria-describedby="captcha-instructions"
        />
      </div>
    </div>
  );
}
