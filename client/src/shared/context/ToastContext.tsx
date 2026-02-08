import React, { createContext, useContext, useState, useCallback } from 'react';
import { Toast, ToastType } from '../components/Toast';

/**
 * Toast context for managing global toast notifications
 * 
 * Requirements: 6.3
 */

interface ToastConfig {
  message: string;
  type?: ToastType;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextValue {
  showToast: (config: ToastConfig) => void;
  showError: (message: string, action?: ToastConfig['action']) => void;
  showSuccess: (message: string) => void;
  showInfo: (message: string) => void;
  showWarning: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

interface ToastState extends ToastConfig {
  id: number;
}

/**
 * Toast provider component
 * Manages toast notifications and provides methods to show/hide them
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const [nextId, setNextId] = useState(0);

  const showToast = useCallback((config: ToastConfig) => {
    const id = nextId;
    setNextId((prev) => prev + 1);
    setToasts((prev) => [...prev, { ...config, id }]);
  }, [nextId]);

  const showError = useCallback((message: string, action?: ToastConfig['action']) => {
    showToast({ message, type: 'error', duration: 0, action });
  }, [showToast]);

  const showSuccess = useCallback((message: string) => {
    showToast({ message, type: 'success', duration: 3000 });
  }, [showToast]);

  const showInfo = useCallback((message: string) => {
    showToast({ message, type: 'info', duration: 5000 });
  }, [showToast]);

  const showWarning = useCallback((message: string) => {
    showToast({ message, type: 'warning', duration: 5000 });
  }, [showToast]);

  const closeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const value: ToastContextValue = {
    showToast,
    showError,
    showSuccess,
    showInfo,
    showWarning,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          action={toast.action}
          onClose={() => closeToast(toast.id)}
        />
      ))}
    </ToastContext.Provider>
  );
}

/**
 * Hook to access toast context
 * 
 * @returns Toast context value with methods to show notifications
 * @throws Error if used outside ToastProvider
 * 
 * @example
 * ```typescript
 * const { showError } = useToast();
 * 
 * try {
 *   await authService.login(credentials);
 * } catch (error) {
 *   showError('Connection error. Please try again', {
 *     label: 'Retry',
 *     onClick: handleRetry,
 *   });
 * }
 * ```
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  
  return context;
}
