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

#### ✅ Task 1.3.1: OAuth2/OIDC Authentication - COMPLETED
- ✅ OAuth 2.0 authorization code flow with PKCE
- ✅ OIDC discovery endpoint implemented
- ✅ JWT token generation with RS256 signing
- ✅ Token expiry: 1 hour (access), 7 days (refresh)
- ✅ Integration with Google and Microsoft SSO
- ✅ 22 unit tests passing

#### ✅ Task 1.3.2: Hierarchical RBAC - COMPLETED
- ✅ Role hierarchy: SuperAdmin → InstituteAdmin → CenterAdmin → Teacher → Student
- ✅ Permission inheritance from parent roles
- ✅ Field-level permissions (read/write)
- ✅ API endpoint: GET `/auth/permissions`
- ✅ 19 unit tests passing

#### ✅ Task 1.3.3: Session Management with Redis - COMPLETED
- ✅ Redis-backed session storage with sliding expiration
- ✅ Session includes: user_id, tenant_id, roles, permissions
- ✅ Concurrent session limits (Basic: 2, Business: 5, Enterprise: 10)
- ✅ Session revocation API for logout and security events
- ✅ Session activity tracking for audit logs
- ✅ 50 unit tests passing (32 service + 18 routes)

#### ✅ Task 1.3.4: Multi-Factor Authentication (MFA) - COMPLETED
- ✅ TOTP-based MFA using authenticator apps
- ✅ QR code generation for easy setup
- ✅ Backup codes (10 single-use codes, SHA-256 hashed)
- ✅ Tenant-level MFA enforcement policies
- ✅ Recovery flow for lost devices
- ✅ 46 unit tests passing (24 service + 22 routes)

**Phase 1 Complete!** 🎉 All Auth Service tasks finished.

---

## Security

### 🔒 Security Hardening - COMPLETED

The EduOS Platform implements enterprise-grade security measures:

#### Security Features

✅ **No Hardcoded Secrets** - Application fails fast if secrets not configured  
✅ **Comprehensive Rate Limiting** - Protection against brute force and DDoS  
✅ **Strict CORS Policy** - Whitelist-based origin validation  
✅ **Input Validation** - Comprehensive validation and sanitization  
✅ **Security Headers** - CSP, HSTS, X-Frame-Options, and more  
✅ **Encryption** - AES-256-CBC for MFA secrets, bcrypt for passwords  
✅ **Audit Logging** - Immutable audit trail for all sensitive operations  

#### Security Audit Results

- **npm audit**: 0 vulnerabilities
- **Tests**: 470/470 passing
- **OWASP Top 10**: Compliant
- **CWE Top 25**: Mitigated

#### Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| General API | 100 requests | 15 minutes |
| Authentication | 5 attempts | 15 minutes |
| Password Reset | 3 requests | 1 hour |
| MFA Verification | 10 attempts | 15 minutes |

For detailed security information, see:
- [Security Guide](docs/SECURITY.md)
- [Security Fixes Report](docs/SECURITY_FIXES_REPORT.md)
- [Implementation Summary](docs/tasks/SECURITY_HARDENING_IMPLEMENTATION_SUMMARY.md)

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
- [Task 1.3.1](docs/tasks/TASK_1.3.1_IMPLEMENTATION_SUMMARY.md) - OAuth2/OIDC Authentication ✅
- [Task 1.3.2](docs/tasks/TASK_1.3.2_IMPLEMENTATION_SUMMARY.md) - Hierarchical RBAC ✅
- [Task 1.3.3](docs/tasks/TASK_1.3.3_IMPLEMENTATION_SUMMARY.md) - Session Management ✅
- [Task 1.3.4](docs/tasks/TASK_1.3.4_IMPLEMENTATION_SUMMARY.md) - Multi-Factor Authentication ✅
- [Task 2.1.1](docs/tasks/TASK_2.1.1_IMPLEMENTATION_SUMMARY.md) - Hierarchical Entity Tree ✅
- [Task 2.1.2](docs/tasks/TASK_2.1.2_IMPLEMENTATION_SUMMARY.md) - Hierarchy Navigation ✅
- [Task 2.1.3](docs/tasks/TASK_2.1.3_IMPLEMENTATION_SUMMARY.md) - Student Enrollment Workflow ✅
- [Task 2.2.1](docs/tasks/TASK_2.2.1_IMPLEMENTATION_SUMMARY.md) - Schema Definition and Storage System ✅
- [Task 2.2.2](docs/tasks/TASK_2.2.2_IMPLEMENTATION_SUMMARY.md) - Immutable Schema Snapshots ✅
- [Task 2.2.3](docs/tasks/TASK_2.2.3_IMPLEMENTATION_SUMMARY.md) - Field-Level Permission System ✅
- [Task 2.2.4](docs/tasks/TASK_2.2.4_IMPLEMENTATION_SUMMARY.md) - Schema Migration Engine ✅
- [Task 2.2.5](docs/tasks/TASK_2.2.5_IMPLEMENTATION_SUMMARY.md) - Historic Rendering ✅

**Authentication:**
- [Auth Service](docs/AUTH_SERVICE.md) - OAuth2/OIDC authentication service
- [RBAC System](docs/RBAC_SYSTEM.md) - Hierarchical role-based access control
- [RBAC Quick Reference](docs/RBAC_QUICK_REFERENCE.md) - Quick reference guide
- [Session Management](docs/SESSION_MANAGEMENT.md) - Redis-backed session handling
- [MFA System](docs/MFA_SYSTEM.md) - Multi-factor authentication documentation
- [MFA Quick Start](docs/MFA_QUICK_START.md) - Developer quick reference for MFA

**Domain & Caching:**
- [Domain Mapping](docs/DOMAIN_MAPPING.md) - Custom domain resolution
- [Domain Verification](docs/DOMAIN_VERIFICATION_WORKFLOW.md) - DNS verification workflow
- [Cache Layer](docs/CACHE_LAYER.md) - Redis caching architecture

**Enrollment:**
- [Enrollment Workflow](docs/ENROLLMENT_WORKFLOW.md) - Student enrollment management

**Schema System:**
- [Schema System](docs/SCHEMA_SYSTEM.md) - Dynamic form schema management
- [Schema Quick Start](docs/SCHEMA_QUICK_START.md) - Developer quick reference
- [Historic Rendering](docs/HISTORIC_RENDERING.md) - Schema snapshot association and rendering

---

## Development Roadmap

### Phase 1: SaaS Foundation (Weeks 1-4)

- [x] Task 1.1.1: PostgreSQL with RLS policies ✅
- [x] Task 1.1.2: Tenant context middleware ✅
- [x] Task 1.1.3: Tenant provisioning API ✅
- [x] Task 1.2.1: Custom domain mapping ✅
- [x] Task 1.2.2: Domain verification workflow ✅
- [x] Task 1.2.3: Tenant routing cache ✅
- [x] Task 1.3.1: OAuth2/OIDC authentication ✅
- [x] Task 1.3.2: Hierarchical RBAC ✅
- [x] Task 1.3.3: Session management ✅
- [x] Task 1.3.4: Multi-factor authentication ✅

**Phase 1 Complete!** 🎉

### Phase 2: Core Domain & Hierarchy (Weeks 5-8)

#### ✅ Task 2.1.1: Hierarchical Entity Tree - COMPLETED
- ✅ Institute → Center → Program → Batch hierarchy
- ✅ Database schema with RLS policies
- ✅ Cascade delete protection
- ✅ CRUD API endpoints for all levels
- ✅ 35 unit tests passing

#### ✅ Task 2.1.2: Hierarchy Navigation - COMPLETED
- ✅ GET `/api/v1/hierarchy/:nodeId/children` endpoint
- ✅ GET `/api/v1/hierarchy/:nodeId/ancestors` endpoint
- ✅ GET `/api/v1/hierarchy/tree` endpoint
- ✅ Permission inheritance (child can only restrict)
- ✅ Performance < 50ms for 10,000 nodes
- ✅ 56 unit tests passing

#### ✅ Task 2.1.3: Student Enrollment Workflow - COMPLETED
- ✅ Students can enroll in multiple batches
- ✅ Enrollment data: start_date, end_date, status (active/inactive/graduated/withdrawn)
- ✅ Immutable enrollment history with status tracking
- ✅ Bulk enrollment API for CSV imports
- ✅ Duplicate prevention validation
- ✅ 40 unit tests passing (19 service + 21 routes)

#### ✅ Task 2.2.1: Schema Definition and Storage System - COMPLETED
- ✅ JSON schema format for form definitions
- ✅ Schema stored in `schema_snapshots` table with versioning
- ✅ Field types: text, number, date, dropdown, checkbox, file_upload (+ 4 more)
- ✅ Validation rules: required, min/max, regex, custom validators (+ 5 more)
- ✅ Schema export/import API for portability
- ✅ Cryptographic integrity with SHA-256 hashing
- ✅ Semantic versioning (SemVer)
- ✅ 33 unit tests passing

#### ✅ Task 2.2.2: Immutable Schema Snapshots with SHA-256 Hashing - COMPLETED
- ✅ Append-only database constraints (triggers prevent UPDATE/DELETE)
- ✅ SHA-256 hash computed for integrity verification
- ✅ Semantic versioning with parent-child linking
- ✅ Nightly cryptographic integrity check job
- ✅ Integrity check logging and alerting
- ✅ Database functions for batch verification
- ✅ API endpoint for manual integrity checks
- ✅ 17 unit tests passing (100%)

#### ✅ Task 2.2.3: Field-Level Permission System - COMPLETED
- ✅ Field permissions: visible_to_roles, editable_by_roles
- ✅ Permission inheritance hierarchy (Global → Batch)
- ✅ Permission resolution algorithm (set intersection)
- ✅ Preview-as-role functionality for admins
- ✅ API: POST `/api/v1/schemas/:id/preview` returns role-specific view
- ✅ Bulk permission updates
- ✅ Permission hierarchy validation
- ✅ 56 unit tests passing (35 service + 21 routes)

#### ✅ Task 2.2.4: Schema Migration Engine with Dry-Run Mode - COMPLETED
- ✅ Dry-run API simulates migration on sample records (1K-10K)
- ✅ Migration report: fields affected, validation failures, impact estimate
- ✅ Auto-rollback on failure (within SLA: 30s Enterprise, 5min Business, 15min Basic)
- ✅ Migration audit log with before/after snapshots
- ✅ Impact analysis: breaking changes, warnings, field modifications
- ✅ Safety recommendations based on validation results
- ✅ Admin-only execution with force override option
- ✅ 27 unit tests passing (9 service + 18 routes)

#### ✅ Task 2.2.5: Historic Rendering with Snapshot Association - COMPLETED
- ✅ Student records store immutable `snapshot_id` reference
- ✅ Rendering engine uses original schema snapshot for historical records
- ✅ UI displays schema version badge (e.g., "Schema v1.2.3 - 2025-06-15")
- ✅ Schema transformation export for admin-initiated conversions
- ✅ SHA-256 integrity check on every render
- ✅ 17 unit tests passing (100%)

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

**Project Status:** Phase 1 Complete ✅ | Phase 2 In Progress (8/14 tasks)  
**Next Milestone:** Task 2.3.1 - Build Offline-First Mobile Attendance Module  
**Last Updated:** 2026-02-05
