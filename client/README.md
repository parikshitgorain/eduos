# EduOS Platform - Frontend (Login & Authentication UI)

## Overview

This is the React-based frontend application for the EduOS Platform, providing a secure, accessible, and user-friendly authentication interface.

## Tech Stack

- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite 5+
- **Styling**: Tailwind CSS 3+
- **Form Management**: React Hook Form with Zod validation
- **HTTP Client**: Axios with interceptors
- **State Management**: React Context API
- **Routing**: React Router v6
- **Icons**: Heroicons
- **Testing**: Vitest + React Testing Library

## Project Structure

```
client/
├── src/
│   ├── features/auth/          # Authentication feature
│   │   ├── components/         # UI components (LoginForm, PasswordInput, TenantSelector)
│   │   ├── context/            # AuthContext and AuthProvider
│   │   ├── hooks/              # useAuth hook
│   │   ├── services/           # API services (authService, tenantService, tokenService)
│   │   ├── types/              # TypeScript interfaces
│   │   ├── utils/              # Validation schemas, password strength
│   │   └── pages/              # LoginPage
│   ├── shared/                 # Shared components
│   │   └── components/         # ErrorDisplay, LoadingIndicator
│   ├── config/                 # Configuration
│   │   └── apiClient.ts        # Axios client with interceptors
│   ├── App.tsx                 # Main app with routing
│   ├── main.tsx                # Entry point
│   └── index.css               # Global styles with Tailwind
├── public/                     # Static assets
├── package.json                # Dependencies
├── vite.config.ts              # Vite configuration
├── tailwind.config.js          # Tailwind configuration
└── tsconfig.json               # TypeScript configuration
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Backend API running on `http://localhost:3000`

### Installation

```bash
cd client
npm install
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173/`

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

### Lint

```bash
npm run lint
```

## Features Implemented

### ✅ Authentication Services
- Login with email and password
- MFA verification support
- SSO integration (Google, Microsoft)
- Password reset flow
- Token management with expiration
- Session management with expiration handling
- Session expired redirect with URL preservation

### ✅ UI Components
- **LoginForm**: Complete login form with validation
- **MFAForm**: Two-factor authentication with 6-digit OTP input
- **ForgotPasswordForm**: Password reset request form
- **PasswordInput**: Secure input with show/hide toggle and strength indicator
- **TenantSelector**: Searchable institution dropdown with debouncing
- **SSOButtons**: Google and Microsoft sign-in buttons
- **ContactAdminLink**: Support contact modal with tenant-specific info
- **CaptchaWidget**: Google reCAPTCHA v2 integration
- **ErrorDisplay**: Inline error messages with icons
- **LoadingIndicator**: Spinner animations for loading states
- **Toast**: Toast notifications for errors and success messages
- **AuthLayout**: Responsive layout wrapper for auth pages

### ✅ Form Validation
- Real-time validation with Zod schemas
- Email format validation
- Password strength calculation
- Required field validation
- Form state management with React Hook Form
- 6-digit OTP validation

### ✅ Security Features
- CAPTCHA integration (after 3 failed attempts)
- Password field clearing on errors
- Token storage with expiration
- Remember me functionality (30 days vs 24 hours)
- Secure HTTP-only cookie support
- Session expiration detection and handling
- Automatic redirect to login on session expiry

### ✅ Error Handling
- Network error detection with retry logic
- Exponential backoff for failed requests (1s, 2s, 4s, 8s)
- Toast notifications for errors
- User-friendly error messages
- Error mapping from backend codes
- Session expiration handling

### ✅ User Experience
- Responsive design (mobile, tablet, desktop)
- Loading states during API calls
- Clear error messages
- Keyboard navigation support (Tab, Enter, Escape)
- Screen reader accessibility (ARIA attributes)
- Focus management on errors
- Color contrast compliance (WCAG 2.1 AA)
- Touch target sizing (44x44px minimum)
- Smooth transitions between screens

### ✅ Routing & Navigation
- React Router v6 integration
- Protected routes for authenticated pages
- SSO callback handling
- Navigation between login, MFA, and forgot password screens
- Redirect to dashboard on successful authentication
- Back navigation support

## API Integration

The frontend communicates with the backend API at `http://localhost:3000/api/v1/`:

- `POST /auth/login` - Login with credentials
- `POST /auth/mfa/verify` - Verify MFA code
- `GET /auth/sso/google` - Initiate Google SSO
- `GET /auth/sso/microsoft` - Initiate Microsoft SSO
- `POST /auth/forgot-password` - Request password reset
- `GET /tenants/search` - Search for institutions

All API calls include:
- 30-second timeout
- Automatic token injection via interceptors
- Error handling with user-friendly messages
- Retry logic for network errors

## Testing

The project includes comprehensive test coverage with 329 passing tests:

### Test Types
- **Unit Tests**: Component rendering, validation logic, utility functions
- **Integration Tests**: Complete user flows (login, MFA, password reset)
- **Accessibility Tests**: Keyboard navigation, ARIA attributes, focus management
- **Error Handling Tests**: Network errors, validation errors, session expiration

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- LoginForm.test.tsx
```

### Test Coverage
- All components have unit tests
- All services have integration tests
- All utilities have unit tests
- Accessibility features are tested
- Error scenarios are covered

## Environment Variables

Create a `.env` file in the `client/` directory:

```env
VITE_API_URL=http://localhost:3000
VITE_RECAPTCHA_SITE_KEY=your_recaptcha_site_key_here
```

## Development Workflow

### Backend + Frontend Development

**Terminal 1 - Backend:**
```bash
# From project root
npm run dev
```

**Terminal 2 - Frontend:**
```bash
# From client directory
cd client
npm run dev
```

The frontend will proxy API requests to the backend automatically.

## Component Usage Examples

### LoginForm

```tsx
import { LoginForm } from './features/auth/components/LoginForm';

function LoginPage() {
  const handleSuccess = () => {
    navigate('/dashboard');
  };

  const handleMFARequired = (sessionId: string) => {
    navigate('/mfa', { state: { sessionId } });
  };

  return (
    <LoginForm
      onSuccess={handleSuccess}
      onMFARequired={handleMFARequired}
      onSubmit={login}
      onSSOInitiate={handleSSOInitiate}
    />
  );
}
```

### MFAForm

```tsx
import { MFAForm } from './features/auth/components/MFAForm';

function MFAPage() {
  const handleVerify = async (otp: string) => {
    await authService.verifyMFA({ sessionId, otp });
  };

  return (
    <MFAForm
      sessionId={sessionId}
      onVerify={handleVerify}
      onCancel={() => navigate('/login')}
    />
  );
}
```

### Toast Notifications

```tsx
import { useToast } from './shared/context/ToastContext';

function MyComponent() {
  const { showError, showSuccess } = useToast();

  const handleAction = async () => {
    try {
      await someAction();
      showSuccess('Action completed successfully');
    } catch (error) {
      showError('Action failed', {
        action: {
          label: 'Retry',
          onClick: handleAction
        }
      });
    }
  };
}
```

## Authentication Flow

### Standard Login Flow
1. User selects institution from TenantSelector
2. User enters email and password
3. Form validates inputs in real-time
4. On submit, calls `POST /api/v1/auth/login`
5. If MFA required, navigates to MFA page
6. If successful, stores token and redirects to dashboard

### MFA Flow
1. User enters 6-digit OTP code
2. Code auto-submits when complete
3. Calls `POST /api/v1/auth/mfa/verify`
4. On success, stores token and redirects to dashboard
5. On error, allows retry with countdown timer

### SSO Flow
1. User selects institution
2. User clicks Google or Microsoft button
3. Calls `GET /api/v1/auth/sso/{provider}`
4. Redirects to provider's authorization page
5. Provider redirects back to `/auth/callback`
6. Exchanges code for token
7. Stores token and redirects to dashboard

### Password Reset Flow
1. User clicks "Forgot password?" link
2. Navigates to forgot password page
3. User enters email address
4. Calls `POST /api/v1/auth/forgot-password`
5. Shows confirmation message
6. User receives reset link via email

### Session Expiration Flow
1. API returns 401 Unauthorized
2. Interceptor detects expired session
3. Clears local token storage
4. Stores current URL for redirect
5. Dispatches session-expired event
6. Shows "Session expired" message
7. Redirects to login page
8. After login, redirects back to original URL

## Next Steps

### Completed Features ✅
- ✅ Multi-tenant institution selection
- ✅ Email and password authentication
- ✅ MFA verification flow
- ✅ SSO integration (Google, Microsoft)
- ✅ Password recovery flow
- ✅ Form validation and error handling
- ✅ CAPTCHA security
- ✅ Session management
- ✅ Loading states and feedback
- ✅ Responsive design
- ✅ Accessibility features (WCAG 2.1 AA)
- ✅ Contact administrator feature
- ✅ Routing and navigation
- ✅ Network error handling with retry
- ✅ Session expiration handling
- ✅ Comprehensive testing (329 tests passing)

### Optional Enhancements
- Property-based testing for validation logic
- End-to-end testing with Playwright or Cypress
- Performance optimization (code splitting, lazy loading)
- Analytics integration
- Internationalization (i18n)
- Dark mode support

## Contributing

1. Follow the existing code structure
2. Use TypeScript for type safety
3. Write tests for new features
4. Follow Tailwind CSS conventions
5. Ensure accessibility compliance

## License

Copyright © 2026 EduOS. All rights reserved.
