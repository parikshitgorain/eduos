import type { ReactNode } from 'react';

/**
 * AuthLayout component props
 */
export interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

/**
 * AuthLayout Component
 * Responsive layout wrapper for authentication pages with header and footer
 * 
 * Responsive breakpoints:
 * - Desktop (1920px+): 480px centered card
 * - Tablet (768-1919px): 90% width centered card
 * - Mobile (<768px): full-width with 16px margins
 */
export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col justify-between text-slate-800 bg-gray-50">
      {/* Header */}
      <header className="w-full bg-white px-8 py-4 border-b border-gray-100 flex items-center px-10 py-5">
        <div className="text-2xl font-extrabold tracking-tight text-slate-900">
          EduOS
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center p-4">
        {/* Login Card Container */}
        <div className="bg-white p-8 rounded-lg shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)] w-full border border-gray-200 max-w-md">
          {/* Card Title */}
          <h1 className="text-2xl text-center mb-8 text-slate-900 font-extrabold">
            {title}
          </h1>

          {/* Subtitle (if provided) */}
          {subtitle && (
            <div className="text-center mb-6">
              <p className="text-sm text-gray-600">{subtitle}</p>
            </div>
          )}

          {/* Content */}
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 text-center text-xs text-slate-500 bg-slate-50">
        <div className="flex justify-center gap-6 mb-2">
          <a 
            href="/terms" 
            className="text-sm text-gray-500 hover:underline"
          >
            Terms of Service
          </a>
          <a 
            href="/privacy" 
            className="text-sm text-gray-500 hover:underline"
          >
            Privacy Policy
          </a>
        </div>
        <div className="text-xs text-gray-400 mt-2">
          © {new Date().getFullYear()} EduOS. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
