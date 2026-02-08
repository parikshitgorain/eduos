# Implementation Plan: Login & Authentication UI

## Overview

This implementation plan breaks down the Login & Authentication UI feature into discrete, actionable coding tasks. The approach follows a bottom-up strategy: starting with foundational utilities and services, then building core components, and finally integrating everything into complete user flows. Each task builds incrementally on previous work, with testing integrated throughout to catch errors early.

The implementation uses React 18+ with TypeScript, Tailwind CSS for styling, React Hook Form for form management, and fast-check for property-based testing.

## Tasks

- [x] 1. Set up frontend project structure and dependencies
  - Create `client/` directory in project root
  - Initialize Vite + React + TypeScript project: `npm create vite@latest client -- --template react-ts`
  - Create directory structure: `client/src/features/auth/`, `client/src/shared/`, `client/src/config/`
  - Install dependencies: react-hook-form, zod, axios, tailwindcss, @heroicons/react, fast-check, vitest, @testing-library/react
  - Configure Tailwind with custom theme (primary color #4F46E5, custom spacing)
  - Configure Vite proxy to forward `/api/*` requests to `http://localhost:3000`
  - Set up TypeScript types for API responses and form data
  - Create `.env` file with `VITE_API_URL=http://localhost:3000`
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_
  - **Note:** All frontend code goes in `client/` directory, backend stays in `src/`

- [x] 2. Implement validation utilities and schemas
  - [x] 2.1 Create Zod validation schemas
    - Create file: `client/src/features/auth/utils/validationSchemas.ts`
    - Write loginSchema (tenantId, email, password, rememberMe, captchaToken)
    - Write mfaSchema (6-digit OTP validation)
    - Write forgotPasswordSchema (email validation)
    - _Requirements: 2.1, 5.1, 5.2_
  
  - [x]* 2.2 Write property test for email validation
    - **Property 3: Email Validation**
    - **Validates: Requirements 2.1, 5.1**
  
  - [x] 2.3 Create password strength calculator
    - Create file: `client/src/features/auth/utils/passwordStrength.ts`
    - Implement strength calculation based on length, uppercase, lowercase, numbers, special chars
    - Return 'weak', 'medium', or 'strong' rating
    - _Requirements: 5.3_
  
  - [x]* 2.4 Write property test for password strength calculation
    - **Property 6: Password Strength Calculation**
    - **Validates: Requirements 5.3**

- [x] 3. Implement API services layer
  - [x] 3.1 Create Axios client with interceptors
    - Create file: `client/src/config/apiClient.ts`
    - Configure base URL from environment variables (VITE_API_URL)
    - Add request interceptor for auth tokens
    - Add response interceptor for error handling
    - Set 30-second timeout for all requests
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_
  
  - [x] 3.2 Implement authService
    - Create file: `client/src/features/auth/services/authService.ts`
    - Write login() method calling POST /api/v1/auth/login
    - Write verifyMFA() method calling POST /api/v1/auth/mfa/verify
    - Write initiateSSO() method calling GET /api/v1/auth/sso/{provider}
    - Write forgotPassword() method calling POST /api/v1/auth/forgot-password
    - Write logout() method
    - _Requirements: 2.4, 3.3, 4.2, 8.3, 15.2, 15.3, 15.4, 15.5, 15.6_
  
  - [x]* 3.3 Write property test for login API integration
    - **Property 35: Login API Integration**
    - **Validates: Requirements 15.2**
  
  - [x]* 3.4 Write property test for MFA API integration
    - **Property 36: MFA API Integration**
    - **Validates: Requirements 15.3**
  
  - [x] 3.5 Implement tenantService
    - Create file: `client/src/features/auth/services/tenantService.ts`
    - Write searchTenants() method calling GET /api/v1/tenants/search
    - Implement debouncing (300ms delay)
    - _Requirements: 1.2, 15.1_
  
  - [x]* 3.6 Write property test for tenant search API integration
    - **Property 1: Tenant Search API Integration**
    - **Validates: Requirements 1.2, 1.3, 15.1**

- [x] 4. Implement token and session management
  - [x] 4.1 Create tokenService
    - Create file: `client/src/features/auth/services/tokenService.ts`
    - Write setToken() with secure cookie storage
    - Write getToken() to retrieve from cookies
    - Write clearToken() to remove all auth data
    - Write isTokenValid() to check expiration
    - Calculate expiration based on rememberMe flag (30 days vs 24 hours)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  
  - [x]* 4.2 Write property test for remember me token expiration
    - **Property 20: Remember Me Token Expiration**
    - **Validates: Requirements 9.2, 9.3**
  
  - [x]* 4.3 Write property test for token expiration handling
    - **Property 21: Token Expiration Handling**
    - **Validates: Requirements 9.4**
  
  - [x]* 4.4 Write property test for logout session cleanup
    - **Property 22: Logout Session Cleanup**
    - **Validates: Requirements 9.5**

- [x] 5. Create authentication context and hooks
  - [x] 5.1 Implement AuthContext and AuthProvider
    - Create file: `client/src/features/auth/context/AuthContext.tsx`
    - Create context with user, token, isAuthenticated, isLoading, error state
    - Implement login, logout, verifyMFA actions
    - Handle token storage via tokenService
    - _Requirements: 2.4, 2.5, 2.6, 9.1_
  
  - [x] 5.2 Create useAuth hook
    - Create file: `client/src/features/auth/hooks/useAuth.ts`
    - Export authentication state and actions
    - Provide easy access to AuthContext
    - _Requirements: 2.4, 2.5, 2.6_
  
  - [x]* 5.3 Write property test for authentication flow with token storage
    - **Property 7: Authentication Flow with Token Storage**
    - **Validates: Requirements 2.4, 2.5, 9.1**

- [x] 6. Build core UI components
  - [x] 6.1 Create PasswordInput component
    - Create file: `client/src/features/auth/components/PasswordInput.tsx`
    - Implement password masking by default
    - Add show/hide toggle button with eye icon
    - Display password strength indicator
    - Include proper ARIA attributes (aria-label, aria-describedby)
    - Style with Tailwind (48px height, rounded corners, light border)
    - _Requirements: 2.2, 2.3, 5.3, 12.3, 13.4_
  
  - [x]* 6.2 Write property test for password masking and toggle
    - **Property 4: Password Masking and Toggle**
    - **Validates: Requirements 2.2, 2.3**
  
  - [x] 6.3 Create TenantSelector component
    - Create file: `client/src/features/auth/components/TenantSelector.tsx`
    - Implement searchable dropdown with debounced API calls
    - Display institution name and location in results
    - Show loading spinner during search
    - Handle empty results with appropriate message
    - Support keyboard navigation (Arrow keys, Enter, Escape)
    - Include ARIA attributes for accessibility
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 10.5, 12.1_
  
  - [x]* 6.4 Write property test for tenant selection state management
    - **Property 2: Tenant Selection State Management**
    - **Validates: Requirements 1.4**
  
  - [x] 6.5 Create ErrorDisplay component
    - Create file: `client/src/shared/components/ErrorDisplay.tsx`
    - Display inline error messages below fields
    - Use red color (#EF4444) with error icon
    - Support aria-live announcements for screen readers
    - _Requirements: 1.5, 5.1, 5.2, 6.1, 6.2, 6.3, 6.4, 12.3_
  
  - [x] 6.6 Create LoadingIndicator component
    - Create file: `client/src/shared/components/LoadingIndicator.tsx`
    - Implement spinner animation
    - Support button loading state (spinner inside button)
    - Support inline loading state (spinner in dropdown)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 7. Implement LoginForm component
  - [x] 7.1 Create LoginForm with React Hook Form
    - Create file: `client/src/features/auth/components/LoginForm.tsx`
    - Set up form with useForm hook and Zod validation
    - Add TenantSelector, email input, PasswordInput, RememberMe checkbox
    - Implement real-time validation with error display
    - Add "Forgot password?" link
    - Add "Sign In" button (disabled until form is valid)
    - Track failed login attempts for CAPTCHA trigger
    - _Requirements: 1.1, 2.1, 2.2, 2.3, 5.1, 5.2, 5.3, 5.4, 5.5, 7.1_
  
  - [x]* 7.2 Write property test for form validation state
    - **Property 5: Form Validation State**
    - **Validates: Requirements 5.2, 5.4, 5.5**
  
  - [x] 7.3 Implement form submission handler
    - Call authService.login() with form data
    - Handle loading state (disable inputs, show spinner)
    - Handle success (store token, redirect or show MFA)
    - Handle errors (display message, clear password, increment counter)
    - _Requirements: 2.4, 2.5, 2.6, 6.1, 6.2, 6.3, 6.4, 6.5, 10.1, 10.2, 10.3_
  
  - [x]* 7.4 Write property test for password field security clearing
    - **Property 16: Password Field Security Clearing**
    - **Validates: Requirements 6.5**
  
  - [x]* 7.5 Write property test for loading state management
    - **Property 23: Loading State Management**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5**
  
  - [x] 7.6 Add CAPTCHA widget integration
    - Display CAPTCHA after 3 failed attempts
    - Require CAPTCHA completion before next login attempt
    - Reset counter on successful login
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  
  - [x]* 7.7 Write unit test for CAPTCHA trigger threshold
    - Test that CAPTCHA appears after exactly 3 failed attempts
    - **Validates: Requirements 7.1**
  
  - [x]* 7.8 Write property test for CAPTCHA enforcement
    - **Property 17: CAPTCHA Enforcement**
    - **Validates: Requirements 7.2, 7.3**
  
  - [x]* 7.9 Write property test for failed attempt counter reset
    - **Property 18: Failed Attempt Counter Reset**
    - **Validates: Requirements 7.5**

- [x] 8. Checkpoint - Ensure login form tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement SSO integration
  - [x] 9.1 Create SSOButtons component
    - Create file: `client/src/features/auth/components/SSOButtons.tsx`
    - Add "Sign in with Google" button with Google logo
    - Add "Sign in with Microsoft" button with Microsoft logo
    - Disable buttons until tenant is selected
    - Handle button clicks to initiate OAuth flow
    - _Requirements: 4.1, 4.2_
  
  - [x] 9.2 Implement SSO initiation handler
    - Call authService.initiateSSO() with provider and tenant ID
    - Show loading state during redirect
    - Redirect to provider authorization URL
    - _Requirements: 4.2, 15.4, 15.5_
  
  - [x]* 9.3 Write property test for SSO initiation
    - **Property 13: SSO Initiation**
    - **Validates: Requirements 4.2, 15.4, 15.5**
  
  - [x] 9.4 Implement SSO callback handler
    - Parse authorization code from URL query parameters
    - Call authService.handleSSOCallback() to exchange for token
    - Store token and redirect to dashboard
    - Handle errors appropriately
    - _Requirements: 4.4, 4.5_
  
  - [x]* 9.5 Write property test for SSO callback handling
    - **Property 14: SSO Callback Handling**
    - **Validates: Requirements 4.4, 4.5**

- [x] 10. Implement MFA verification flow
  - [x] 10.1 Create MFAForm component
    - Create file: `client/src/features/auth/components/MFAForm.tsx`
    - Add 6-digit OTP input field
    - Implement auto-submit when 6 digits entered
    - Add "Resend code" button with 60-second countdown
    - Add "Back to login" link
    - Display loading state during verification
    - _Requirements: 3.1, 3.2, 3.5_
  
  - [x]* 10.2 Write property test for OTP auto-submit
    - **Property 9: OTP Auto-Submit**
    - **Validates: Requirements 3.2**
  
  - [x] 10.3 Implement MFA verification handler
    - Call authService.verifyMFA() with session ID and OTP
    - Handle success (store token, redirect to dashboard)
    - Handle errors (display message, allow retry)
    - _Requirements: 3.3, 3.4, 15.3_
  
  - [x]* 10.4 Write property test for MFA verification flow
    - **Property 10: MFA Verification Flow**
    - **Validates: Requirements 3.3**
  
  - [x]* 10.5 Write property test for MFA error handling
    - **Property 11: MFA Error Handling**
    - **Validates: Requirements 3.4**
  
  - [x]* 10.6 Write property test for MFA resend functionality
    - **Property 12: MFA Resend Functionality**
    - **Validates: Requirements 3.5**
  
  - [x] 10.7 Create MFAPage component
    - Create file: `client/src/features/auth/pages/MFAPage.tsx`
    - Wrap MFAForm with layout
    - Display EduOS logo
    - Show "Two-Factor Authentication" heading
    - Include footer
    - _Requirements: 3.1, 13.1, 13.5_

- [x] 11. Implement password recovery flow
  - [x] 11.1 Create ForgotPasswordForm component
    - Create file: `client/src/features/auth/components/ForgotPasswordForm.tsx`
    - Add email input field with validation
    - Add "Send Reset Link" button
    - Display loading state during submission
    - Show confirmation message after submission
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  
  - [x]* 11.2 Write property test for password reset flow
    - **Property 19: Password Reset Flow**
    - **Validates: Requirements 8.3, 8.4, 15.6**
  
  - [x] 11.3 Create ForgotPasswordPage component
    - Create file: `client/src/features/auth/pages/ForgotPasswordPage.tsx`
    - Wrap ForgotPasswordForm with layout
    - Display EduOS logo
    - Show "Reset Password" heading
    - Add "Back to login" link
    - Include footer
    - _Requirements: 8.1, 8.2, 13.1, 13.5_

- [ ] 12. Implement contact administrator feature
  - [x] 12.1 Create ContactAdminLink component
    - Create file: `client/src/features/auth/components/ContactAdminLink.tsx`
    - Display "Contact administrator" link at bottom of login form
    - Handle click to show contact modal or information
    - _Requirements: 14.1, 14.2_
  
  - [x] 12.2 Implement contact information display logic
    - Show tenant-specific contact info when tenant is selected
    - Show generic EduOS support info when no tenant selected
    - _Requirements: 14.3, 14.4_
  
  - [x]* 12.3 Write property test for contact administrator display
    - **Property 33: Contact Administrator Display**
    - **Validates: Requirements 14.2, 14.3, 14.4**
  
  - [ ] 12.4 Create support form (optional)
    - Add form fields for name, email, message
    - Submit inquiry to backend
    - _Requirements: 14.5_
  
  - [x]* 12.5 Write property test for support form submission
    - **Property 34: Support Form Submission**
    - **Validates: Requirements 14.5**

- [x] 13. Implement responsive design and styling
  - [x] 13.1 Create AuthLayout component
    - Create file: `client/src/features/auth/components/AuthLayout.tsx`
    - Implement responsive card layout (centered on desktop, full-width on mobile)
    - Add EduOS logo in top-left
    - Style with white background, subtle shadow, rounded corners
    - Apply responsive breakpoints (1920px, 768px, 375px)
    - _Requirements: 11.1, 11.2, 11.3, 13.1, 13.2_
  
  - [x]* 13.2 Write unit tests for responsive breakpoints
    - Test desktop layout (1920px+): 480px centered card
    - Test tablet layout (768-1919px): 90% width centered card
    - Test mobile layout (<768px): full-width with 16px margins
    - **Validates: Requirements 11.1, 11.2, 11.3**
  
  - [x] 13.3 Create Footer component
    - Create file: `client/src/shared/components/Footer.tsx`
    - Add "Terms of Service" link
    - Add "Privacy Policy" link
    - Add copyright text with current year
    - Style with appropriate spacing and colors
    - _Requirements: 13.5_
  
  - [x] 13.4 Apply consistent styling to all components
    - Use primary indigo color (#4F46E5) for buttons and links
    - Apply 48px height to all input fields
    - Use light borders with rounded corners
    - Ensure generous padding (48px card padding)
    - _Requirements: 13.2, 13.3, 13.4_
  
  - [x]* 13.5 Write property test for brand color consistency
    - **Property 31: Brand Color Consistency**
    - **Validates: Requirements 13.3**
  
  - [x]* 13.6 Write property test for input field styling consistency
    - **Property 32: Input Field Styling Consistency**
    - **Validates: Requirements 13.4**

- [x] 14. Implement accessibility features
  - [x] 14.1 Add keyboard navigation support
    - Ensure Tab key navigates through all interactive elements in logical order
    - Implement Enter key submission for forms
    - Add Escape key to close dropdowns and modals
    - _Requirements: 12.1, 12.2_
  
  - [x]* 14.2 Write property test for keyboard navigation
    - **Property 26: Keyboard Navigation**
    - **Validates: Requirements 12.1**
  
  - [x]* 14.3 Write property test for keyboard form submission
    - **Property 27: Keyboard Form Submission**
    - **Validates: Requirements 12.2**
  
  - [x] 14.4 Add ARIA attributes to all components
    - Add aria-label to all inputs and buttons
    - Add aria-describedby to link errors with fields
    - Add aria-live regions for dynamic content
    - Add aria-invalid for validation errors
    - _Requirements: 12.3_
  
  - [x]* 14.5 Write property test for screen reader accessibility
    - **Property 28: Screen Reader Accessibility**
    - **Validates: Requirements 12.3**
  
  - [x] 14.6 Implement focus management
    - Set focus to first invalid field on error
    - Maintain focus visibility with outline styles
    - Manage focus when navigating between screens
    - _Requirements: 12.4_
  
  - [x]* 14.7 Write property test for error focus management
    - **Property 29: Error Focus Management**
    - **Validates: Requirements 12.4**
  
  - [x] 14.8 Ensure color contrast compliance
    - Verify all text has 4.5:1 contrast ratio
    - Test with high contrast mode
    - Use both color and icons for error states
    - _Requirements: 12.5_
  
  - [x]* 14.9 Write property test for color contrast compliance
    - **Property 30: Color Contrast Compliance**
    - **Validates: Requirements 12.5**
  
  - [x] 14.10 Ensure touch target sizing on mobile
    - Set minimum 44x44px for all interactive elements
    - Add appropriate padding to buttons and links
    - Test on actual mobile devices
    - _Requirements: 11.4_
  
  - [x]* 14.11 Write property test for touch target sizing
    - **Property 24: Touch Target Sizing**
    - **Validates: Requirements 11.4**

- [x] 15. Checkpoint - Ensure all component tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Implement routing and navigation
  - [x] 16.1 Set up React Router
    - Create file: `client/src/App.tsx` with router configuration
    - Create routes for /login, /mfa, /forgot-password, /auth/callback
    - Implement protected route wrapper for authenticated pages
    - Handle SSO callback route
    - _Requirements: 2.5, 2.6, 4.4, 8.1_
  
  - [x] 16.2 Implement navigation logic
    - Redirect to dashboard on successful authentication
    - Navigate to MFA screen when MFA is required
    - Navigate to forgot password screen from login
    - Handle back navigation appropriately
    - _Requirements: 2.5, 2.6, 8.1_
  
  - [x]* 16.3 Write property test for MFA flow transition
    - **Property 8: MFA Flow Transition**
    - **Validates: Requirements 2.6**

- [x] 17. Implement error handling and recovery
  - [x] 17.1 Create error mapping utility
    - Create file: `client/src/features/auth/utils/errorMapper.ts`
    - Map backend error codes to user-friendly messages
    - Handle placeholder replacement (e.g., {minutes} in rate limit)
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [x]* 17.2 Write unit tests for error message mapping
    - Test INVALID_CREDENTIALS → "Invalid email or password"
    - Test ACCOUNT_LOCKED → "Account locked. Contact your administrator"
    - Test NETWORK_ERROR → "Connection error. Please try again"
    - Test RATE_LIMITED → "Too many attempts. Please wait X minutes"
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
  
  - [x]* 17.3 Write property test for error message mapping
    - **Property 15: Error Message Mapping**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
  
  - [x] 17.4 Implement network error handling
    - Add retry logic with exponential backoff
    - Display toast notifications for network errors
    - Provide "Retry" button
    - _Requirements: 6.3_
  
  - [x] 17.5 Implement session expiration handling
    - Detect expired tokens on API calls
    - Clear session and redirect to login
    - Show "Session expired" message
    - Preserve redirect URL for post-login navigation
    - _Requirements: 9.4_

- [x] 18. Integration and end-to-end testing
  - [x]* 18.1 Write integration test for complete login flow
    - Test: select tenant → enter credentials → submit → redirect to dashboard
    - **Validates: Requirements 1.4, 2.4, 2.5**
  
  - [x]* 18.2 Write integration test for MFA flow
    - Test: login → MFA required → enter OTP → verify → redirect to dashboard
    - **Validates: Requirements 2.6, 3.2, 3.3**
  
  - [x]* 18.3 Write integration test for SSO flow
    - Test: select tenant → click SSO button → redirect → callback → redirect to dashboard
    - **Validates: Requirements 4.2, 4.4, 4.5**
  
  - [x]* 18.4 Write integration test for password reset flow
    - Test: click forgot password → enter email → submit → confirmation
    - **Validates: Requirements 8.1, 8.3, 8.4**
  
  - [x]* 18.5 Write integration test for error scenarios
    - Test invalid credentials error handling
    - Test network error handling
    - Test CAPTCHA trigger and enforcement
    - **Validates: Requirements 6.1, 6.5, 7.1, 7.2**

- [x] 19. Accessibility audit and testing
  - [x]* 19.1 Run axe-core accessibility tests
    - Test all pages with jest-axe
    - Fix any violations found
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5**
  
  - [x]* 19.2 Manual keyboard navigation testing
    - Test Tab navigation through all forms
    - Test Enter key submission
    - Test Escape key for dropdowns
    - **Validates: Requirements 12.1, 12.2**
  
  - [x]* 19.3 Manual screen reader testing
    - Test with NVDA or JAWS
    - Verify all announcements are clear
    - Verify error announcements work
    - **Validates: Requirements 12.3, 12.4**

- [x] 20. Final checkpoint - Ensure all tests pass
  - Run full test suite (unit, property, integration, accessibility)
  - Verify 80%+ code coverage
  - Fix any failing tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 21. Documentation and cleanup
  - [x] 21.1 Add JSDoc comments to all public functions and components
    - Document props, return types, and behavior
    - Add usage examples where helpful
  
  - [x] 21.2 Create README for the frontend
    - Create file: `client/README.md`
    - Document component usage
    - Explain authentication flow
    - Provide setup instructions
    - Include development and build commands
  
  - [x] 21.3 Clean up console.log statements and debug code
    - Remove or replace with proper logging
    - Ensure no sensitive data is logged

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties across all inputs
- Unit tests validate specific examples and edge cases
- Integration tests validate complete user flows
- Accessibility testing ensures WCAG 2.1 AA compliance
- All tests should run in CI pipeline with 80% minimum coverage
