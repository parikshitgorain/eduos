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
 * Responsive layout wrapper for authentication pages
 * 
 * Responsive breakpoints:
 * - Desktop (1920px+): 480px centered card
 * - Tablet (768-1919px): 90% width centered card
 * - Mobile (<768px): full-width with 16px margins
 */
export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="w-full max-w-[480px] mx-auto md:w-[90%] md:max-w-[480px] lg:w-full lg:max-w-[480px]">
        {/* Card */}
        <div className="bg-white rounded-lg shadow-md p-8 md:p-12">
          {/* Logo */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-primary-600">EduOS</h1>
          </div>

          {/* Heading */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
            {subtitle && <p className="mt-2 text-sm text-gray-600">{subtitle}</p>}
          </div>

          {/* Content */}
          {children}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <div className="space-x-4">
            <a 
              href="/terms" 
              className="text-primary-600 hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded"
            >
              Terms of Service
            </a>
            <span>•</span>
            <a 
              href="/privacy" 
              className="text-primary-600 hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded"
            >
              Privacy Policy
            </a>
          </div>
          <p className="mt-2">© {new Date().getFullYear()} EduOS. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
