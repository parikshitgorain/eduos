import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { loginSchema } from '../utils/validationSchemas';
import type { LoginFormData } from '../utils/validationSchemas';
import { TenantSelector } from './TenantSelector';
import { PasswordInput } from './PasswordInput';
import { ErrorDisplay } from '../../../shared/components/ErrorDisplay';
import { ButtonLoadingIndicator } from '../../../shared/components/LoadingIndicator';
import { SSOButtons, type SSOProvider } from './SSOButtons';
import { CaptchaWidget } from './CaptchaWidget';
import { ContactAdminLink } from './ContactAdminLink';
import { focusFirstInvalidField } from '../utils/focusManagement';

/**
 * LoginForm component props
 */
export interface LoginFormProps {
  onSuccess: () => void;
  onMFARequired: (sessionId: string) => void;
  onSubmit: (data: LoginFormData) => Promise<{ requiresMFA: boolean; sessionId?: string }>;
  onSSOInitiate: (provider: SSOProvider, tenantId: string) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
}

/**
 * LoginForm Component
 * Main authentication form with institution selection, email/password inputs, and submission logic
 */
export function LoginForm({
  onSuccess,
  onMFARequired,
  onSubmit,
  onSSOInitiate,
  isLoading = false,
  error = null,
}: LoginFormProps) {
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [selectedTenantName, setSelectedTenantName] = useState<string | null>(null);
  const [selectedTenantContactInfo, setSelectedTenantContactInfo] = useState<{ email?: string; phone?: string } | undefined>(undefined);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isValid },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
    defaultValues: {
      tenantId: '',
      email: '',
      password: '',
      rememberMe: false,
      captchaToken: undefined,
    },
  });

  // Focus first invalid field when errors change
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      // Define field order for focus priority
      const fieldOrder = ['tenantId', 'email', 'password', 'captchaToken'];
      focusFirstInvalidField(errors, fieldOrder);
    }
  }, [errors]);

  const tenantId = watch('tenantId');
  const password = watch('password');

  const handleTenantChange = (id: string, name: string, contactInfo?: { email?: string; phone?: string }) => {
    setValue('tenantId', id, { shouldValidate: true });
    setSelectedTenantName(name);
    setSelectedTenantContactInfo(contactInfo);
  };

  const handlePasswordChange = (value: string) => {
    setValue('password', value, { shouldValidate: true });
  };

  const handleCaptchaVerify = (token: string) => {
    setValue('captchaToken', token, { shouldValidate: true });
  };

  const handleCaptchaExpire = () => {
    setValue('captchaToken', undefined, { shouldValidate: true });
  };

  const handleFormSubmit = async (data: LoginFormData) => {
    try {
      const response = await onSubmit(data);

      if (response.requiresMFA && response.sessionId) {
        onMFARequired(response.sessionId);
      } else {
        // Reset failed attempts on successful login
        setFailedAttempts(0);
        setShowCaptcha(false);
        onSuccess();
      }
    } catch (err) {
      // Increment failed attempts
      const newFailedAttempts = failedAttempts + 1;
      setFailedAttempts(newFailedAttempts);

      // Show CAPTCHA after 3 failed attempts
      if (newFailedAttempts >= 3) {
        setShowCaptcha(true);
      }

      // Clear password field for security
      setValue('password', '');
    }
  };

  const handleSSOInitiate = async (provider: SSOProvider) => {
    if (!tenantId) return;
    
    try {
      await onSSOInitiate(provider, tenantId);
    } catch (err) {
      // Error will be handled by parent component
    }
  };

  return (
    <form 
      onSubmit={handleSubmit(handleFormSubmit)} 
      className="space-y-6" 
      noValidate
      aria-label="Login form"
    >
      {/* Global error message */}
      {error && (
        <div role="alert" aria-live="assertive">
          <ErrorDisplay message={error} />
        </div>
      )}

      {/* Institution Selection */}
      <div>
        <label htmlFor="tenant" className="block text-sm font-medium text-gray-700 mb-2">
          Institution
        </label>
        <TenantSelector
          value={tenantId}
          onChange={handleTenantChange}
          error={errors.tenantId?.message}
          disabled={isLoading}
        />
      </div>

      {/* Email Input */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
          Email
        </label>
        <input
          {...register('email')}
          type="email"
          id="email"
          autoComplete="email"
          disabled={isLoading || !tenantId}
          placeholder="your.email@example.com"
          aria-label="Email address"
          aria-required="true"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
          className={`
            w-full h-12 px-4 rounded-lg border bg-white
            ${errors.email ? 'border-red-500' : 'border-gray-300'}
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
            disabled:bg-gray-100 disabled:cursor-not-allowed
            text-gray-900 placeholder-gray-500
          `}
        />
        {errors.email && (
          <p id="email-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.email.message}
          </p>
        )}
      </div>

      {/* Password Input */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <Link
            to="/forgot-password"
            className="text-sm text-primary-600 hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded px-2 py-2 min-h-[44px] inline-flex items-center"
          >
            Forgot password?
          </Link>
        </div>
        <PasswordInput
          value={password}
          onChange={handlePasswordChange}
          error={errors.password?.message}
          disabled={isLoading || !tenantId}
          placeholder="Enter your password"
        />
      </div>

      {/* Remember Me Checkbox */}
      <div className="flex items-center">
        <input
          {...register('rememberMe')}
          type="checkbox"
          id="rememberMe"
          disabled={isLoading}
          aria-label="Remember me for 30 days"
          className="w-5 h-5 accent-primary-600 bg-white border-gray-300 rounded focus:ring-primary-500 focus:ring-2 cursor-pointer disabled:cursor-not-allowed"
        />
        <label htmlFor="rememberMe" className="ml-2 text-sm text-gray-700 cursor-pointer select-none">
          Remember me
        </label>
      </div>

      {/* CAPTCHA Widget (shown after 3 failed attempts) */}
      {showCaptcha && (
        <CaptchaWidget
          onVerify={handleCaptchaVerify}
          onExpire={handleCaptchaExpire}
        />
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!isValid || isLoading || (showCaptcha && !watch('captchaToken'))}
        aria-label={isLoading ? 'Signing in, please wait' : 'Sign in to your account'}
        aria-disabled={!isValid || isLoading || (showCaptcha && !watch('captchaToken'))}
        className={`
          w-full h-12 rounded-lg font-medium text-white
          flex items-center justify-center gap-2
          transition-colors duration-200
          ${
            !isValid || isLoading || (showCaptcha && !watch('captchaToken'))
              ? 'bg-gray-500 cursor-not-allowed'
              : 'bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2'
          }
        `}
      >
        {isLoading ? (
          <>
            <ButtonLoadingIndicator />
            <span>Signing in...</span>
          </>
        ) : (
          'Sign In'
        )}
      </button>

      {/* SSO Buttons */}
      <SSOButtons
        tenantId={tenantId}
        onInitiate={handleSSOInitiate}
        disabled={isLoading}
        isLoading={isLoading}
      />

      {/* Contact Administrator Link */}
      <ContactAdminLink 
        tenantId={tenantId} 
        tenantName={selectedTenantName}
        contactInfo={selectedTenantContactInfo}
      />
    </form>
  );
}
