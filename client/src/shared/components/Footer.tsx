/**
 * Footer Component
 * Displays footer links and copyright information
 */
export function Footer() {
  return (
    <div className="mt-8 text-center text-sm text-gray-600">
      <div className="flex items-center justify-center gap-4">
        <a 
          href="/terms" 
          className="text-primary-600 hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded px-2 py-2 min-h-[44px] inline-flex items-center"
        >
          Terms of Service
        </a>
        <span aria-hidden="true">•</span>
        <a 
          href="/privacy" 
          className="text-primary-600 hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded px-2 py-2 min-h-[44px] inline-flex items-center"
        >
          Privacy Policy
        </a>
      </div>
      <p className="mt-2">© {new Date().getFullYear()} EduOS. All rights reserved.</p>
    </div>
  );
}
