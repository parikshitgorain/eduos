# EduOS Platform - Developer Guide

**Version:** 1.0  
**Last Updated:** 2026-02-08  
**Audience:** Software Developers, DevOps Engineers, System Integrators

---

## Table of Contents

1. [Introduction](#introduction)
2. [Architecture Overview](#architecture-overview)
3. [Development Environment Setup](#development-environment-setup)
4. [Project Structure](#project-structure)
5. [Core Concepts](#core-concepts)
6. [API Integration](#api-integration)
7. [Database Schema](#database-schema)
8. [Authentication & Authorization](#authentication--authorization)
9. [Testing](#testing)
10. [Deployment](#deployment)
11. [Monitoring & Debugging](#monitoring--debugging)
12. [Contributing](#contributing)

---

## Introduction

Welcome to the EduOS Platform Developer Guide. This comprehensive guide will help you understand the platform architecture, set up your development environment, and build integrations.

### What You'll Learn

- Platform architecture and design patterns
- How to set up a local development environment
- API integration best practices
- Database schema and data models
- Testing strategies
- Deployment procedures

### Prerequisites

- **Programming**: JavaScript/TypeScript, Python (for AI service)
- **Databases**: PostgreSQL, Redis
- **Tools**: Git, Docker, Node.js 18+
- **Concepts**: REST APIs, OAuth 2.0, Microservices

---

## Architecture Overview

### High-Level Architecture

EduOS uses a microservices architecture with clear separation between deterministic and probabilistic systems.

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Layer                           │
│  • Next.js Web App (TypeScript/React)                       │
│  • React Native Mobile App (PWA)                            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   API Gateway Layer                          │
│  • Kong / AWS API Gateway                                   │
│  • Rate Limiting, OAuth 2.0, Request Signing               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Microservices Layer                         │
│  • Auth Service (OAuth2, MFA, RBAC)                         │
│  • Core Service (Identity, Hierarchy)                       │
│  • Forms Service (Schema Engine)                            │
│  • Attendance Service (Offline Sync)                        │
│  • Payments Service (Stripe/Razorpay)                       │
│  • Analytics Service (Reports, Dashboards)                  │
│  • AI Service (Python FastAPI - Advisory Only)             │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                              │
│  • PostgreSQL 14+ (Primary Database with RLS)              │
│  • Redis 7+ (Cache & Session Store)                         │
│  • S3-Compatible Storage (Media Files)                      │
│  • RabbitMQ / AWS SQS (Message Queue)                       │
└─────────────────────────────────────────────────────────────┘
```


### System of Record vs System of Intelligence

**System of Record (Deterministic Layer)**
- **Technology**: Node.js / Go
- **Purpose**: Authoritative source of truth
- **Characteristics**: ACID-compliant, transactional, auditable
- **Responsibilities**:
  - Student identity and enrollment
  - Attendance records
  - Financial transactions
  - Authentication and authorization

**System of Intelligence (Probabilistic Layer)**
- **Technology**: Python (FastAPI)
- **Purpose**: Advisory and analytical capabilities
- **Characteristics**: ML-based, non-authoritative, human-in-the-loop
- **Responsibilities**:
  - Duplicate student detection
  - Attendance anomaly detection
  - Academic risk prediction
  - Schedule optimization

**Critical Rule**: AI layer operates in advisory mode only. It CANNOT execute write operations without explicit human approval.

---

## Development Environment Setup

### Prerequisites Installation

#### 1. Install Node.js

```bash
# Using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# Verify installation
node --version  # Should be v18.x.x
npm --version   # Should be 9.x.x
```

#### 2. Install PostgreSQL

**Option A: Using Docker (Recommended)**
```bash
docker run --name eduos-postgres \
  -e POSTGRES_USER=eduos_app \
  -e POSTGRES_PASSWORD=your_password \
  -e POSTGRES_DB=eduos_db \
  -p 5432:5432 \
  -d postgres:14
```

**Option B: Native Installation**
```bash
# Ubuntu/Debian
sudo apt-get install postgresql-14

# macOS
brew install postgresql@14

# Windows
# Download from https://www.postgresql.org/download/windows/
```

#### 3. Install Redis

**Option A: Using Docker (Recommended)**
```bash
docker run --name eduos-redis \
  -p 6379:6379 \
  -d redis:7-alpine
```

**Option B: Native Installation**
```bash
# Ubuntu/Debian
sudo apt-get install redis-server

# macOS
brew install redis

# Windows
# Download from https://github.com/microsoftarchive/redis/releases
```

### Project Setup

#### 1. Clone Repository

```bash
git clone https://github.com/your-org/eduos-platform.git
cd eduos-platform
```

#### 2. Install Dependencies

```bash
npm install
```

#### 3. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your settings
nano .env
```

**Required Environment Variables:**
```env
# Database
DATABASE_URL=postgresql://eduos_app:your_password@localhost:5432/eduos_db

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key-min-32-chars
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_IN=7d

# Encryption
ENCRYPTION_KEY=your-encryption-key-32-chars

# Payment Gateways
RAZORPAY_KEY_ID=rzp_test_abc123
RAZORPAY_KEY_SECRET=your_secret
STRIPE_SECRET_KEY=sk_test_abc123

# AI Service
AI_SERVICE_URL=http://localhost:8000
AI_ENABLED=true

# Environment
NODE_ENV=development
PORT=3000
```

#### 4. Run Database Migrations

```bash
npm run migrate
```

#### 5. Seed Database (Optional)

```bash
npm run seed
```

#### 6. Start Development Server

```bash
npm run dev
```

Server will start at `http://localhost:3000`

### Verify Installation

```bash
# Check health endpoint
curl http://localhost:3000/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2026-02-08T10:30:00Z",
  "services": {
    "database": "connected",
    "redis": "connected"
  }
}
```

---

## Project Structure

```
eduos-platform/
├── .github/                    # GitHub Actions workflows
│   └── workflows/
│       ├── ci.yml             # Continuous Integration
│       ├── cd.yml             # Continuous Deployment
│       └── rollback.yml       # Rollback workflow
│
├── .kiro/                     # Project specifications
│   └── specs/eduos-platform/
│       ├── requirements.md    # System requirements
│       ├── design.md          # Technical design
│       └── tasks.md           # Implementation tasks
│
├── ai-service/                # Python AI inference service
│   ├── main.py               # FastAPI application
│   ├── semantic_matching.py  # SBERT duplicate detection
│   ├── explainability.py     # SHAP explainability
│   ├── governance.py         # AI governance framework
│   └── requirements.txt      # Python dependencies
│
├── database/                  # Database layer
│   ├── migrations/           # SQL migration files
│   │   ├── 001_setup_rls_foundation.sql
│   │   ├── 002_tenant_provisioning.sql
│   │   └── ...
│   ├── tests/                # Database tests
│   │   └── rls_isolation.test.sql
│   └── migrate.js            # Migration runner
│
├── deployment/                # Deployment scripts
│   ├── deploy-blue-green.sh  # Blue/Green deployment
│   ├── health-check.sh       # Health check script
│   ├── smoke-tests.sh        # Smoke tests
│   └── kubernetes/           # K8s manifests
│
├── docs/                      # Documentation
│   ├── API_REFERENCE.md      # Complete API reference
│   ├── ADMIN_GUIDE.md        # Administrator guide
│   ├── DEVELOPER_GUIDE.md    # This file
│   └── ...
│
├── monitoring/                # Monitoring configuration
│   ├── prometheus/           # Prometheus config
│   ├── grafana/              # Grafana dashboards
│   └── jaeger/               # Jaeger tracing
│
├── scripts/                   # Utility scripts
│   ├── backup-postgres.sh    # Database backup
│   ├── backup-redis.sh       # Redis backup
│   └── load-test.js          # Load testing
│
├── src/                       # Application source code
│   ├── config/               # Configuration
│   │   ├── database.js       # Database connection
│   │   ├── redis.js          # Redis connection
│   │   └── tls.js            # TLS configuration
│   │
│   ├── middleware/           # Express middleware
│   │   ├── tenantContext.js  # Tenant isolation
│   │   ├── auditLogger.js    # Audit logging
│   │   ├── rateLimiter.js    # Rate limiting
│   │   └── ...
│   │
│   ├── routes/               # API routes
│   │   ├── auth.js           # Authentication
│   │   ├── tenants.js        # Tenant management
│   │   ├── students.js       # Student management
│   │   └── ...
│   │
│   ├── services/             # Business logic
│   │   ├── authService.js    # Auth service
│   │   ├── tenantService.js  # Tenant service
│   │   ├── schemaService.js  # Schema service
│   │   └── ...
│   │
│   ├── utils/                # Utilities
│   │   ├── generateToken.js  # JWT utilities
│   │   └── secureQuery.js    # SQL injection prevention
│   │
│   └── server.js             # Express server
│
├── .env.example               # Environment template
├── docker-compose.yml         # Docker services
├── Dockerfile                 # Docker image
├── jest.config.js             # Jest configuration
├── package.json               # Node.js dependencies
└── README.md                  # Project README
```

---

## Core Concepts

### Multi-Tenancy with Row-Level Security (RLS)

EduOS uses PostgreSQL Row-Level Security for tenant isolation.

**How it works:**

1. **Tenant Context**: Middleware extracts `tenant_id` from JWT
2. **Session Variable**: Sets PostgreSQL session variable
3. **RLS Policies**: Database automatically filters queries

**Example:**

```javascript
// Middleware sets tenant context
app.use(async (req, res, next) => {
  const tenantId = req.user.tenant_id;
  await pool.query('SET LOCAL app.current_tenant_id = $1', [tenantId]);
  next();
});

// All queries automatically filtered
const students = await pool.query('SELECT * FROM students');
// Returns only students for current tenant
```

**RLS Policy Example:**

```sql
CREATE POLICY tenant_isolation ON students
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

### Immutable Schema Snapshots

Schemas are versioned and immutable to preserve historical data integrity.

**Key Concepts:**

1. **Snapshot Creation**: Every schema change creates a new snapshot
2. **SHA-256 Hash**: Cryptographic integrity verification
3. **Semantic Versioning**: Major.Minor.Patch versioning
4. **Historic Rendering**: Old records use their original schema

**Example:**

```javascript
// Create schema snapshot
const snapshot = await schemaService.createSnapshot({
  schema_id: 'schema_123',
  version: '1.1.0',
  fields: [...],
  parent_snapshot_id: 'snapshot_456'
});

// Snapshot includes SHA-256 hash
console.log(snapshot.hash); // "a1b2c3d4e5f6..."

// Student records reference snapshot
const student = {
  id: 'student_789',
  schema_snapshot_id: snapshot.id,
  data: {...}
};
```

### Idempotency

Critical operations support idempotency to prevent duplicate processing.

**Idempotency Key Format:**

```
{operation}_{entity_id}_{timestamp}
```

**Example: Attendance Sync**

```javascript
// Client generates idempotency key
const idempotencyKey = `${eventId}_${deviceId}_${clientTimestamp}`;

// Server checks for duplicate
const existing = await pool.query(
  'SELECT id FROM attendance WHERE idempotency_key = $1',
  [idempotencyKey]
);

if (existing.rows.length > 0) {
  return res.status(200).json({ message: 'Already processed' });
}

// Process attendance
await pool.query(
  'INSERT INTO attendance (event_id, student_id, idempotency_key, ...) VALUES ($1, $2, $3, ...)',
  [eventId, studentId, idempotencyKey, ...]
);
```

### Audit Logging with Hash Chain

All operations are logged with cryptographic integrity.

**Hash Chain:**

```
Entry 1: hash = SHA256(null + data1)
Entry 2: hash = SHA256(hash1 + data2)
Entry 3: hash = SHA256(hash2 + data3)
```

**Example:**

```javascript
// Log audit entry
await auditService.log({
  event_type: 'auth.login',
  user_id: 'user_123',
  action: 'login',
  resource_type: 'session',
  ip_address: req.ip,
  user_agent: req.headers['user-agent']
});

// Verify audit chain
const isValid = await auditService.verifyChain();
console.log(isValid); // true
```

---

## API Integration

### Authentication

#### OAuth 2.0 Authorization Code Flow with PKCE

**Step 1: Generate Code Verifier and Challenge**

```javascript
const crypto = require('crypto');

// Generate code verifier
const codeVerifier = crypto.randomBytes(32).toString('base64url');

// Generate code challenge
const codeChallenge = crypto
  .createHash('sha256')
  .update(codeVerifier)
  .digest('base64url');
```

**Step 2: Authorization Request**

```javascript
const authUrl = new URL('https://api.eduos.com/api/v1/auth/authorize');
authUrl.searchParams.append('client_id', 'your_client_id');
authUrl.searchParams.append('redirect_uri', 'https://your-app.com/callback');
authUrl.searchParams.append('response_type', 'code');
authUrl.searchParams.append('scope', 'openid profile email');
authUrl.searchParams.append('state', 'random_state_string');
authUrl.searchParams.append('code_challenge', codeChallenge);
authUrl.searchParams.append('code_challenge_method', 'S256');

// Redirect user to authUrl
```

**Step 3: Exchange Code for Token**

```javascript
const response = await fetch('https://api.eduos.com/api/v1/auth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    grant_type: 'authorization_code',
    code: authorizationCode,
    redirect_uri: 'https://your-app.com/callback',
    client_id: 'your_client_id',
    code_verifier: codeVerifier
  })
});

const { access_token, refresh_token } = await response.json();
```

**Step 4: Use Access Token**

```javascript
const response = await fetch('https://api.eduos.com/api/v1/students', {
  headers: {
    'Authorization': `Bearer ${access_token}`,
    'X-Tenant-ID': 'your_tenant_id',
    'Content-Type': 'application/json'
  }
});
```

### Making API Requests

#### Create Student

```javascript
const createStudent = async (studentData) => {
  const response = await fetch('https://api.eduos.com/api/v1/students', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-Tenant-ID': tenantId,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      first_name: 'John',
      last_name: 'Doe',
      date_of_birth: '2010-05-15',
      email: 'john.doe@student.edu',
      schema_snapshot_id: 'snapshot_456'
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return await response.json();
};
```

#### Check for Duplicates

```javascript
const checkDuplicates = async (studentData) => {
  const response = await fetch('https://api.eduos.com/api/v1/students/check-duplicates', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-Tenant-ID': tenantId,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      first_name: studentData.first_name,
      last_name: studentData.last_name,
      date_of_birth: studentData.date_of_birth
    })
  });

  const result = await response.json();
  
  if (result.has_duplicates) {
    console.log('Potential duplicates found:');
    result.candidates.forEach(candidate => {
      console.log(`- ${candidate.first_name} ${candidate.last_name}`);
      console.log(`  Likelihood: ${candidate.likelihood_score}`);
      console.log(`  Reason: ${candidate.reason_codes.join(', ')}`);
    });
  }

  return result;
};
```

### Error Handling

```javascript
const makeApiRequest = async (url, options) => {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const error = await response.json();
      
      switch (response.status) {
        case 400:
          throw new ValidationError(error.message, error.details);
        case 401:
          throw new AuthenticationError('Invalid or expired token');
        case 403:
          throw new AuthorizationError('Insufficient permissions');
        case 404:
          throw new NotFoundError('Resource not found');
        case 429:
          const retryAfter = response.headers.get('Retry-After');
          throw new RateLimitError(`Rate limit exceeded. Retry after ${retryAfter}s`);
        case 500:
          throw new ServerError('Internal server error');
        default:
          throw new Error(`HTTP ${response.status}: ${error.message}`);
      }
    }
    
    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};
```

### Webhook Integration

#### Receiving Webhooks

```javascript
const express = require('express');
const crypto = require('crypto');

app.post('/webhooks/eduos', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-eduos-signature'];
  const payload = req.body;
  
  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  
  if (`sha256=${expectedSignature}` !== signature) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Parse payload
  const event = JSON.parse(payload);
  
  // Handle event
  switch (event.event) {
    case 'payment.succeeded':
      handlePaymentSuccess(event.data);
      break;
    case 'payment.failed':
      handlePaymentFailure(event.data);
      break;
    case 'invoice.created':
      handleInvoiceCreated(event.data);
      break;
    default:
      console.log(`Unhandled event: ${event.event}`);
  }
  
  // Return 200 to acknowledge receipt
  res.status(200).json({ received: true });
});
```

---

## Database Schema

### Core Tables

#### tenants

```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  subdomain VARCHAR(100) UNIQUE NOT NULL,
  tier VARCHAR(50) NOT NULL CHECK (tier IN ('Basic', 'Business', 'Enterprise')),
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  settings JSONB DEFAULT '{}',
  quotas JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### students (with RLS)

```sql
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE NOT NULL,
  email VARCHAR(255),
  schema_snapshot_id UUID REFERENCES schema_snapshots(id),
  status VARCHAR(50) DEFAULT 'active',
  custom_fields JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, email)
);

-- Enable RLS
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY tenant_isolation ON students
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

#### schema_snapshots

```sql
CREATE TABLE schema_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  schema_id UUID NOT NULL,
  version VARCHAR(50) NOT NULL,
  parent_snapshot_id UUID REFERENCES schema_snapshots(id),
  fields JSONB NOT NULL,
  hash VARCHAR(64) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, schema_id, version)
);

-- Immutability constraint
CREATE TRIGGER prevent_snapshot_modification
  BEFORE UPDATE OR DELETE ON schema_snapshots
  FOR EACH ROW EXECUTE FUNCTION prevent_modification();
```

### Querying with RLS

```javascript
// Set tenant context
await pool.query('SET LOCAL app.current_tenant_id = $1', [tenantId]);

// Query automatically filtered by tenant
const result = await pool.query('SELECT * FROM students WHERE status = $1', ['active']);
// Returns only students for current tenant

// No need for WHERE tenant_id = ... clause
```

---

## Authentication & Authorization

### JWT Token Structure

```json
{
  "header": {
    "alg": "RS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "user_123",
    "email": "admin@school.edu",
    "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
    "role": "InstituteAdmin",
    "permissions": ["students:read", "students:write"],
    "iat": 1644321600,
    "exp": 1644325200
  }
}
```

### Verifying JWT

```javascript
const jwt = require('jsonwebtoken');
const fs = require('fs');

const publicKey = fs.readFileSync('public.pem');

const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
    return decoded;
  } catch (error) {
    throw new Error('Invalid token');
  }
};
```

### Checking Permissions

```javascript
const hasPermission = (user, resource, action) => {
  const permission = `${resource}:${action}`;
  return user.permissions.includes(permission);
};

// Usage
if (!hasPermission(req.user, 'students', 'write')) {
  return res.status(403).json({ error: 'Insufficient permissions' });
}
```

---

## Testing

### Unit Tests

```javascript
// Example: Testing tenant service
const { createTenant } = require('../services/tenantService');

describe('TenantService', () => {
  describe('createTenant', () => {
    it('should create a tenant with valid data', async () => {
      const tenantData = {
        name: 'Test School',
        subdomain: 'test',
        tier: 'Basic'
      };
      
      const tenant = await createTenant(tenantData);
      
      expect(tenant).toHaveProperty('id');
      expect(tenant.name).toBe('Test School');
      expect(tenant.subdomain).toBe('test');
      expect(tenant.tier).toBe('Basic');
    });
    
    it('should reject invalid tier', async () => {
      const tenantData = {
        name: 'Test School',
        subdomain: 'test',
        tier: 'Invalid'
      };
      
      await expect(createTenant(tenantData)).rejects.toThrow('Invalid tier');
    });
  });
});
```

### Integration Tests

```javascript
// Example: Testing API endpoint
const request = require('supertest');
const app = require('../src/server');

describe('POST /api/v1/students', () => {
  let accessToken;
  
  beforeAll(async () => {
    // Get access token
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@test.edu',
        password: 'password123',
        tenant_id: 'test-tenant-id'
      });
    
    accessToken = response.body.access_token;
  });
  
  it('should create a student', async () => {
    const response = await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Tenant-ID', 'test-tenant-id')
      .send({
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: '2010-05-15',
        email: 'john.doe@student.edu'
      });
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.first_name).toBe('John');
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- src/services/tenantService.test.js

# Run in watch mode
npm test -- --watch
```

---

## Deployment

### Docker Deployment

#### Build Image

```bash
docker build -t eduos-platform:latest .
```

#### Run Container

```bash
docker run -d \
  --name eduos-platform \
  -p 3000:3000 \
  -e DATABASE_URL=postgresql://... \
  -e REDIS_URL=redis://... \
  -e JWT_SECRET=... \
  eduos-platform:latest
```

### Kubernetes Deployment

#### Deployment Manifest

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: eduos-platform
spec:
  replicas: 3
  selector:
    matchLabels:
      app: eduos-platform
  template:
    metadata:
      labels:
        app: eduos-platform
    spec:
      containers:
      - name: eduos-platform
        image: eduos-platform:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: eduos-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: eduos-secrets
              key: redis-url
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Blue/Green Deployment

```bash
# Deploy to green environment
./deployment/deploy-blue-green.sh green

# Run smoke tests
./deployment/smoke-tests.sh green

# Shift traffic gradually
./deployment/traffic-shift.sh green 10  # 10%
./deployment/traffic-shift.sh green 50  # 50%
./deployment/traffic-shift.sh green 100 # 100%

# Cleanup old environment
./deployment/cleanup.sh blue
```

---

## Monitoring & Debugging

### Health Checks

```javascript
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {}
  };
  
  // Check database
  try {
    await pool.query('SELECT 1');
    health.services.database = 'connected';
  } catch (error) {
    health.services.database = 'disconnected';
    health.status = 'unhealthy';
  }
  
  // Check Redis
  try {
    await redis.ping();
    health.services.redis = 'connected';
  } catch (error) {
    health.services.redis = 'disconnected';
    health.status = 'unhealthy';
  }
  
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});
```

### Logging

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'eduos-platform' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Usage
logger.info('Student created', { student_id: 'student_123', tenant_id: 'tenant_456' });
logger.error('Database connection failed', { error: error.message });
```

### Metrics

```javascript
const prometheus = require('prom-client');

// Create metrics
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

// Middleware to track metrics
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .observe(duration);
  });
  
  next();
});

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', prometheus.register.contentType);
  res.end(await prometheus.register.metrics());
});
```

---

## Contributing

### Code Style

- **JavaScript**: Use ESLint with Airbnb config
- **TypeScript**: Use TSLint with strict mode
- **Python**: Use Black formatter and Flake8 linter

### Commit Messages

Follow Conventional Commits:

```
feat: add student duplicate detection
fix: resolve RLS policy issue
docs: update API documentation
test: add unit tests for tenant service
refactor: simplify schema validation logic
```

### Pull Request Process

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes and commit
3. Write tests (80% coverage minimum)
4. Run tests: `npm test`
5. Push branch: `git push origin feature/my-feature`
6. Create pull request
7. Wait for code review
8. Address feedback
9. Merge after approval

---

## Additional Resources

- **API Reference**: [docs/API_REFERENCE.md](API_REFERENCE.md)
- **Admin Guide**: [docs/ADMIN_GUIDE.md](ADMIN_GUIDE.md)
- **Requirements**: [.kiro/specs/eduos-platform/requirements.md](../.kiro/specs/eduos-platform/requirements.md)
- **Design Document**: [.kiro/specs/eduos-platform/design.md](../.kiro/specs/eduos-platform/design.md)
- **Task List**: [.kiro/specs/eduos-platform/tasks.md](../.kiro/specs/eduos-platform/tasks.md)

---

**Last Updated:** 2026-02-08  
**Guide Version:** 1.0  
**Platform Version:** 1.0
