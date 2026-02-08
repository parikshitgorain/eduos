import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { mfaSchema, type MFAFormData } from '../utils/validationSchemas';
import { ErrorDisplay } from '../../../shared/components/ErrorDisplay';
import { ButtonLoadingIndicator } from '../../../shared/components/LoadingIndicator';
import { focusFirstInvalidField } from '../utils/focusManagement';

/**
 * MFAForm component props
 */
export interface MFAFormProps {
  sessionId: string;
  onVerify: (sessionId: string, otp: string) => Promise<void>;
  onResend: (sessionId: string) => Promise<void>;
  onBack: () => void;
  isLoading?: boolean;
  error?: string | null;
}

/**
 * MFAForm Component
 * Two-factor authentication form with 6-digit OTP input
 */
export function MFAForm({
  sessionId,
  onVerify,
  onResend,
  onBack,
  isLoading = false,
  error = null,
}: MFAFormProps) {
  const [resendCountdown, setResendCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<MFAFormData>({
    resolver: zodResolver(mfaSchema),
    mode: 'onChange',
    defaultValues: {
      otp: '',
    },
  });

  const otp = watch('otp');

  // Focus first invalid field when errors change
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      focusFirstInvalidField(errors, ['otp']);
    }
  }, [errors]);

  // Countdown timer for resend button
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => {
        setResendCountdown(resendCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendCountdown]);

  // Auto-submit when 6 digits are entered
  useEffect(() => {
    if (otp.length === 6 && isValid && !isLoading) {
      handleSubmit(handleFormSubmit)();
    }
  }, [otp, isValid, isLoading]);

  const handleFormSubmit = async (data: MFAFormData) => {
    try {
      await onVerify(sessionId, data.otp);
    } catch (err) {
      // Error handling is done by parent component
    }
  };

  const handleResend = async () => {
    if (!canResend || isLoading) return;

    try {
      await onResend(sessionId);
      setResendCountdown(60);
      setCanResend(false);
    } catch (err) {
      // Error handling is done by parent component
    }
  };

  return (
    <form 
      onSubmit={handleSubmit(handleFormSubmit)} 
      className="space-y-6" 
      noValidate
      aria-label="Multi-factor authentication form"
    >
      {/* Global error message */}
      {error && (
        <div role="alert" aria-live="assertive">
          <ErrorDisplay message={error} />
        </div>
      )}

      {/* Instructions */}
      <div className="text-center">
        <p className="text-sm text-gray-600" id="mfa-instructions">
          Enter the 6-digit code from your authenticator app
        </p>
      </div>

      {/* OTP Input */}
      <div>
        <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-2">
          Verification Code
        </label>
        <input
          {...register('otp')}
          type="text"
          id="otp"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          autoComplete="one-time-code"
          disabled={isLoading}
          placeholder="000000"
          aria-label="6-digit verification code"
          aria-required="true"
          aria-invalid={!!errors.otp}
          aria-describedby={errors.otp ? 'otp-error' : 'mfa-instructions'}
          className={`
            w-full h-12 px-4 rounded-lg border text-center text-2xl tracking-widest bg-white
            ${errors.otp ? 'border-red-500' : 'border-gray-300'}
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
            disabled:bg-gray-100 disabled:cursor-not-allowed
            text-gray-900 placeholder-gray-400
          `}
        />
        {errors.otp && (
          <p id="otp-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.otp.message}
          </p>
        )}
      </div>

      {/* Verify Button */}
      <button
        type="submit"
        disabled={!isValid || isLoading}
        aria-label={isLoading ? 'Verifying code, please wait' : 'Verify authentication code'}
        aria-disabled={!isValid || isLoading}
        className={`
          w-full h-12 rounded-lg font-medium text-white
          flex items-center justify-center gap-2
          transition-colors duration-200
          ${
            !isValid || isLoading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2'
          }
        `}
      >
        {isLoading ? (
          <>
            <ButtonLoadingIndicator />
            <span>Verifying...</span>
          </>
        ) : (
          'Verify'
        )}
      </button>

      {/* Resend Code Button */}
      <div className="text-center">
        <button
          type="button"
          onClick={handleResend}
          disabled={!canResend || isLoading}
          aria-label={canResend ? 'Resend verification code' : `Resend code available in ${resendCountdown} seconds`}
          aria-disabled={!canResend || isLoading}
          aria-live="polite"
          className={`
            text-sm font-medium px-2 py-2 min-h-[44px] inline-flex items-center rounded
            ${
              canResend && !isLoading
                ? 'text-primary-600 hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500'
                : 'text-gray-400 cursor-not-allowed'
            }
          `}
        >
          {canResend ? 'Resend code' : `Resend code in ${resendCountdown}s`}
        </button>
      </div>

      {/* Back to Login Link */}
      <div className="text-center">
        <button
          type="button"
          onClick={onBack}
          disabled={isLoading}
          aria-label="Return to login page"
          className="text-sm text-primary-600 hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded disabled:opacity-50 px-2 py-2 min-h-[44px] inline-flex items-center"
        >
          Back to login
        </button>
      </div>
    </form>
  );
}
