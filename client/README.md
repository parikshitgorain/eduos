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
- Session management

### ✅ UI Components
- **LoginForm**: Complete login form with validation
- **PasswordInput**: Secure input with show/hide toggle and strength indicator
- **TenantSelector**: Searchable institution dropdown with debouncing
- **ErrorDisplay**: Inline error messages with icons
- **LoadingIndicator**: Spinner animations for loading states

### ✅ Form Validation
- Real-time validation with Zod schemas
- Email format validation
- Password strength calculation
- Required field validation
- Form state management with React Hook Form

### ✅ Security Features
- CAPTCHA integration (after 3 failed attempts)
- Password field clearing on errors
- Token storage with expiration
- Remember me functionality (30 days vs 24 hours)
- Secure HTTP-only cookie support

### ✅ User Experience
- Responsive design (mobile, tablet, desktop)
- Loading states during API calls
- Clear error messages
- Keyboard navigation support
- Screen reader accessibility (ARIA attributes)

## API Integration

The frontend communicates with the backend API at `http://localhost:3000/api/v1/`:

- `POST /auth/login` - Login with credentials
- `POST /auth/mfa/verify` - Verify MFA code
- `GET /auth/sso/{provider}` - Initiate SSO
- `POST /auth/forgot-password` - Request password reset
- `GET /tenants/search` - Search for institutions

## Environment Variables

Create a `.env` file in the `client/` directory:

```env
VITE_API_URL=http://localhost:3000
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

## Next Steps

### Remaining Features (Tasks 8-21)
- [ ] SSO integration (Google, Microsoft)
- [ ] MFA verification flow
- [ ] Password recovery flow
- [ ] Contact administrator feature
- [ ] Responsive design refinements
- [ ] Accessibility features (WCAG 2.1 AA)
- [ ] Property-based testing
- [ ] Integration testing
- [ ] Accessibility audit

## Contributing

1. Follow the existing code structure
2. Use TypeScript for type safety
3. Write tests for new features
4. Follow Tailwind CSS conventions
5. Ensure accessibility compliance

## License

Copyright © 2026 EduOS. All rights reserved.
