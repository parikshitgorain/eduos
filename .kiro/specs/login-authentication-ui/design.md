# Design Document: Login & Authentication UI

## Overview

The Login & Authentication UI is a React-based single-page application that provides the primary authentication interface for the EduOS platform. The design follows a component-based architecture with clear separation between presentation, state management, and API integration layers.

The interface consists of several key screens:
- **Main Login Screen**: Institution selection, email/password inputs, SSO buttons
- **MFA Verification Screen**: OTP input for two-factor authentication
- **Password Recovery Screen**: Email input for password reset requests

The design prioritizes security, accessibility, and user experience while integrating seamlessly with existing backend authentication APIs. All components are built with React and styled using Tailwind CSS to match the provided design specifications.

### Technology Stack

- **Frontend Framework**: React.js 18+ with TypeScript
- **Build Tool**: Vite 5+ for fast development and optimized builds
- **Styling**: Tailwind CSS 3+ with custom theme configuration
- **Form Management**: React Hook Form with Zod validation
- **HTTP Client**: Axios with interceptors for token management
- **State Management**: React Context API for authentication state
- **Routing**: React Router v6 for navigation
- **Icons**: Heroicons for UI icons, brand logos for SSO providers
- **Testing**: Vitest for unit tests, React Testing Library for component tests

### Project Structure

The frontend lives in a separate `client/` directory, independent from the backend:

```
eduos-platform/
├── src/                          # Backend (Node.js/Express)
│   ├── config/
│   ├── middleware/
│   ├── routes/
│   ├── services/
│   └── server.js
│
├── client/                       # Frontend (React + TypeScript)
│   ├── src/
│   │   ├── features/            # Feature-based organization
│   │   │   └── auth/            # Authentication feature
│   │   │       ├── components/  # UI components
│   │   │       ├── hooks/       # Custom hooks
│   │   │       ├── services/    # API integration
│   │   │       ├── types/       # TypeScript types
│   │   │       └── utils/       # Utilities
│   │   ├── shared/              # Shared components
│   │   │   ├── components/      # Reusable UI components
│   │   │   ├── hooks/           # Reusable hooks
│   │   │   └── utils/           # Shared utilities
│   │   ├── config/              # App configuration
│   │   ├── App.tsx              # Root component
│   │   ├── main.tsx             # Entry point
│   │   └── vite-env.d.ts        # Vite types
│   ├── public/                  # Static assets
│   ├── package.json             # Frontend dependencies
│   ├── tsconfig.json            # TypeScript config
│   ├── vite.config.ts           # Vite config
│   ├── tailwind.config.js       # Tailwind config
│   └── postcss.config.js        # PostCSS config
│
├── database/                     # Database migrations
├── ai-service/                   # AI microservice
├── docs/                         # Documentation
├── package.json                  # Backend dependencies
└── docker-compose.yml            # Multi-service orchestration
```

### Development Workflow

**Backend Development:**
```bash
# From project root
npm run dev
# Backend runs on http://localhost:3000
```

**Frontend Development:**
```bash
# From client directory
cd client
npm run dev
# Frontend runs on http://localhost:5173
# API calls proxied to http://localhost:3000
```

**Full Stack Development:**
```bash
# Terminal 1: Backend
npm run dev

# Terminal 2: Frontend
cd client && npm run dev
```

## Architecture

### Component Hierarchy

```
App
├── AuthProvider (Context)
│   └── AuthLayout
│       ├── LoginPage
│       │   ├── LoginForm
│       │   │   ├── TenantSelector
│       │   │   ├── EmailInput
│       │   │   ├── PasswordInput
│       │   │   │   └── PasswordToggle
│       │   │   ├── RememberMeCheckbox
│       │   │   ├── ForgotPasswordLink
│       │   │   ├── SignInButton
│       │   │   └── CaptchaWidget (conditional)
│       │   ├── SSOButtons
│       │   │   ├── GoogleSignInButton
│       │   │   └── MicrosoftSignInButton
│       │   └── ContactAdminLink
│       ├── MFAPage
│       │   └── MFAForm
│       │       ├── OTPInput
│       │       └── ResendCodeButton
│       └── ForgotPasswordPage
│           └── ForgotPasswordForm
│               ├── EmailInput
│               └── SubmitButton
└── Footer
    ├── TermsLink
    ├── PrivacyLink
    └── Copyright
```

### Layer Architecture

**Presentation Layer** (Components)
- Responsible for rendering UI elements
- Receives data and callbacks via props
- No direct API calls or business logic
- Fully accessible with ARIA attributes

**State Management Layer** (Context + Hooks)
- `AuthContext`: Global authentication state (user, token, loading, error)
- `useAuth`: Hook for accessing authentication state and actions
- `useForm`: React Hook Form integration for form state
- `useValidation`: Custom validation logic

**Service Layer** (API Integration)
- `authService`: Handles all authentication API calls
- `tenantService`: Handles tenant search API calls
- `tokenService`: Manages JWT token storage and retrieval
- `apiClient`: Axios instance with interceptors

**Utility Layer**
- `validators`: Form validation functions
- `errorHandlers`: Error message mapping
- `storage`: Secure storage utilities
- `accessibility`: ARIA helpers and keyboard navigation utilities

### Data Flow

1. **User Input** → Component captures input via React Hook Form
2. **Validation** → Real-time validation using Zod schemas
3. **Submission** → Form handler calls service layer method
4. **API Call** → Service layer makes HTTP request via Axios
5. **Response** → Service layer returns data or throws error
6. **State Update** → Context updates authentication state
7. **UI Update** → Components re-render based on new state
8. **Navigation** → Router navigates to appropriate screen

## Components and Interfaces

### Core Components

#### LoginForm Component

**Purpose**: Main authentication form with institution selection, email/password inputs, and submission logic.

**Props**:
```typescript
interface LoginFormProps {
  onSuccess: (token: string) => void;
  onMFARequired: (sessionId: string) => void;
}
```

**State**:
```typescript
interface LoginFormState {
  tenantId: string | null;
  email: string;
  password: string;
  rememberMe: boolean;
  showPassword: boolean;
  failedAttempts: number;
  showCaptcha: boolean;
  isLoading: boolean;
  error: string | null;
}
```

**Behavior**:
- Validates all inputs in real-time using Zod schemas
- Disables submit button until all fields are valid
- Shows CAPTCHA after 3 failed attempts
- Displays loading state during API calls
- Handles authentication errors with appropriate messages
- Clears password field on error for security

#### TenantSelector Component

**Purpose**: Searchable dropdown for institution selection with debounced API calls.

**Props**:
```typescript
interface TenantSelectorProps {
  value: string | null;
  onChange: (tenantId: string, tenantName: string) => void;
  error?: string;
}
```

**State**:
```typescript
interface TenantSelectorState {
  query: string;
  results: Tenant[];
  isSearching: boolean;
  isOpen: boolean;
  selectedIndex: number;
}
```

**Behavior**:
- Debounces search queries (300ms delay)
- Queries API when user types 2+ characters
- Displays loading spinner during search
- Shows "No results" message when appropriate
- Supports keyboard navigation (Arrow keys, Enter, Escape)
- Closes dropdown on selection or blur

#### MFAForm Component

**Purpose**: One-time password input for multi-factor authentication verification.

**Props**:
```typescript
interface MFAFormProps {
  sessionId: string;
  onSuccess: (token: string) => void;
  onCancel: () => void;
}
```

**State**:
```typescript
interface MFAFormState {
  otp: string;
  isVerifying: boolean;
  error: string | null;
  canResend: boolean;
  resendCountdown: number;
}
```

**Behavior**:
- Auto-submits when 6 digits are entered
- Validates OTP format (6 numeric digits)
- Shows countdown timer for resend button (60 seconds)
- Displays verification errors
- Allows user to return to login screen

#### PasswordInput Component

**Purpose**: Secure password input with show/hide toggle and strength indicator.

**Props**:
```typescript
interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  showStrengthIndicator?: boolean;
}
```

**State**:
```typescript
interface PasswordInputState {
  showPassword: boolean;
  strength: 'weak' | 'medium' | 'strong';
}
```

**Behavior**:
- Masks password characters by default
- Toggles visibility on icon click
- Calculates password strength based on length, complexity
- Displays strength indicator with color coding
- Announces state changes to screen readers

#### SSOButtons Component

**Purpose**: Google and Microsoft sign-in buttons that initiate OAuth flows.

**Props**:
```typescript
interface SSOButtonsProps {
  tenantId: string | null;
  onError: (error: string) => void;
}
```

**Behavior**:
- Disabled until tenant is selected
- Initiates OAuth flow by redirecting to provider
- Handles OAuth callback and token exchange
- Displays loading state during redirect
- Shows errors if OAuth fails

### Service Interfaces

#### AuthService

```typescript
interface AuthService {
  login(credentials: LoginCredentials): Promise<LoginResponse>;
  verifyMFA(sessionId: string, otp: string): Promise<AuthToken>;
  initiateSSO(provider: 'google' | 'microsoft', tenantId: string): Promise<string>;
  handleSSOCallback(code: string, state: string): Promise<AuthToken>;
  forgotPassword(email: string): Promise<void>;
  logout(): Promise<void>;
}

interface LoginCredentials {
  tenantId: string;
  email: string;
  password: string;
  captchaToken?: string;
}

interface LoginResponse {
  requiresMFA: boolean;
  sessionId?: string;
  token?: string;
}

interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
```

#### TenantService

```typescript
interface TenantService {
  searchTenants(query: string): Promise<Tenant[]>;
  getTenantById(id: string): Promise<Tenant>;
}

interface Tenant {
  id: string;
  name: string;
  location: string;
  logoUrl?: string;
}
```

#### TokenService

```typescript
interface TokenService {
  setToken(token: string, rememberMe: boolean): void;
  getToken(): string | null;
  clearToken(): void;
  isTokenValid(): boolean;
  getTokenExpiration(): Date | null;
}
```

### API Integration

#### Backend API Base URL

**Development:**
- Backend: `http://localhost:3000`
- Frontend: `http://localhost:5173`
- API Proxy: Vite proxies `/api/*` requests to backend

**Production:**
- Backend: `https://api.eduos.com` (or your backend domain)
- Frontend: `https://app.eduos.com` (or your frontend domain)
- CORS: Configured on backend to allow frontend domain

#### Vite Proxy Configuration

```typescript
// client/vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

#### Endpoint Mappings

**POST /api/v1/auth/login**
```typescript
Request: {
  tenantId: string;
  email: string;
  password: string;
  captchaToken?: string;
}

Response: {
  success: boolean;
  requiresMFA: boolean;
  sessionId?: string;
  token?: string;
  message?: string;
}
```

**POST /api/v1/auth/mfa/verify**
```typescript
Request: {
  sessionId: string;
  otp: string;
}

Response: {
  success: boolean;
  token: string;
  message?: string;
}
```

**GET /api/v1/tenants/search?q={query}**
```typescript
Response: {
  tenants: Array<{
    id: string;
    name: string;
    location: string;
    logoUrl?: string;
  }>;
}
```

**POST /api/v1/auth/forgot-password**
```typescript
Request: {
  email: string;
  tenantId?: string;
}

Response: {
  success: boolean;
  message: string;
}
```

**GET /api/v1/auth/sso/google**
```typescript
Query Parameters: {
  tenantId: string;
  redirectUri: string;
}

Response: {
  authorizationUrl: string;
}
```

**GET /api/v1/auth/sso/microsoft**
```typescript
Query Parameters: {
  tenantId: string;
  redirectUri: string;
}

Response: {
  authorizationUrl: string;
}
```

## Data Models

### Form Data Models

```typescript
// Login form data
interface LoginFormData {
  tenantId: string;
  email: string;
  password: string;
  rememberMe: boolean;
  captchaToken?: string;
}

// MFA form data
interface MFAFormData {
  otp: string;
}

// Forgot password form data
interface ForgotPasswordFormData {
  email: string;
}
```

### Validation Schemas (Zod)

```typescript
const loginSchema = z.object({
  tenantId: z.string().min(1, 'Please select an institution'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean(),
  captchaToken: z.string().optional(),
});

const mfaSchema = z.object({
  otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});
```

### Authentication State Model

```typescript
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface User {
  id: string;
  email: string;
  name: string;
  tenantId: string;
  tenantName: string;
  roles: string[];
}
```

### Error Model

```typescript
interface AuthError {
  code: string;
  message: string;
  field?: string;
}

// Error code mappings
const ERROR_MESSAGES: Record<string, string> = {
  'INVALID_CREDENTIALS': 'Invalid email or password',
  'ACCOUNT_LOCKED': 'Account locked. Contact your administrator',
  'NETWORK_ERROR': 'Connection error. Please try again',
  'RATE_LIMITED': 'Too many attempts. Please wait {minutes} minutes',
  'INVALID_OTP': 'Invalid verification code',
  'OTP_EXPIRED': 'Verification code expired. Request a new one',
  'TENANT_NOT_FOUND': 'Institution not found',
  'CAPTCHA_REQUIRED': 'Please complete the CAPTCHA',
  'CAPTCHA_FAILED': 'CAPTCHA verification failed',
};
```

### Session Storage Model

```typescript
interface StoredSession {
  token: string;
  expiresAt: number;
  rememberMe: boolean;
}
```

## Correctness Properties


*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Tenant Search API Integration

*For any* search query with 2 or more characters, the Tenant_Selector should call the GET /api/v1/tenants/search endpoint with the query parameter and display the returned results with institution name and location.

**Validates: Requirements 1.2, 1.3, 15.1**

### Property 2: Tenant Selection State Management

*For any* selected institution, the Tenant_Selector should store the tenant ID in form state and enable all remaining form fields.

**Validates: Requirements 1.4**

### Property 3: Email Validation

*For any* string input in the email field, the Validation_Engine should validate the email format in real-time and display an inline error message for invalid formats.

**Validates: Requirements 2.1, 5.1**

### Property 4: Password Masking and Toggle

*For any* password input, the PasswordInput component should mask characters by default, and toggling visibility twice should return to the masked state (idempotence).

**Validates: Requirements 2.2, 2.3**

### Property 5: Form Validation State

*For any* form state, the "Sign In" button should be enabled if and only if all required fields (tenantId, email, password) are valid according to their validation schemas.

**Validates: Requirements 5.2, 5.4, 5.5**

### Property 6: Password Strength Calculation

*For any* password string, the Validation_Engine should calculate and display a strength indicator (weak/medium/strong) based on length and complexity.

**Validates: Requirements 5.3**

### Property 7: Authentication Flow with Token Storage

*For any* valid login credentials, when authentication succeeds without MFA, the Session_Manager should store the JWT token and redirect to the dashboard.

**Validates: Requirements 2.4, 2.5, 9.1**

### Property 8: MFA Flow Transition

*For any* valid login credentials, when authentication succeeds with MFA enabled, the Login_Form should transition to the MFA_Screen with the session ID.

**Validates: Requirements 2.6**

### Property 9: OTP Auto-Submit

*For any* 6-digit numeric string entered in the MFA_Screen, the form should automatically submit for verification.

**Validates: Requirements 3.2**

### Property 10: MFA Verification Flow

*For any* valid OTP code, the MFA verification should complete authentication and return a session token that is stored by the Session_Manager.

**Validates: Requirements 3.3**

### Property 11: MFA Error Handling

*For any* invalid OTP code, the Error_Display should show an error message and allow the user to retry without navigating away.

**Validates: Requirements 3.4**

### Property 12: MFA Resend Functionality

*For any* MFA session, when the user requests a new code, the system should trigger the backend to resend the OTP and start a 60-second countdown before allowing another resend.

**Validates: Requirements 3.5**

### Property 13: SSO Initiation

*For any* SSO provider (Google or Microsoft), when a user clicks the SSO button with a valid tenant selected, the system should call the appropriate API endpoint and redirect to the provider's authorization URL.

**Validates: Requirements 4.2, 15.4, 15.5**

### Property 14: SSO Callback Handling

*For any* authorization code received from an SSO provider, the system should exchange it for a session token and store it via the Session_Manager.

**Validates: Requirements 4.4, 4.5**

### Property 15: Error Message Mapping

*For any* authentication error code returned by the backend, the Error_Display should show the corresponding user-friendly error message from the ERROR_MESSAGES mapping.

**Validates: Requirements 6.1, 6.2, 6.3, 6.4**

### Property 16: Password Field Security Clearing

*For any* authentication error (invalid credentials, network error, rate limit, etc.), the Login_Form should clear the password field for security.

**Validates: Requirements 6.5**

### Property 17: CAPTCHA Enforcement

*For any* login attempt when the CAPTCHA_Widget is displayed, the form should require a valid CAPTCHA token before allowing submission to the authentication API.

**Validates: Requirements 7.2, 7.3**

### Property 18: Failed Attempt Counter Reset

*For any* successful authentication after CAPTCHA display, the system should reset the failed attempt counter to zero.

**Validates: Requirements 7.5**

### Property 19: Password Reset Flow

*For any* email address submitted on the forgot password screen, the system should call POST /api/v1/auth/forgot-password and display a confirmation message.

**Validates: Requirements 8.3, 8.4, 15.6**

### Property 20: Remember Me Token Expiration

*For any* successful authentication, the Session_Manager should set token expiration to 30 days when "Remember me" is checked, and 24 hours when unchecked.

**Validates: Requirements 9.2, 9.3**

### Property 21: Token Expiration Handling

*For any* expired token, the Session_Manager should clear the session and redirect to the login page.

**Validates: Requirements 9.4**

### Property 22: Logout Session Cleanup

*For any* logout action, the Session_Manager should clear all authentication tokens and session data from storage.

**Validates: Requirements 9.5**

### Property 23: Loading State Management

*For any* asynchronous operation (login, MFA verify, tenant search, SSO initiation), the UI should display a loading indicator, disable all inputs during the operation, and remove the indicator when complete.

**Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5**

### Property 24: Touch Target Sizing

*For any* interactive element (button, link, input, checkbox) on mobile devices, the element should have a minimum touch target size of 44x44px.

**Validates: Requirements 11.4**

### Property 25: Vertical Scrolling

*For any* viewport height where content overflows, the Login_Form should enable vertical scrolling to access all content.

**Validates: Requirements 11.5**

### Property 26: Keyboard Navigation

*For any* interactive element in the Login_Form, the element should be reachable via Tab key navigation in logical order.

**Validates: Requirements 12.1**

### Property 27: Keyboard Form Submission

*For any* form state where the "Sign In" button is enabled, pressing Enter should submit the form.

**Validates: Requirements 12.2**

### Property 28: Screen Reader Accessibility

*For any* form field, error message, and state change, the component should include appropriate ARIA attributes (aria-label, aria-describedby, aria-live) for screen reader announcement.

**Validates: Requirements 12.3**

### Property 29: Error Focus Management

*For any* validation error, the Error_Display should set focus to the first invalid field to aid keyboard and screen reader users.

**Validates: Requirements 12.4**

### Property 30: Color Contrast Compliance

*For any* text element in the Login_Form, the contrast ratio between text and background should be at least 4.5:1 to meet WCAG 2.1 AA standards.

**Validates: Requirements 12.5**

### Property 31: Brand Color Consistency

*For any* interactive element (button, link), the component should apply the primary indigo color (#4F46E5) consistently.

**Validates: Requirements 13.3**

### Property 32: Input Field Styling Consistency

*For any* input field (email, password, institution), the component should apply consistent styling (light borders, rounded corners, 48px height).

**Validates: Requirements 13.4**

### Property 33: Contact Administrator Display

*For any* tenant selection state, clicking "Contact administrator" should display tenant-specific contact information when a tenant is selected, or generic EduOS support information when no tenant is selected.

**Validates: Requirements 14.2, 14.3, 14.4**

### Property 34: Support Form Submission

*For any* support inquiry submitted via the contact form, the system should send the inquiry to the appropriate administrator based on the selected tenant.

**Validates: Requirements 14.5**

### Property 35: Login API Integration

*For any* login form submission with valid data, the Login_Form should call POST /api/v1/auth/login with the correct payload structure (tenantId, email, password, optional captchaToken).

**Validates: Requirements 15.2**

### Property 36: MFA API Integration

*For any* OTP submission, the MFA_Screen should call POST /api/v1/auth/mfa/verify with the session ID and OTP code.

**Validates: Requirements 15.3**

## Error Handling

### Client-Side Error Handling

**Validation Errors**:
- Display inline error messages below the relevant field
- Use red text color (#EF4444) for error messages
- Show error icon next to the message
- Prevent form submission until errors are resolved
- Clear errors when user corrects the input

**Network Errors**:
- Display a toast notification at the top of the screen
- Show "Connection error. Please try again" message
- Provide a "Retry" button for failed requests
- Log errors to console for debugging
- Implement exponential backoff for retries (1s, 2s, 4s)

**API Errors**:
- Map backend error codes to user-friendly messages
- Display error messages in the Error_Display component
- Clear password field on authentication errors
- Provide actionable guidance (e.g., "Contact administrator")
- Log full error details to console for debugging

### Backend Error Response Handling

```typescript
interface APIError {
  code: string;
  message: string;
  field?: string;
  details?: Record<string, any>;
}

function handleAPIError(error: APIError): string {
  // Map error codes to user-friendly messages
  const message = ERROR_MESSAGES[error.code] || 'An unexpected error occurred';
  
  // Replace placeholders (e.g., {minutes} in rate limit message)
  if (error.details) {
    return message.replace(/\{(\w+)\}/g, (_, key) => error.details[key] || '');
  }
  
  return message;
}
```

### Error Recovery Strategies

**Failed Login Attempts**:
1. Display error message
2. Clear password field
3. Increment failed attempt counter
4. Show CAPTCHA after 3 failures
5. Reset counter on successful login

**Expired Sessions**:
1. Detect expired token on API call
2. Clear session data
3. Redirect to login page
4. Show "Session expired. Please log in again" message
5. Preserve redirect URL for post-login navigation

**Network Timeouts**:
1. Set 30-second timeout for all API calls
2. Show timeout error message
3. Provide "Retry" button
4. Log timeout for monitoring
5. Suggest checking internet connection

### Accessibility Error Handling

- Announce errors to screen readers using aria-live regions
- Set focus to the first invalid field
- Provide clear, descriptive error messages
- Use both color and icons to indicate errors (not color alone)
- Ensure error messages have sufficient contrast ratio

## Testing Strategy

### Dual Testing Approach

The testing strategy employs both unit tests and property-based tests to ensure comprehensive coverage:

**Unit Tests**: Verify specific examples, edge cases, and error conditions. Focus on:
- Specific UI rendering scenarios (logo display, button presence)
- Specific error messages for known error codes
- Specific responsive breakpoints (desktop, tablet, mobile)
- Integration between components
- Edge cases like empty search results, no tenant selected

**Property-Based Tests**: Verify universal properties across all inputs. Focus on:
- Form validation working correctly for any input
- API integration working correctly for any valid data
- State management working correctly for any state transition
- Accessibility features working for any component
- Error handling working for any error type

Together, these approaches provide comprehensive coverage: unit tests catch concrete bugs in specific scenarios, while property tests verify general correctness across the input space.

### Property-Based Testing Configuration

**Library**: fast-check (for TypeScript/JavaScript)

**Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with feature name and property number
- Tag format: `Feature: login-authentication-ui, Property {N}: {property text}`

**Example Property Test**:
```typescript
import fc from 'fast-check';

// Feature: login-authentication-ui, Property 3: Email Validation
test('email validation works for any input string', () => {
  fc.assert(
    fc.property(fc.string(), (input) => {
      const result = validateEmail(input);
      const isValidFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
      expect(result.isValid).toBe(isValidFormat);
    }),
    { numRuns: 100 }
  );
});
```

### Test Coverage Requirements

**Component Tests**:
- LoginForm: rendering, validation, submission, error handling
- TenantSelector: search, selection, keyboard navigation
- PasswordInput: masking, toggle, strength indicator
- MFAForm: OTP input, auto-submit, resend functionality
- SSOButtons: provider selection, redirect initiation

**Service Tests**:
- authService: all API calls, error handling, token management
- tenantService: search API, result parsing
- tokenService: storage, retrieval, expiration checking
- validators: email, password, OTP validation

**Integration Tests**:
- Complete login flow (tenant selection → credentials → success)
- MFA flow (login → MFA screen → verification → success)
- SSO flow (button click → redirect → callback → success)
- Password reset flow (forgot password → email → confirmation)
- Error scenarios (invalid credentials, network errors, rate limiting)

**Accessibility Tests**:
- Keyboard navigation through all interactive elements
- Screen reader announcements for all state changes
- Focus management on errors
- Color contrast ratios
- Touch target sizes on mobile

### Testing Tools

- **Vitest**: Test runner and assertion library
- **React Testing Library**: Component testing utilities
- **fast-check**: Property-based testing library
- **MSW (Mock Service Worker)**: API mocking for tests
- **axe-core**: Accessibility testing
- **jest-axe**: Accessibility assertions for tests

### Continuous Integration

- Run all tests on every commit
- Enforce 90% code coverage minimum
- Run accessibility tests in CI pipeline
- Test against multiple browsers (Chrome, Firefox, Safari, Edge)
- Test responsive layouts at standard breakpoints
- Generate coverage reports and accessibility reports
