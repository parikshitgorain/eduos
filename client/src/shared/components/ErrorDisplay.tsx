import { ExclamationCircleIcon } from '@heroicons/react/24/solid';

/**
 * ErrorDisplay component props
 */
export interface ErrorDisplayProps {
  message: string;
  className?: string;
}

/**
 * ErrorDisplay Component
 * Displays inline error messages with icon and screen reader support
 */
export function ErrorDisplay({ message, className = '' }: ErrorDisplayProps) {
  if (!message) {
    return null;
  }

  return (
    <div
      className={`flex items-start gap-2 text-red-600 ${className}`}
      role="alert"
      aria-live="polite"
    >
      <ExclamationCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
      <span className="text-sm">{message}</span>
    </div>
  );
}
