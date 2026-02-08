# ProtectedRoute Component

## Overview

The `ProtectedRoute` component is a wrapper that protects routes requiring authentication. It checks the user's authentication state and either renders the protected content or redirects to the login page.

## Features

- **Authentication Check**: Verifies if the user is authenticated before rendering content
- **Loading State**: Shows a loading indicator while checking authentication status
- **Automatic Redirect**: Redirects unauthenticated users to the login page
- **Seamless Integration**: Works with React Router and the AuthContext

## Usage

### Basic Usage

```tsx
import { ProtectedRoute } from './features/auth/components/ProtectedRoute';
import { Dashboard } from './pages/Dashboard';

<Route
  path="/dashboard"
  element={
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  }
/>
```

### Multiple Protected Routes

```tsx
<Routes>
  <Route path="/login" element={<LoginPage />} />
  
  <Route
    path="/dashboard"
    element={
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    }
  />
  
  <Route
    path="/profile"
    element={
      <ProtectedRoute>
        <Profile />
      </ProtectedRoute>
    }
  />
  
  <Route
    path="/settings"
    element={
      <ProtectedRoute>
        <Settings />
      </ProtectedRoute>
    }
  />
</Routes>
```

## Behavior

### When Loading
- Displays a centered loading indicator
- Prevents content flash while checking authentication

### When Authenticated
- Renders the protected content (children)
- User can access the page normally

### When Not Authenticated
- Redirects to `/login` page
- Uses `replace` to prevent back button issues
- Preserves the intended destination for post-login redirect (future enhancement)

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| children | React.ReactNode | Yes | The protected content to render when authenticated |

## Dependencies

- `react-router-dom`: For navigation and redirects
- `useAuth` hook: For accessing authentication state
- `LoadingIndicator`: For showing loading state

## Requirements Validated

- **Requirement 2.5**: Redirect to dashboard on successful authentication
- **Requirement 9.4**: Handle token expiration and redirect to login

## Testing

The component includes comprehensive tests covering:
- Rendering children when authenticated
- Showing loading indicator during authentication check
- Redirecting to login when not authenticated
- Not rendering protected content when unauthenticated

## Future Enhancements

1. **Redirect Preservation**: Store the intended destination and redirect after login
2. **Role-Based Access**: Add role checking for fine-grained access control
3. **Permission Checking**: Support permission-based route protection
4. **Custom Redirect**: Allow custom redirect paths instead of always going to `/login`

## Example with Redirect Preservation (Future)

```tsx
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (!isAuthenticated) {
    // Save the intended destination
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
```

## Related Components

- `AuthProvider`: Provides authentication context
- `useAuth`: Hook for accessing authentication state
- `LoadingIndicator`: Loading state component
- `App.tsx`: Main routing configuration
