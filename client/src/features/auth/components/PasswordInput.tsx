import { useState } from 'react';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { calculatePasswordStrength } from '../utils/passwordStrength';
import type { PasswordStrength } from '../utils/passwordStrength';

/**
 * PasswordInput component props
 */
export interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  showStrengthIndicator?: boolean;
  placeholder?: string;
  id?: string;
  name?: string;
  autoComplete?: string;
  disabled?: boolean;
}

/**
 * PasswordInput Component
 * Secure password input with show/hide toggle and optional strength indicator
 */
export function PasswordInput({
  value,
  onChange,
  error,
  showStrengthIndicator = false,
  placeholder = 'Password',
  id = 'password',
  name = 'password',
  autoComplete = 'current-password',
  disabled = false,
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const strength = showStrengthIndicator && value ? calculatePasswordStrength(value).strength : null;

  const getStrengthColor = (strength: PasswordStrength): string => {
    switch (strength) {
      case 'weak':
        return 'bg-red-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'strong':
        return 'bg-green-500';
      default:
        return 'bg-gray-300';
    }
  };

  const getStrengthText = (strength: PasswordStrength): string => {
    switch (strength) {
      case 'weak':
        return 'Weak';
      case 'medium':
        return 'Medium';
      case 'strong':
        return 'Strong';
      default:
        return '';
    }
  };

  return (
    <div className="w-full">
      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          id={id}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-label={placeholder}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`
            w-full h-12 px-4 pr-12 rounded-lg border
            ${error ? 'border-red-500' : 'border-gray-300'}
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
            disabled:bg-gray-100 disabled:cursor-not-allowed
            text-gray-900 placeholder-gray-400
          `}
        />
        <button
          type="button"
          onClick={togglePasswordVisibility}
          disabled={disabled}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded p-1"
        >
          {showPassword ? (
            <EyeSlashIcon className="w-5 h-5" />
          ) : (
            <EyeIcon className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {/* Password strength indicator */}
      {showStrengthIndicator && value && strength && (
        <div className="mt-2" aria-live="polite">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${getStrengthColor(strength)}`}
                style={{
                  width: strength === 'weak' ? '33%' : strength === 'medium' ? '66%' : '100%',
                }}
              />
            </div>
            <span className="text-xs text-gray-600 min-w-[60px]">
              {getStrengthText(strength)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
