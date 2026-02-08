/**
 * LoadingIndicator component props
 */
export interface LoadingIndicatorProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

/**
 * LoadingIndicator Component
 * Displays a spinner animation for loading states
 */
export function LoadingIndicator({ size = 'md', className = '', label }: LoadingIndicatorProps) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3',
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div
        className={`
          ${sizeClasses[size]}
          border-primary-600 border-t-transparent
          rounded-full animate-spin
        `}
        role="status"
        aria-label={label || 'Loading'}
      >
        <span className="sr-only">{label || 'Loading...'}</span>
      </div>
    </div>
  );
}

/**
 * ButtonLoadingIndicator Component
 * Spinner specifically designed for button loading states
 */
export function ButtonLoadingIndicator({ className = '' }: { className?: string }) {
  return (
    <div className={`inline-flex items-center ${className}`}>
      <div
        className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
        role="status"
        aria-label="Loading"
      >
        <span className="sr-only">Loading...</span>
      </div>
    </div>
  );
}

/**
 * InlineLoadingIndicator Component
 * Small spinner for inline loading states (e.g., in dropdowns)
 */
export function InlineLoadingIndicator({ className = '' }: { className?: string }) {
  return (
    <div className={`inline-flex items-center ${className}`}>
      <div
        className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"
        role="status"
        aria-label="Loading"
      >
        <span className="sr-only">Loading...</span>
      </div>
    </div>
  );
}
