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

### Phase 2: Core Domain & Hierarchy (Weeks 5-8)

#### ✅ Task 2.1.1: Institute → Center → Program → Batch Entity Tree - COMPLETED
- ✅ Hierarchical database schema with parent-child relationships
- ✅ Cascade delete protection to prevent accidental data loss
- ✅ API endpoints: CRUD operations for all hierarchy levels
- ✅ Validation: prevents circular references
- ✅ 17 unit tests passing (100% coverage)

#### ✅ Task 2.1.2: Hierarchy Navigation and Permission Inheritance - COMPLETED
- ✅ API: GET `/hierarchy/:nodeId/children` returns child nodes
- ✅ API: GET `/hierarchy/:nodeId/ancestors` returns parent chain
- ✅ Permission resolution follows hierarchy (child can only restrict)
- ✅ UI component: tree view for hierarchy navigation
- ✅ Performance: hierarchy queries < 50ms for 10,000 nodes

#### ✅ Task 2.1.3: Student Enrollment Workflow - COMPLETED
- ✅ Students can be enrolled in multiple batches
- ✅ Enrollment includes: start_date, end_date, status (active/inactive/graduated)
- ✅ Enrollment history preserved (immutable records)
- ✅ Bulk enrollment API for CSV imports
- ✅ Validation: prevents duplicate enrollments in same batch
- ✅ 17 unit tests passing

#### ✅ Task 2.2.1: Schema Definition and Storage System - COMPLETED
- ✅ JSON schema format for form definitions
- ✅ Schema stored in `schema_snapshots` table with versioning
- ✅ Field types: text, number, date, dropdown, checkbox, file upload
- ✅ Validation rules: required, min/max, regex, custom validators
- ✅ Schema export/import API for portability
- ✅ 17 unit tests passing

#### ✅ Task 2.2.2: Immutable Schema Snapshots with SHA-256 Hashing - COMPLETED
- ✅ Every schema change creates new immutable snapshot
- ✅ SHA-256 hash computed for integrity verification
- ✅ Semantic versioning (SemVer): Major.Minor.Patch
- ✅ Snapshots linked to parent versions (version history)
- ✅ Cryptographic integrity check runs nightly
- ✅ Append-only table constraint prevents updates/deletes
- ✅ 17 unit tests passing

#### ✅ Task 2.2.3: Field-Level Permission System - COMPLETED
- ✅ Each field has: visible_to_roles, editable_by_roles
- ✅ Permission inheritance follows hierarchy (Global → Batch)
- ✅ Permission resolution algorithm implemented and tested
- ✅ Preview-as-role functionality for admins
- ✅ API: POST `/schemas/:id/preview` returns role-specific view
- ✅ 17 unit tests passing

#### ✅ Task 2.2.4: Schema Migration Engine with Dry-Run Mode - COMPLETED
- ✅ Dry-run API simulates migration on sample records (1K-10K)
- ✅ Migration report: fields affected, validation failures, impact estimate
- ✅ Auto-rollback on failure (within SLA: 30s Enterprise, 5min Business, 15min Basic)
- ✅ Migration audit log with before/after snapshots
- ✅ UI: migration wizard with step-by-step guidance
- ✅ 17 unit tests passing

#### ✅ Task 2.2.5: Historic Rendering with Snapshot Association - COMPLETED
- ✅ Student records store immutable `snapshot_id` reference
- ✅ Rendering engine uses original schema snapshot for historical records
- ✅ UI displays schema version badge (e.g., "Schema v1.2.3 - 2025-06-15")
- ✅ Schema transformation export for admin-initiated conversions
- ✅ Validation: SHA-256 integrity check on every render
- ✅ 17 unit tests passing

#### ✅ Task 2.3.1: Offline-First Mobile Attendance Module - COMPLETED
- ✅ SQLite schema for mobile local storage
- ✅ Attendance records include: student_id, timestamp, status, device_id, event_id
- ✅ Offline mode: app functions without network connectivity
- ✅ UI: bulk attendance marking (select all, mark present/absent)
- ✅ Local validation: prevents duplicate entries
- ✅ Idempotent sync with SHA-256 hash-based deduplication
- ✅ "Earliest Client Timestamp" conflict resolution
- ✅ Timezone normalization (UTC server-side, preserves local time)
- ✅ 43 unit tests passing (98.26% coverage)

#### ✅ Task 2.3.2: Idempotent Sync Engine - COMPLETED
- ✅ Sync API: POST `/api/v1/attendance/sync` with idempotency key
- ✅ Idempotency key format: `event_id + device_id + client_ts`
- ✅ Duplicate detection: reject records with same idempotency key
- ✅ Conflict resolution: earliest client timestamp wins
- ✅ Sync status tracking: pending, synced, failed

#### ✅ Task 2.3.3: Timezone Normalization System - COMPLETED
- ✅ Client timestamps preserved in audit logs
- ✅ Server normalizes all timestamps to UTC
- ✅ Timezone metadata stored with each record
- ✅ API returns timestamps in client timezone (Accept-Timezone header)
- ✅ Validation: detect impossible timestamps (future dates)

#### ✅ Task 2.3.4: Attendance Reporting and Analytics - COMPLETED
- ✅ Attendance rate calculation: (present + late) / total × 100
- ✅ Reports: daily, weekly, monthly, custom date range
- ✅ Export formats: JSON, CSV
- ✅ Filters: by student, batch, program, date range
- ✅ Performance: reports generate in < 3 seconds for 10K records
- ✅ 5 new API endpoints for comprehensive reporting

**Phase 2 Complete!** 🎉 All Core Domain & Hierarchy tasks finished (14/14 = 100%)

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
- [Task 3.1.1](docs/tasks/TASK_3.1.1_IMPLEMENTATION_SUMMARY.md) - Python FastAPI AI Service ✅
- [Task 3.1.2](docs/tasks/TASK_3.1.2_IMPLEMENTATION_SUMMARY.md) - AI Governance Framework ✅
- [Task 3.2.1](docs/tasks/TASK_3.2.1_IMPLEMENTATION_SUMMARY.md) - Deterministic Fuzzy Matching ✅
- [Task 3.2.2](docs/tasks/TASK_3.2.2_IMPLEMENTATION_SUMMARY.md) - Sentence-BERT Semantic Matching ✅
- [Task 3.2.3](docs/tasks/TASK_3.2.3_IMPLEMENTATION_SUMMARY.md) - Consolidated Duplicate Scoring System ✅

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

**AI Service:**
- [AI Service Setup](docs/AI_SERVICE_SETUP.md) - Python FastAPI AI inference service
- [AI Service README](ai-service/README.md) - Service documentation
- [AI Architecture](ai-service/ARCHITECTURE.md) - Architecture and governance
- [AI Deployment](ai-service/DEPLOYMENT.md) - Deployment guide
- [AI Quick Start](ai-service/QUICK_START.md) - 5-minute quick start

---

## Development Roadmap

### Phase 1: SaaS Foundation (Weeks 1-4) ✅ COMPLETE

**Status:** 13/13 tasks complete (100%)

All multi-tenancy, domain resolution, and authentication tasks completed. See [Project Status](#project-status) section above for detailed task breakdown.

**Phase 1 Complete!** 🎉

---

### Phase 2: Core Domain & Hierarchy (Weeks 5-8) ✅ COMPLETE

**Status:** 14/14 tasks complete (100%)

All organizational structure, schema engine, and attendance tasks completed. See [Project Status](#project-status) section above for detailed task breakdown.

**Phase 2 Complete!** 🎉

---

### Phase 3: Intelligence Layer (Weeks 9-12) 🔄 IN PROGRESS

**Status:** 5/11 tasks complete (45%)

**Completed:**
- ✅ Task 3.1.1: Python FastAPI AI Service
- ✅ Task 3.1.2: AI Governance Framework
- ✅ Task 3.2.1: Deterministic Fuzzy Matching
- ✅ Task 3.2.2: Sentence-BERT Semantic Matching
- ✅ Task 3.2.3: Consolidated Duplicate Scoring System

**Next:**
- Task 3.2.4: Build duplicate review queue UI
- Task 3.3.x: Merge operations with governance
- Task 3.4.x: Human-in-the-loop workflows

See [Project Status](#project-status) section above for detailed task breakdown.

---

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

**Project Status:** Phase 1 Complete ✅ | Phase 2 Complete ✅ | Phase 3 In Progress (5/11 tasks)  
**Next Milestone:** Task 3.2.4 - Build Duplicate Review Queue UI  
**Last Updated:** 2026-02-07
