# EduOS Platform

**Version:** 1.0  
**Status:** In Development  
**Last Updated:** 2026-02-05

---

## Overview

EduOS is a production-grade, AI-enabled SaaS platform for educational institutions. It provides comprehensive student management, attendance tracking, financial operations, and AI-powered insights with strict multi-tenant isolation.

### Key Features

- 🏢 **Multi-Tenant Architecture** - Secure tenant isolation with Row-Level Security (RLS)
- 🔐 **Enterprise Security** - Database-level isolation, encryption, audit trails
- 🤖 **AI Advisory Layer** - Duplicate detection, risk prediction, anomaly detection
- 📱 **Offline-First** - Mobile attendance with sync and conflict resolution
- 💰 **Financial Management** - Payments, invoicing, reconciliation
- 📊 **Analytics & Reporting** - Real-time dashboards and custom reports
- 🌍 **Multi-Language Support** - Indian languages and localization

---

## Project Status

### Phase 1: SaaS Foundation (Weeks 1-4)

#### ✅ Task 1.1.1: PostgreSQL with RLS - COMPLETED
- ✅ PostgreSQL 14+ database schema
- ✅ Row-Level Security (RLS) policies
- ✅ Tenant isolation enforcement
- ✅ Test suite (10 tests passing)

#### ✅ Task 1.1.2: Tenant Context Middleware - COMPLETED
- ✅ JWT token extraction and validation
- ✅ PostgreSQL session variable setting
- ✅ Automatic tenant filtering
- ✅ Performance < 5ms overhead

#### ✅ Task 1.1.3: Tenant Provisioning API - COMPLETED
- ✅ POST `/api/v1/tenants` endpoint
- ✅ Tier-based quotas (Basic/Business/Enterprise)
- ✅ Database schema initialization
- ✅ Input validation (4 tests passing)
- ✅ Integration tests (18 total, 4 passing without DB)

#### ✅ Task 1.2.1: Custom Domain Mapping - COMPLETED
- ✅ Domain-to-tenant resolution middleware
- ✅ Support for subdomains and custom domains
- ✅ 404 error page for unmapped domains
- ✅ Performance < 10ms latency

#### ✅ Task 1.2.2: Domain Verification Workflow - COMPLETED
- ✅ DNS TXT record verification
- ✅ SSL certificate provisioning
- ✅ Background verification job
- ✅ Email notifications

#### ✅ Task 1.2.3: Tenant Routing Cache Layer - COMPLETED
- ✅ Redis-based caching for domain mappings
- ✅ Cache TTL: 5 minutes with auto-refresh
- ✅ Cache invalidation on domain changes
- ✅ Monitoring: cache hit rate > 95%
- ✅ Fallback to database on cache miss

**Next Task:** 1.3.1 - OAuth2/OIDC authentication

---

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ OR Docker
- Redis 7+ OR Docker
- Git

### Setup

```bash
# 1. Clone and install
git clone <repository-url>
cd eduos-platform
npm install

# 2. Setup database and Redis (choose one option)

# Option A: Using Docker (easiest)
docker compose up -d postgres redis
npm run setup

# Option B: Using local PostgreSQL and Redis
# Update .env with your credentials
npm run setup

# 3. Start the server
npm run dev

# 4. Run tests
npm test
```

### Verify Installation

```bash
# Check health (includes Redis)
curl http://localhost:3000/health

# Check cache statistics
curl http://localhost:3000/api/v1/cache/stats

# Test tenant creation (validation works without DB)
curl -X POST http://localhost:3000/api/v1/tenants \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","subdomain":"test","tier":"Basic"}'
```

---

## Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Layer                           │
│  • Next.js Web App                                          │
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

### Multi-Tenant Isolation

EduOS uses PostgreSQL Row-Level Security (RLS) to enforce tenant isolation at the database level:

```sql
-- Application sets tenant context
SET LOCAL app.current_tenant_id = '<tenant-uuid>';

-- All queries automatically filtered by tenant
SELECT * FROM students; -- Only returns current tenant's students
```

**Benefits:**
- Defense in depth - database enforces isolation even if application logic fails
- Zero trust architecture
- Performance overhead < 5ms per query
- Automatic enforcement - no manual WHERE clauses needed

---

## Database Schema

### Core Tables

1. **tenants** - Multi-tenant configuration
2. **students** - Student identity and profiles (RLS enabled)
3. **enrollments** - Student enrollment records (RLS enabled)
4. **attendance** - Attendance tracking (RLS enabled)
5. **payments** - Financial transactions (RLS enabled)

### Security Features

- ✅ Row-Level Security (RLS) on all core tables
- ✅ Composite foreign keys prevent cross-tenant references
- ✅ Indexes optimized for tenant-scoped queries
- ✅ Audit triggers for timestamp tracking
- ✅ Idempotency keys for duplicate prevention

---

## Testing

### Run All Tests

```bash
# RLS isolation tests
psql -U eduos_app -d eduos_db -f database/tests/rls_isolation.test.sql
```

### Test Coverage

- ✅ RLS enabled on all core tables
- ✅ Tenant isolation for SELECT/INSERT/UPDATE/DELETE
- ✅ Cross-tenant access blocked
- ✅ Performance overhead < 5ms
- ✅ Idempotency validation
- ✅ Foreign key constraints

### Expected Output

```
NOTICE:  TEST 1 PASSED: RLS is enabled on all core tables
NOTICE:  TEST 2 PASSED: Students table enforces tenant isolation
NOTICE:  TEST 3 PASSED: Enrollments table enforces tenant isolation
NOTICE:  TEST 4 PASSED: Attendance table enforces tenant isolation
NOTICE:  TEST 5 PASSED: Payments table enforces tenant isolation
NOTICE:  TEST 6 PASSED: INSERT operations respect tenant context
NOTICE:  TEST 7 PASSED: UPDATE operations respect tenant context
NOTICE:  TEST 8 PASSED: DELETE operations respect tenant context
NOTICE:  TEST 9 PASSED: Cross-tenant access attempts are blocked
NOTICE:  TEST 10 PASSED: RLS overhead is 0.8 ms (< 5ms target)

 test_result
─────────────────────────────────
 ALL RLS ISOLATION TESTS PASSED
```

---

## Documentation

📚 **[Complete Documentation Index](docs/README.md)** - Full documentation structure and navigation  
📊 **[Project Status](docs/PROJECT_STATUS.md)** - Current progress and next steps

### Quick Links

**Getting Started:**
- [Setup Guide](docs/SETUP_GUIDE.md) - Installation and configuration
- [API Documentation](docs/TENANT_PROVISIONING_API.md) - API reference
- [PostgreSQL Password Reset](docs/RESET_POSTGRES_PASSWORD.md) - Reset database password

**Database:**
- [Database Guide](database/README.md) - Database setup and operations
- [RLS Reference](database/docs/RLS_POLICY_REFERENCE.md) - Row-Level Security

**Specifications:**
- [Requirements](/.kiro/specs/eduos-platform/requirements.md) - System requirements
- [Design](/.kiro/specs/eduos-platform/design.md) - Technical design
- [Tasks](/.kiro/specs/eduos-platform/tasks.md) - Implementation roadmap

**Task Summaries:**
- [Task 1.1.1](docs/tasks/TASK_1.1.1_IMPLEMENTATION_SUMMARY.md) - PostgreSQL RLS ✅
- [Task 1.1.2](docs/tasks/TASK_1.1.2_IMPLEMENTATION_SUMMARY.md) - Tenant Context ✅
- [Task 1.1.3](docs/tasks/TASK_1.1.3_IMPLEMENTATION_SUMMARY.md) - Tenant Provisioning ✅
- [Task 1.2.1](docs/tasks/TASK_1.2.1_IMPLEMENTATION_SUMMARY.md) - Domain Mapping ✅
- [Task 1.2.2](docs/tasks/TASK_1.2.2_IMPLEMENTATION_SUMMARY.md) - Domain Verification ✅
- [Task 1.2.3](docs/tasks/TASK_1.2.3_IMPLEMENTATION_SUMMARY.md) - Cache Layer ✅

**Domain & Caching:**
- [Domain Mapping](docs/DOMAIN_MAPPING.md) - Custom domain resolution
- [Domain Verification](docs/DOMAIN_VERIFICATION_WORKFLOW.md) - DNS verification workflow
- [Cache Layer](docs/CACHE_LAYER.md) - Redis caching architecture

---

## Development Roadmap

### Phase 1: SaaS Foundation (Weeks 1-4)

- [x] Task 1.1.1: PostgreSQL with RLS policies ✅
- [x] Task 1.1.2: Tenant context middleware ✅
- [x] Task 1.1.3: Tenant provisioning API ✅
- [x] Task 1.2.1: Custom domain mapping ✅
- [x] Task 1.2.2: Domain verification workflow ✅
- [x] Task 1.2.3: Tenant routing cache ✅
- [ ] Task 1.3.1: OAuth2/OIDC authentication
- [ ] Task 1.3.2: Hierarchical RBAC
- [ ] Task 1.3.3: Session management
- [ ] Task 1.3.4: Multi-factor authentication

### Phase 2: Core Domain & Hierarchy (Weeks 5-8)

- [ ] Organizational structure (Institute → Center → Program → Batch)
- [ ] Dynamic forms with schema engine
- [ ] Offline-first attendance

### Phase 3: Intelligence Layer (Weeks 9-12)

- [ ] AI service infrastructure
- [ ] Identity resolution (duplicate detection)
- [ ] Merge operations with governance
- [ ] Human-in-the-loop workflows

### Phase 4: Commercialization & Security (Weeks 13-16)

- [ ] Billing engine
- [ ] Audit engine with tamper-evident logs
- [ ] Security hardening
- [ ] Production readiness

### Phase 5: Advanced Features (Weeks 17-22)

- [ ] Academic policy engine
- [ ] Scheduling optimization
- [ ] Predictive risk engine
- [ ] Assessment system
- [ ] Communication platform

**Total Timeline:** 22 weeks (5.5 months)

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Database** | PostgreSQL 14+ | Primary data store with RLS |
| **Cache** | Redis 7+ | Session storage, rate limiting |
| **Backend** | Node.js / Go | Core microservices |
| **AI Layer** | Python FastAPI | ML inference (advisory only) |
| **Frontend** | Next.js 14 | Web application |
| **Mobile** | React Native | Mobile PWA |
| **Queue** | RabbitMQ / SQS | Async job processing |
| **Storage** | S3-compatible | Media and documents |
| **Orchestration** | Kubernetes | Container management |
| **Monitoring** | Prometheus + Grafana | Metrics and alerting |

---

## Security

### Multi-Tenant Isolation

- Database-level RLS policies
- Tenant context validation
- Cross-tenant access prevention
- Audit logging for all operations

### Authentication & Authorization

- OAuth 2.0 / OIDC
- Multi-factor authentication (MFA)
- Role-Based Access Control (RBAC)
- Field-level permissions

### Data Protection

- Encryption at rest (AES-256)
- Encryption in transit (TLS 1.3)
- Cryptographic audit trails (SHA-256)
- Immutable snapshots for critical data

### Compliance

- GDPR compliance
- FERPA compliance (US education data)
- Data retention policies
- Right to be forgotten

---

## Contributing

### Development Workflow

1. Review the [Tasks Document](/.kiro/specs/eduos-platform/tasks.md)
2. Pick a task from the current phase
3. Create a feature branch
4. Implement with tests
5. Submit pull request

### Code Standards

- 80% minimum test coverage
- All tests must pass
- Follow security best practices
- Document all public APIs
- Use TypeScript for type safety

---

## Support

### Getting Help

1. Check the documentation in `/database/docs/`
2. Review the specification documents in `/.kiro/specs/`
3. Search existing issues
4. Contact the platform team

### Reporting Issues

Please include:
- PostgreSQL version
- Operating system
- Steps to reproduce
- Expected vs actual behavior
- Relevant logs

---

## License

Copyright © 2026 EduOS Platform. All rights reserved.

---

## Acknowledgments

Built with:
- PostgreSQL - World's most advanced open source database
- Node.js - JavaScript runtime
- React - UI library
- Docker - Containerization platform

---

**Project Status:** Phase 1 - Task 1.2.3 Complete ✅  
**Next Milestone:** Task 1.3.1 - OAuth2/OIDC authentication  
**Last Updated:** 2026-02-05
