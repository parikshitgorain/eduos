import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, type ForgotPasswordFormData } from '../utils/validationSchemas';
import { ErrorDisplay } from '../../../shared/components/ErrorDisplay';
import { ButtonLoadingIndicator } from '../../../shared/components/LoadingIndicator';
import { focusFirstInvalidField } from '../utils/focusManagement';

/**
 * ForgotPasswordForm component props
 */
export interface ForgotPasswordFormProps {
  onSubmit: (email: string) => Promise<void>;
  onBack: () => void;
  isLoading?: boolean;
  error?: string | null;
}

/**
 * ForgotPasswordForm Component
 * Password reset request form with email input
 */
export function ForgotPasswordForm({
  onSubmit,
  onBack,
  isLoading = false,
  error = null,
}: ForgotPasswordFormProps) {
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onChange',
    defaultValues: {
      email: '',
    },
  });

  // Focus first invalid field when errors change
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      focusFirstInvalidField(errors, ['email']);
    }
  }, [errors]);

  const handleFormSubmit = async (data: ForgotPasswordFormData) => {
    try {
      await onSubmit(data.email);
      setSubmitted(true);
    } catch (err) {
      // Error handling is done by parent component
    }
  };

  if (submitted) {
    return (
      <div className="space-y-6">
        {/* Success Message */}
        <div 
          className="bg-green-50 border border-green-200 rounded-lg p-4"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-green-400"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">Check your email</h3>
              <div className="mt-2 text-sm text-green-700">
                <p>
                  If an account exists with that email address, we've sent you a password reset
                  link. Please check your inbox and follow the instructions.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Back to Login Button */}
        <button
          type="button"
          onClick={onBack}
          aria-label="Return to login page"
          className="w-full h-12 rounded-lg font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        >
          Back to Login
        </button>
      </div>
    );
  }

  return (
    <form 
      onSubmit={handleSubmit(handleFormSubmit)} 
      className="space-y-6" 
      noValidate
      aria-label="Password reset form"
    >
      {/* Global error message */}
      {error && (
        <div role="alert" aria-live="assertive">
          <ErrorDisplay message={error} />
        </div>
      )}

      {/* Instructions */}
      <div className="text-center">
        <p className="text-sm text-gray-600" id="forgot-password-instructions">
          Enter your email address and we'll send you a link to reset your password
        </p>
      </div>

      {/* Email Input */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
          Email Address
        </label>
        <input
          {...register('email')}
          type="email"
          id="email"
          autoComplete="email"
          disabled={isLoading}
          placeholder="your.email@example.com"
          aria-label="Email address for password reset"
          aria-required="true"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : 'forgot-password-instructions'}
          className={`
            w-full h-12 px-4 rounded-lg border bg-white
            ${errors.email ? 'border-red-500' : 'border-gray-300'}
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
            disabled:bg-gray-100 disabled:cursor-not-allowed
            text-gray-900 placeholder-gray-400
          `}
        />
        {errors.email && (
          <p id="email-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.email.message}
          </p>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!isValid || isLoading}
        aria-label={isLoading ? 'Sending reset link, please wait' : 'Send password reset link'}
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
            <span>Sending...</span>
          </>
        ) : (
          'Send Reset Link'
        )}
      </button>

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
