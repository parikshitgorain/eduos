# React Router Setup - EduOS Authentication

## Overview

This document describes the React Router configuration for the EduOS Login & Authentication UI. The routing setup provides navigation between authentication pages, handles SSO callbacks, and protects authenticated routes.

## Route Structure

### Public Routes (No Authentication Required)

| Route | Component | Description |
|-------|-----------|-------------|
| `/login` | `LoginPage` | Main login page with institution selection, email/password inputs, and SSO buttons |
| `/mfa` | `MFAPage` | Multi-factor authentication verification page for entering OTP codes |
| `/forgot-password` | `ForgotPasswordPage` | Password recovery page for requesting reset links |
| `/auth/callback` | `SSOCallbackPage` | SSO callback handler for Google/Microsoft authentication |

### Protected Routes (Authentication Required)

| Route | Component | Description |
|-------|-----------|-------------|
| `/dashboard` | `DashboardPlaceholder` | Main dashboard (placeholder, to be implemented) |

### Special Routes

| Route | Behavior | Description |
|-------|----------|-------------|
| `/` | Redirect to `/login` | Root path redirects to login page |
| `*` | Redirect to `/login` | Catch-all for unknown routes |

## Implementation Details

### App.tsx Structure

```tsx
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public authentication routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/mfa" element={<MFAPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/auth/callback" element={<SSOCallbackPage />} />
          
          {/* Protected routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPlaceholder />
              </ProtectedRoute>
            }
          />
          
          {/* Redirects */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

### ProtectedRoute Component

The `ProtectedRoute` component wraps authenticated pages and:
1. Checks authentication state using the `useAuth` hook
2. Shows a loading indicator while checking authentication
3. Redirects to `/login` if not authenticated
4. Renders protected content if authenticated

```tsx
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
```

## Navigation Flow

### Standard Login Flow

1. User visits `/` or `/login`
2. User selects institution and enters credentials
3. On successful authentication:
   - Without MFA: Redirect to `/dashboard`
   - With MFA: Navigate to `/mfa` with session ID
4. If MFA required, user enters OTP on `/mfa`
5. On successful MFA verification: Redirect to `/dashboard`

### SSO Login Flow

1. User visits `/login`
2. User clicks "Sign in with Google" or "Sign in with Microsoft"
3. User is redirected to SSO provider
4. After authentication, provider redirects to `/auth/callback?code=...`
5. `SSOCallbackPage` exchanges code for token
6. On success: Redirect to `/dashboard`

### Password Recovery Flow

1. User clicks "Forgot password?" on `/login`
2. Navigate to `/forgot-password`
3. User enters email and submits
4. Confirmation message displayed
5. User clicks "Back to login" to return to `/login`

### Protected Route Access

1. User tries to access `/dashboard` (or any protected route)
2. `ProtectedRoute` checks authentication state
3. If authenticated: Render dashboard
4. If not authenticated: Redirect to `/login`

## Requirements Validated

- **Requirement 2.5**: Redirect to dashboard on successful authentication
- **Requirement 2.6**: Navigate to MFA screen when MFA is required
- **Requirement 4.4**: Handle SSO callback route
- **Requirement 8.1**: Navigate to forgot password screen from login

## Navigation Helpers

### Programmatic Navigation

Pages use the `useNavigate` hook from React Router for programmatic navigation:

```tsx
import { useNavigate } from 'react-router-dom';

function LoginPage() {
  const navigate = useNavigate();
  
  const handleSuccess = () => {
    navigate('/dashboard');
  };
  
  const handleMFARequired = (sessionId: string) => {
    navigate('/mfa', { state: { sessionId } });
  };
}
```

### Passing State Between Routes

State can be passed between routes using the `state` option:

```tsx
// From LoginPage
navigate('/mfa', { state: { sessionId: 'abc123' } });

// In MFAPage
const location = useLocation();
const sessionId = location.state?.sessionId;
```

## Testing

### Route Testing

The routing configuration is tested in `App.test.tsx`:

```tsx
it('should render login page at /login route', () => {
  window.history.pushState({}, '', '/login');
  render(<App />);
  expect(screen.getByTestId('login-page')).toBeInTheDocument();
});
```

### Protected Route Testing

The `ProtectedRoute` component is tested in `ProtectedRoute.test.tsx`:

```tsx
it('should redirect to login when not authenticated', () => {
  mockUseAuth.mockReturnValue({
    isAuthenticated: false,
    isLoading: false,
    // ...
  });
  
  renderProtectedRoute(<div>Protected Content</div>);
  expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
});
```

## Future Enhancements

### 1. Redirect Preservation

Store the intended destination when redirecting to login, then redirect back after authentication:

```tsx
// In ProtectedRoute
if (!isAuthenticated) {
  return <Navigate to="/login" state={{ from: location }} replace />;
}

// In LoginPage after successful login
const location = useLocation();
const from = location.state?.from?.pathname || '/dashboard';
navigate(from, { replace: true });
```

### 2. Role-Based Routes

Add role checking to protected routes:

```tsx
<Route
  path="/admin"
  element={
    <ProtectedRoute requiredRole="admin">
      <AdminPanel />
    </ProtectedRoute>
  }
/>
```

### 3. Lazy Loading

Implement code splitting for better performance:

```tsx
const LoginPage = lazy(() => import('./features/auth/pages/LoginPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));

<Suspense fallback={<LoadingIndicator />}>
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/dashboard" element={<Dashboard />} />
  </Routes>
</Suspense>
```

### 4. Nested Routes

Organize routes hierarchically:

```tsx
<Routes>
  <Route path="/auth" element={<AuthLayout />}>
    <Route path="login" element={<LoginPage />} />
    <Route path="mfa" element={<MFAPage />} />
    <Route path="forgot-password" element={<ForgotPasswordPage />} />
  </Route>
  
  <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
    <Route path="dashboard" element={<Dashboard />} />
    <Route path="profile" element={<Profile />} />
    <Route path="settings" element={<Settings />} />
  </Route>
</Routes>
```

## Dependencies

- `react-router-dom` v6+: Routing library
- `AuthProvider`: Authentication context provider
- `useAuth`: Hook for accessing authentication state
- `LoadingIndicator`: Loading state component

## Related Documentation

- [ProtectedRoute Component](../client/src/features/auth/components/ProtectedRoute.md)
- [Authentication Context](../client/src/features/auth/context/AuthContext.tsx)
- [Navigation Flow Diagrams](./AUTHENTICATION_FLOW.md) (to be created)

## Troubleshooting

### Issue: Routes not working

**Solution**: Ensure `BrowserRouter` wraps all routes and is inside `AuthProvider`:

```tsx
<AuthProvider>
  <BrowserRouter>
    <Routes>...</Routes>
  </BrowserRouter>
</AuthProvider>
```

### Issue: Protected routes not redirecting

**Solution**: Check that `useAuth` hook is returning correct authentication state and `ProtectedRoute` is properly implemented.

### Issue: State not passed between routes

**Solution**: Use the `state` option in `navigate()` and access via `useLocation()`:

```tsx
// Sending
navigate('/mfa', { state: { sessionId } });

// Receiving
const location = useLocation();
const sessionId = location.state?.sessionId;
```

## Conclusion

The React Router setup provides a solid foundation for navigation in the EduOS authentication system. It handles public routes, protected routes, SSO callbacks, and proper redirects while maintaining a clean and testable structure.
