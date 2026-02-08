import React, { useEffect } from 'react';
import { XMarkIcon, ExclamationCircleIcon, CheckCircleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

/**
 * Toast notification component for displaying temporary messages
 * 
 * Requirements: 6.3
 */

export type ToastType = 'error' | 'success' | 'info' | 'warning';

export interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Toast notification component
 * Displays a temporary message at the top of the screen
 * Auto-dismisses after the specified duration
 * 
 * @param message - Message to display
 * @param type - Toast type (error, success, info, warning)
 * @param duration - Auto-dismiss duration in milliseconds (0 = no auto-dismiss)
 * @param onClose - Callback when toast is closed
 * @param action - Optional action button
 */
export function Toast({
  message,
  type = 'info',
  duration = 5000,
  onClose,
  action,
}: ToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const styles = getToastStyles(type);
  const Icon = getToastIcon(type);

  return (
    <div
      className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-slide-down"
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div
        className={`flex items-center gap-3 min-w-[320px] max-w-[600px] px-4 py-3 rounded-lg shadow-lg ${styles.bg} ${styles.border} border`}
      >
        <Icon className={`h-5 w-5 flex-shrink-0 ${styles.icon}`} aria-hidden="true" />
        
        <p className={`flex-1 text-sm font-medium ${styles.text}`}>
          {message}
        </p>

        {action && (
          <button
            onClick={action.onClick}
            className={`px-3 py-1 text-sm font-medium rounded ${styles.actionButton} hover:opacity-80 transition-opacity`}
            type="button"
          >
            {action.label}
          </button>
        )}

        <button
          onClick={onClose}
          className={`flex-shrink-0 p-1 rounded hover:bg-black/5 transition-colors ${styles.closeButton}`}
          aria-label="Close notification"
          type="button"
        >
          <XMarkIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/**
 * Get toast styles based on type
 */
function getToastStyles(type: ToastType) {
  switch (type) {
    case 'error':
      return {
        bg: 'bg-red-50',
        border: 'border-red-200',
        icon: 'text-red-600',
        text: 'text-red-900',
        actionButton: 'bg-red-600 text-white',
        closeButton: 'text-red-600',
      };
    case 'success':
      return {
        bg: 'bg-green-50',
        border: 'border-green-200',
        icon: 'text-green-600',
        text: 'text-green-900',
        actionButton: 'bg-green-600 text-white',
        closeButton: 'text-green-600',
      };
    case 'warning':
      return {
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        icon: 'text-yellow-600',
        text: 'text-yellow-900',
        actionButton: 'bg-yellow-600 text-white',
        closeButton: 'text-yellow-600',
      };
    case 'info':
    default:
      return {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        icon: 'text-blue-600',
        text: 'text-blue-900',
        actionButton: 'bg-blue-600 text-white',
        closeButton: 'text-blue-600',
      };
  }
}

/**
 * Get toast icon based on type
 */
function getToastIcon(type: ToastType) {
  switch (type) {
    case 'error':
      return ExclamationCircleIcon;
    case 'success':
      return CheckCircleIcon;
    case 'warning':
      return ExclamationCircleIcon;
    case 'info':
    default:
      return InformationCircleIcon;
  }
}
