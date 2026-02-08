# EduOS Platform: Frontend & Backend Structure

**Version:** 1.0  
**Last Updated:** 2026-02-08  
**Status:** Documentation

---

## Overview

The EduOS platform follows a **separated frontend-backend architecture** with the frontend in a dedicated `client/` directory and the backend in the `src/` directory. This structure provides clean separation of concerns, independent deployment, and scalability.

---

## Project Structure

```
eduos-platform/
│
├── client/                          # 🎨 FRONTEND (React + TypeScript)
│   ├── src/
│   │   ├── features/               # Feature-based organization
│   │   │   └── auth/               # Authentication feature
│   │   │       ├── components/     # UI components
│   │   │       │   ├── LoginForm.tsx
│   │   │       │   ├── MFAForm.tsx
│   │   │       │   ├── PasswordInput.tsx
│   │   │       │   ├── TenantSelector.tsx
│   │   │       │   ├── SSOButtons.tsx
│   │   │       │   ├── ContactAdminLink.tsx
│   │   │       │   └── AuthLayout.tsx
│   │   │       ├── pages/          # Page components
│   │   │       │   ├── LoginPage.tsx
│   │   │       │   ├── MFAPage.tsx
│   │   │       │   └── ForgotPasswordPage.tsx
│   │   │       ├── hooks/          # Custom hooks
│   │   │       │   └── useAuth.ts
│   │   │       ├── context/        # React context
│   │   │       │   └── AuthContext.tsx
│   │   │       ├── services/       # API integration
│   │   │       │   ├── authService.ts
│   │   │       │   ├── tenantService.ts
│   │   │       │   └── tokenService.ts
│   │   │       ├── types/          # TypeScript types
│   │   │       │   └── auth.types.ts
│   │   │       └── utils/          # Utilities
│   │   │           ├── validationSchemas.ts
│   │   │           ├── passwordStrength.ts
│   │   │           └── errorMapper.ts
│   │   ├── shared/                 # Shared/reusable code
│   │   │   ├── components/         # Reusable UI components
│   │   │   │   ├── ErrorDisplay.tsx
│   │   │   │   ├── LoadingIndicator.tsx
│   │   │   │   └── Footer.tsx
│   │   │   ├── hooks/              # Reusable hooks
│   │   │   └── utils/              # Shared utilities
│   │   ├── config/                 # App configuration
│   │   │   └── apiClient.ts        # Axios configuration
│   │   ├── App.tsx                 # Root component
│   │   ├── main.tsx                # Entry point
│   │   └── vite-env.d.ts           # Vite types
│   ├── public/                     # Static assets
│   │   ├── logo.svg
│   │   └── favicon.ico
│   ├── tests/                      # Test files
│   │   ├── unit/
│   │   ├── integration/
│   │   └── setup.ts
│   ├── .env                        # Environment variables
│   ├── .env.example                # Environment template
│   ├── package.json                # Frontend dependencies
│   ├── tsconfig.json               # TypeScript config
│   ├── vite.config.ts              # Vite config
│   ├── tailwind.config.js          # Tailwind config
│   ├── postcss.config.js           # PostCSS config
│   └── README.md                   # Frontend documentation
│
├── src/                             # ⚙️ BACKEND (Node.js + Express)
│   ├── config/                     # Configuration
│   │   ├── database.js
│   │   ├── redis.js
│   │   └── tls.js
│   ├── middleware/                 # Express middleware
│   │   ├── tenantContext.js
│   │   ├── domainMapping.js
│   │   ├── rateLimiter.js
│   │   ├── securityProtection.js
│   │   └── auditLogger.js
│   ├── routes/                     # API routes
│   │   ├── auth.js                 # Authentication endpoints
│   │   ├── tenants.js              # Tenant management
│   │   ├── students.js
│   │   ├── attendance.js
│   │   └── payments.js
│   ├── services/                   # Business logic
│   │   ├── authService.js
│   │   ├── tenantService.js
│   │   ├── mfaService.js
│   │   └── sessionService.js
│   ├── jobs/                       # Background jobs
│   │   ├── domainVerificationJob.js
│   │   └── webhookRetryJob.js
│   ├── utils/                      # Utilities
│   │   ├── generateToken.js
│   │   └── secureQuery.js
│   ├── views/                      # HTML templates
│   │   └── 404-domain.html
│   ├── __mocks__/                  # Test mocks
│   └── server.js                   # Express server
│
├── database/                        # 🗄️ DATABASE
│   ├── migrations/                 # SQL migrations
│   ├── migrate.js                  # Migration runner
│   └── README.md
│
├── ai-service/                      # 🤖 AI MICROSERVICE (Python)
│   ├── main.py
│   ├── semantic_matching.py
│   ├── explainability.py
│   ├── governance.py
│   └── requirements.txt
│
├── docs/                            # 📚 DOCUMENTATION
│   ├── API_REFERENCE.md
│   ├── AUTH_SERVICE.md
│   ├── FRONTEND_BACKEND_STRUCTURE.md  # This file
│   └── ...
│
├── monitoring/                      # 📊 MONITORING
│   ├── prometheus/
│   ├── grafana/
│   └── jaeger/
│
├── deployment/                      # 🚀 DEPLOYMENT
│   ├── kubernetes/
│   └── deploy-blue-green.sh
│
├── scripts/                         # 🛠️ SCRIPTS
│   ├── backup-postgres.sh
│   └── test-kill-switch.sh
│
├── .kiro/                           # 📋 SPECS
│   └── specs/
│       ├── eduos-platform/         # Backend spec
│       └── login-authentication-ui/ # Frontend spec
│
├── .env                             # Backend environment
├── .env.example
├── package.json                     # Backend dependencies
├── docker-compose.yml               # Multi-service orchestration
├── Dockerfile                       # Backend container
└── README.md                        # Project documentation
```

---

## Technology Stack

### Frontend (`client/`)
- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite 5+
- **Styling**: Tailwind CSS 3+
- **Form Management**: React Hook Form + Zod
- **HTTP Client**: Axios
- **State Management**: React Context API
- **Routing**: React Router v6
- **Testing**: Vitest + React Testing Library + fast-check

### Backend (`src/`)
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL 14+
- **Cache**: Redis
- **Authentication**: JWT + OAuth 2.0
- **Testing**: Jest + Supertest

### AI Service (`ai-service/`)
- **Runtime**: Python 3.10+
- **Framework**: FastAPI
- **ML Libraries**: scikit-learn, XGBoost, sentence-transformers

---

## Development Workflow

### Starting the Backend

```bash
# From project root
npm install
npm run dev

# Backend runs on http://localhost:3000
```

### Starting the Frontend

```bash
# From client directory
cd client
npm install
npm run dev

# Frontend runs on http://localhost:5173
# API calls proxied to http://localhost:3000
```

### Full Stack Development

**Terminal 1 - Backend:**
```bash
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd client && npm run dev
```

**Terminal 3 - Database:**
```bash
npm run db:start
```

---

## API Communication

### Development

**Frontend → Backend:**
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- Proxy: Vite proxies `/api/*` to backend

**Example:**
```typescript
// Frontend makes request to /api/v1/auth/login
// Vite proxies to http://localhost:3000/api/v1/auth/login
```

### Production

**Frontend → Backend:**
- Frontend: `https://app.eduos.com`
- Backend: `https://api.eduos.com`
- CORS: Configured on backend

**Example:**
```typescript
// Frontend makes request to https://api.eduos.com/api/v1/auth/login
```

---

## Environment Variables

### Backend (`.env`)
```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/eduos
POSTGRES_USER=eduos_user
POSTGRES_PASSWORD=secure_password
POSTGRES_DB=eduos_platform

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRY=1h

# OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret

# Server
PORT=3000
NODE_ENV=development
```

### Frontend (`client/.env`)
```env
# API Configuration
VITE_API_URL=http://localhost:3000

# OAuth Redirect URIs
VITE_GOOGLE_REDIRECT_URI=http://localhost:5173/auth/callback
VITE_MICROSOFT_REDIRECT_URI=http://localhost:5173/auth/callback

# Environment
VITE_ENV=development
```

---

## Build & Deployment

### Backend Build

```bash
# No build step needed for Node.js
# Deploy directly to server or container
docker build -t eduos-backend .
```

### Frontend Build

```bash
cd client
npm run build

# Output: client/dist/
# Deploy to Vercel, Netlify, or serve from backend
```

### Docker Compose (Full Stack)

```bash
docker-compose up -d

# Services:
# - postgres: Database
# - redis: Cache
# - backend: Node.js API
# - frontend: React app (optional)
# - ai-service: Python AI service
```

---

## Testing

### Backend Tests

```bash
# From project root
npm test                    # All tests
npm run test:unit          # Unit tests only
npm run test:watch         # Watch mode
```

### Frontend Tests

```bash
# From client directory
cd client
npm test                    # All tests
npm run test:unit          # Unit tests
npm run test:integration   # Integration tests
npm run test:coverage      # Coverage report
```

---

## File Naming Conventions

### Frontend
- **Components**: PascalCase (e.g., `LoginForm.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useAuth.ts`)
- **Services**: camelCase with `Service` suffix (e.g., `authService.ts`)
- **Types**: PascalCase with `.types.ts` suffix (e.g., `auth.types.ts`)
- **Utils**: camelCase (e.g., `passwordStrength.ts`)
- **Tests**: Same as file with `.test.ts` suffix (e.g., `LoginForm.test.tsx`)

### Backend
- **Routes**: camelCase (e.g., `auth.js`)
- **Services**: camelCase with `Service` suffix (e.g., `authService.js`)
- **Middleware**: camelCase (e.g., `tenantContext.js`)
- **Tests**: Same as file with `.test.js` suffix (e.g., `auth.test.js`)

---

## Code Organization Principles

### Frontend

**Feature-Based Organization:**
- Each feature (auth, dashboard, students) has its own directory
- Feature contains: components, hooks, services, types, utils
- Shared code goes in `shared/` directory

**Component Structure:**
```typescript
// LoginForm.tsx
export interface LoginFormProps {
  onSuccess: (token: string) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  // Component logic
};
```

### Backend

**Layer-Based Organization:**
- Routes handle HTTP requests/responses
- Services contain business logic
- Middleware handles cross-cutting concerns
- Utils contain helper functions

**Service Structure:**
```javascript
// authService.js
class AuthService {
  async login(credentials) {
    // Business logic
  }
}

module.exports = new AuthService();
```

---

## Git Workflow

### Branch Strategy

```
main                    # Production-ready code
├── develop            # Integration branch
│   ├── feature/login-ui
│   ├── feature/dashboard
│   └── fix/auth-bug
```

### Commit Messages

```
feat(frontend): add login form component
fix(backend): resolve JWT expiration issue
docs: update API documentation
test(frontend): add unit tests for auth service
```

---

## Deployment Architecture

### Development
```
┌─────────────┐     ┌─────────────┐     ┌──────────┐
│  Frontend   │────▶│   Backend   │────▶│ Database │
│ localhost:  │     │ localhost:  │     │ Postgres │
│    5173     │     │    3000     │     │          │
└─────────────┘     └─────────────┘     └──────────┘
```

### Production
```
┌─────────────┐     ┌─────────────┐     ┌──────────┐
│  Frontend   │────▶│   Backend   │────▶│ Database │
│   Vercel    │     │   Railway   │     │   AWS    │
│ app.eduos   │     │ api.eduos   │     │   RDS    │
└─────────────┘     └─────────────┘     └──────────┘
```

---

## Key Benefits of This Structure

✅ **Clean Separation**: Frontend and backend are completely independent  
✅ **Independent Deployment**: Deploy frontend and backend separately  
✅ **Technology Flexibility**: Use best tools for each layer  
✅ **Team Scalability**: Frontend and backend teams work independently  
✅ **Easy Testing**: Test frontend and backend in isolation  
✅ **Modern Best Practice**: Industry-standard architecture  
✅ **Docker Ready**: Easy to containerize both services  
✅ **Scalable**: Scale frontend and backend independently  

---

## Next Steps

1. ✅ Backend is complete (82% done)
2. 🚀 Frontend spec is ready (login UI)
3. 📝 Start implementing frontend tasks
4. 🔗 Integrate frontend with backend APIs
5. 🧪 Test end-to-end flows
6. 🚀 Deploy to production

---

**Questions?** Check the spec files:
- Backend: `.kiro/specs/eduos-platform/`
- Frontend: `.kiro/specs/login-authentication-ui/`
