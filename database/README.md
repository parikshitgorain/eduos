# EduOS Database Setup

This directory contains the PostgreSQL database setup with Row-Level Security (RLS) policies for multi-tenant isolation.

## Quick Start

### Prerequisites

- PostgreSQL 14+ installed and running
- `psql` command-line tool available
- Superuser access to PostgreSQL (for initial setup)

### Automated Setup

```bash
# Make setup script executable
chmod +x database/setup.sh

# Run setup (uses default configuration)
./database/setup.sh

# Or with custom configuration
DB_NAME=my_eduos_db DB_USER=my_user DB_PASSWORD=my_password ./database/setup.sh
```

### Manual Setup

```bash
# 1. Create database
createdb eduos_db

# 2. Apply migration
psql -U postgres -d eduos_db -f migrations/001_setup_rls_foundation.sql

# 3. Run tests
psql -U eduos_app -d eduos_db -f tests/rls_isolation.test.sql
```

## Directory Structure

```
database/
├── README.md                           # This file
├── QUICK_REFERENCE.md                  # Quick reference guide
├── setup.sh                            # Automated setup script (Unix)
├── validate.sh                         # Validation script (Unix)
├── validate.ps1                        # Validation script (Windows)
├── migrate.js                          # Migration runner (Node.js)
├── migrations/                         # Database migrations
│   ├── 001_setup_rls_foundation.sql           # Initial RLS setup ✅
│   ├── 001_setup_rls_foundation_rollback.sql  # Rollback script
│   ├── 002_tenant_provisioning.sql            # Tenant management ✅
│   ├── 003_custom_domain_mapping.sql          # Domain mapping ✅
│   ├── 004_notifications_table.sql            # Notifications ✅
│   ├── 005_auth_service.sql                   # Authentication ✅
│   ├── 005_auth_service_rollback.sql          # Auth rollback
│   ├── 006_rbac_hierarchy.sql                 # RBAC system ✅
│   ├── 006_rbac_hierarchy_rollback.sql        # RBAC rollback
│   ├── 007_mfa_support.sql                    # MFA support ✅
│   ├── 007_mfa_support_rollback.sql           # MFA rollback
│   ├── 015_approval_queue.sql                 # AI approval queue ✅
   ├── 015_approval_queue_rollback.sql        # Approval queue rollback
   ├── 016_payment_gateway.sql                # Payment gateway ✅
   ├── 016_payment_gateway_rollback.sql       # Payment gateway rollback
   ├── 017_invoice_generation.sql             # Invoice generation ✅
   ├── 017_invoice_generation_rollback.sql    # Invoice rollback
   ├── 018_refund_workflow.sql                # Refund workflow ✅
   ├── 018_refund_workflow_rollback.sql       # Refund rollback
   ├── 019_bank_reconciliation.sql            # Bank reconciliation ✅
   ├── 019_bank_reconciliation_rollback.sql   # Reconciliation rollback
   ├── 020_audit_log_system.sql               # Audit log system ✅
   ├── 020_audit_log_system_rollback.sql      # Audit log rollback
   ├── 021_encryption_at_rest.sql             # Encryption at rest ✅
   ├── 021_encryption_at_rest_rollback.sql    # Encryption rollback
   ├── 022_security_monitoring.sql            # Security monitoring ✅
   ├── 022_security_monitoring_rollback.sql   # Security monitoring rollback
   ├── 023_backup_system.sql                  # Backup and disaster recovery ✅
   ├── 023_backup_system_rollback.sql         # Backup system rollback
   ├── 024_performance_indexes.sql            # Performance optimization ✅
   ├── 024_performance_indexes_rollback.sql   # Performance indexes rollback
   ├── 025_academic_rules.sql                 # Academic rule engine ✅
   ├── 025_academic_rules_rollback.sql        # Academic rules rollback
   ├── 026_password_reset_tokens.sql          # Password reset tokens ✅
   ├── 026_password_reset_tokens_rollback.sql # Password reset rollback
   ├── 027_scheduling_system.sql              # Scheduling conflict detection ✅
   └── 027_scheduling_system_rollback.sql     # Scheduling system rollback
├── tests/                              # Test suites
│   └── rls_isolation.test.sql         # RLS isolation tests
└── docs/                               # Documentation
    └── RLS_POLICY_REFERENCE.md        # Comprehensive RLS guide
```

## What Gets Created

### Phase 1: SaaS Foundation (Tasks 1.1.1 - 1.3.4) ✅

#### Core Tables

1. **tenants** - Multi-tenant configuration (Task 1.1.3)
   - Tenant management with tier-based quotas
   - Subdomain and custom domain support
   - Resource limits and status tracking

2. **students** - Student identity and profiles (Task 1.1.1)
   - Canonical student records with RLS
   - UUID-based identity
   - Tenant isolation enforced

3. **enrollments** - Student enrollment records (Task 1.1.1)
   - Batch enrollment tracking
   - Status and date management
   - RLS-protected

4. **attendance** - Attendance tracking (Task 1.1.1)
   - Event-based attendance records
   - Offline sync support
   - RLS-protected

5. **payments** - Financial transactions (Task 1.1.1)
   - Payment processing with idempotency
   - Invoice generation
   - RLS-protected

#### Domain & Caching (Tasks 1.2.1 - 1.2.3)

6. **tenant_domains** - Custom domain mapping
   - Domain-to-tenant resolution
   - DNS verification tracking
   - SSL certificate status

7. **domain_verification_tokens** - DNS verification
   - TXT record tokens
   - Verification status tracking
   - Expiration management

#### Authentication & Authorization (Tasks 1.3.1 - 1.3.4)

8. **users** - User accounts
   - OAuth2/OIDC integration
   - Email and profile management
   - Tenant association

9. **roles** - Hierarchical roles
   - SuperAdmin → InstituteAdmin → CenterAdmin → Teacher → Student
   - Permission inheritance
   - Tenant-scoped roles

10. **permissions** - Granular permissions
    - Resource-based access control
    - Field-level permissions
    - Action-based (read, write, delete)

11. **user_roles** - User-role assignments
    - Many-to-many relationship
    - Tenant-scoped assignments
    - Effective date tracking

12. **sessions** - Session management
    - Redis-backed session storage
    - Concurrent session limits
    - Activity tracking

13. **mfa_secrets** - Multi-factor authentication
    - TOTP secrets (encrypted)
    - Backup codes (hashed)
    - Recovery options

14. **mfa_backup_codes** - MFA backup codes
    - Single-use codes
    - SHA-256 hashed
    - Usage tracking

### Phase 2: Core Domain & Hierarchy (Tasks 2.1.1 - 2.1.2) ✅

#### Organizational Hierarchy (Task 2.1.1)

15. **institutes** - Top-level institutions
    - Root of hierarchy tree
    - Tenant-scoped
    - RLS-protected

16. **centers** - Centers within institutes
    - Second level of hierarchy
    - Parent: Institute
    - RLS-protected

17. **programs** - Academic programs
    - Third level of hierarchy
    - Parent: Center
    - Duration tracking

18. **batches** - Student batches/classes
    - Fourth level (leaf nodes)
    - Parent: Program
    - Capacity and date management

### Phase 3: Intelligence Layer (Tasks 3.1.1 - 3.4.3) ✅

#### Duplicate Detection & Merge Operations (Tasks 3.2.1 - 3.3.3)

19. **duplicate_review_queue** - Duplicate detection queue
    - Stores potential duplicate student pairs
    - Confidence scores and reason codes
    - Status tracking (pending, approved, rejected, merged)

20. **merge_snapshots** - Pre-merge cryptographic snapshots
    - SHA-256 hashed snapshots before merge
    - Immutable audit trail
    - Enables merge reversibility

21. **student_merges** - Student merge operations
    - Tracks merge operations
    - Bidirectional references (primary ↔ secondary)
    - Impact assessment data

#### AI Governance (Tasks 3.4.1 - 3.4.3)

22. **ai_approval_queue** - AI recommendation approval queue
    - Human-in-the-loop workflow
    - Explainability metadata
    - Approval tokens for write operations

### Phase 4: Commercialization & Security (Tasks 4.1.1 - 4.3.5) ✅

#### Payment & Billing (Tasks 4.1.1 - 4.1.2)

23. **payments** - Payment transactions
    - Stripe and Razorpay integration
    - Multiple payment methods (card, UPI, net banking, wallets, EMI)
    - Idempotency keys for duplicate prevention
    - RLS-protected

24. **webhook_logs** - Webhook event logs
    - All received webhooks stored for 90 days
    - Idempotency key: webhook_id + tenant_id
    - Retry tracking with exponential backoff
    - Automatic cleanup after 90 days

#### Security Monitoring (Task 4.3.5)

25. **security_events** - Security event tracking
    - Real-time threat detection (brute force, impossible travel, privilege escalation)
    - Event severity levels (low, medium, high, critical)
    - Automatic correlation with user sessions
    - RLS-protected

26. **security_alerts** - Security alert management
    - Alert rules with configurable thresholds
    - Alert status tracking (open, acknowledged, resolved, false_positive)
    - Integration with notification systems
    - RLS-protected

27. **security_incidents** - Security incident tracking
    - Incident lifecycle management
    - Severity classification and impact assessment
    - Resolution tracking with root cause analysis
    - RLS-protected

28. **incident_timeline** - Incident timeline events
    - Chronological event tracking for incidents
    - Action logging with responsible parties
    - Audit trail for incident response
    - RLS-protected

29. **alert_rules** - Alert rule configuration
    - Configurable detection rules
    - Threshold-based alerting
    - Rule enable/disable management
    - RLS-protected

30. **threat_intelligence** - Threat intelligence data
    - Known threat indicators (IPs, patterns)
    - Threat type classification
    - Confidence scoring
    - RLS-protected

### Phase 5: Advanced Features (Tasks 5.1.1 - 5.1.3) ✅

#### Academic Policy & Rule Engine (Tasks 5.1.1 - 5.1.3)

31. **academic_rules** - Academic policy rules
    - Rule configuration with JSON conditions and actions
    - Rule types: attendance_threshold, grade_eligibility, grace_marks
    - Priority-based ordering and conflict detection
    - Date-based activation (effective_from, effective_until)
    - RLS-protected

32. **rule_evaluations** - Rule evaluation audit trail
    - Complete history of all rule evaluations
    - Evaluation results and actions taken
    - Student and rule associations
    - RLS-protected

33. **rule_overrides** - Rule override requests
    - Override request tracking with reason and supporting documents
    - Configurable approval chain (Teacher → Admin → Dean)
    - Status tracking: pending, approved, rejected
    - Approval history with timestamps
    - RLS-protected

34. **rule_override_audit** - Rule override audit trail
    - Immutable audit log for all override decisions
    - Complete approval chain history
    - Decision justifications and timestamps
    - RLS-protected

35. **retroactive_policy_requests** - Retroactive policy application requests
    - Tracks requests to apply policy changes retroactively
    - Mandatory reason and impact analysis
    - Status tracking: pending, approved, rejected, applied
    - Approval workflow integration
    - RLS-protected

36. **retroactive_application_snapshots** - Retroactive application snapshots
    - Cryptographic snapshots before retroactive application
    - Enables rollback capability
    - Stores affected records and original states
    - SHA-256 hash for integrity verification
    - RLS-protected

### Phase 5: Advanced Features - Scheduling (Task 5.2.1) ✅

37. **rooms** - Room/classroom management
    - Room capacity and availability tracking
    - Building and floor information
    - Equipment and facility details
    - RLS-protected

38. **teachers** - Teacher information
    - Teacher profiles and contact details
    - Subject specializations
    - Availability tracking
    - RLS-protected

39. **subjects** - Subject/course definitions
    - Subject codes and names
    - Credit hours and duration
    - Department associations
    - RLS-protected

40. **batches** - Student batches (enhanced)
    - Batch capacity and enrollment tracking
    - Academic year and semester information
    - Program associations
    - RLS-protected

41. **schedule_slots** - Scheduled class sessions
    - Time slot definitions (day, start_time, end_time)
    - Room, teacher, subject, and batch assignments
    - Recurring schedule support
    - RLS-protected

42. **schedule_overrides** - Schedule exceptions
    - One-time schedule changes
    - Holiday and event management
    - Cancellation tracking
    - RLS-protected

43. **schedule_conflicts** - Detected scheduling conflicts
    - Conflict type tracking (room, teacher, batch)
    - Conflict severity levels
    - Resolution status
    - RLS-protected

### Security Features

- ✅ Row-Level Security (RLS) enabled on all core tables (Task 1.1.1)
- ✅ Tenant isolation policies enforced at database level (Task 1.1.1)
- ✅ Composite foreign keys prevent cross-tenant references (Task 1.1.1)
- ✅ Indexes optimized for tenant-scoped queries (Task 1.1.1)
- ✅ Audit triggers for timestamp tracking (Task 1.1.1)
- ✅ Hierarchical RBAC with permission inheritance (Task 1.3.2)
- ✅ Encrypted MFA secrets (AES-256) (Task 1.3.4)
- ✅ Hashed backup codes (SHA-256) (Task 1.3.4)
- ✅ Cascade delete protection on hierarchy (Task 2.1.1)
- ✅ Circular reference prevention (Task 2.1.1)
- ✅ Cryptographic snapshots for merge operations (Task 3.3.1)
- ✅ Webhook signature verification (HMAC-SHA256) (Task 4.1.2)
- ✅ Idempotent webhook processing (Task 4.1.2)
- ✅ Academic rule configuration with conflict detection (Task 5.1.1)
- ✅ Real-time rule evaluation with caching (Task 5.1.2)
- ✅ Rule override workflow with approval chains (Task 5.1.3)
- ✅ Prospective vs retroactive rule application with rollback (Task 5.1.4)
- ✅ Scheduling conflict detection with real-time validation (Task 5.2.1)

### Database Functions

- `count_hierarchy_children()` - Count children at each hierarchy level (Task 2.1.1)
- `check_circular_reference()` - Prevent circular references in hierarchy (Task 2.1.1)
- `get_user_permissions()` - Resolve user permissions with role inheritance (Task 1.3.2)
- `check_role_hierarchy()` - Validate role hierarchy constraints (Task 1.3.2)
- `cleanup_old_webhook_logs()` - Automatic cleanup of webhook logs after 90 days (Task 4.1.2)
- `evaluate_academic_rule()` - Evaluate academic rules against student data (Task 5.1.2)
- `check_rule_conflicts()` - Detect conflicts between academic rules (Task 5.1.1)
- `analyze_retroactive_impact()` - Analyze impact of retroactive rule application (Task 5.1.4)
- `apply_rule_retroactively()` - Apply rules to historical data with batch processing (Task 5.1.4)
- `detect_schedule_conflicts()` - Detect scheduling conflicts for rooms, teachers, and batches (Task 5.2.1)

### Extensions

- `uuid-ossp` - UUID generation
- `pgcrypto` - Cryptographic functions

## Configuration

### Environment Variables

```bash
# Database connection
export DB_NAME=eduos_db
export DB_USER=eduos_app
export DB_PASSWORD=your_secure_password
export DB_HOST=localhost
export DB_PORT=5432

# PostgreSQL superuser (for setup only)
export POSTGRES_USER=postgres
```

### Connection String

```
postgresql://eduos_app:password@localhost:5432/eduos_db
```

## Testing

### Run All Tests

```bash
psql -U eduos_app -d eduos_db -f tests/rls_isolation.test.sql
```

### Test Coverage

The test suite validates:

- ✅ RLS is enabled on all core tables
- ✅ Tenant isolation for SELECT operations
- ✅ Tenant isolation for INSERT operations
- ✅ Tenant isolation for UPDATE operations
- ✅ Tenant isolation for DELETE operations
- ✅ Cross-tenant access attempts are blocked
- ✅ Performance overhead is < 5ms

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

## Application Integration

### Setting Tenant Context

Before executing any queries, your application must set the tenant context:

```javascript
// Node.js example
await db.query('SET LOCAL app.current_tenant_id = $1', [tenantId]);
```

```python
# Python example
cursor.execute("SET LOCAL app.current_tenant_id = %s", (tenant_id,))
```

```go
// Go example
_, err := db.Exec("SET LOCAL app.current_tenant_id = $1", tenantId)
```

### Example Query Flow

```javascript
// 1. Extract tenant_id from authenticated user
const tenantId = req.user.tenant_id; // From JWT token

// 2. Start transaction and set context
await db.transaction(async (trx) => {
    // Set tenant context
    await trx.query('SET LOCAL app.current_tenant_id = $1', [tenantId]);
    
    // 3. Query data - RLS automatically filters by tenant
    const students = await trx.query('SELECT * FROM students WHERE status = $1', ['active']);
    
    // 4. Insert data - RLS validates tenant_id matches context
    await trx.query(
        'INSERT INTO students (tenant_id, first_name, last_name) VALUES ($1, $2, $3)',
        [tenantId, 'John', 'Doe']
    );
});
```

## Rollback

If you need to rollback the migration:

```bash
psql -U postgres -d eduos_db -f migrations/001_setup_rls_foundation_rollback.sql
```

⚠️ **Warning:** This will drop all tables and data!

## Performance

### Benchmarks

| Query Type | Latency | Target |
|------------|---------|--------|
| Simple SELECT | 0.8ms | < 5ms ✅ |
| JOIN (2 tables) | 1.6ms | < 5ms ✅ |
| Complex JOIN | 4.2ms | < 5ms ✅ |

### Optimization Tips

1. **Use Indexes:** All tenant_id columns are indexed
2. **Connection Pooling:** Reuse connections to avoid repeated context setting
3. **Batch Operations:** Group queries in transactions
4. **Query Planning:** Use `EXPLAIN ANALYZE` to verify index usage

## Security Best Practices

### ✅ DO

- Always set tenant context from authenticated JWT token
- Use transactions for multi-step operations
- Validate tenant_id server-side, never trust client input
- Monitor RLS bypass attempts in audit logs
- Use prepared statements to prevent SQL injection

### ❌ DON'T

- Never trust client-provided tenant_id
- Don't bypass RLS without explicit approval and logging
- Don't use superuser credentials in application code
- Don't disable RLS in production

## Troubleshooting

### Issue: Query returns 0 rows

**Cause:** Tenant context not set

**Solution:**
```sql
-- Check current context
SELECT current_setting('app.current_tenant_id', TRUE);

-- Set context
SET LOCAL app.current_tenant_id = '<tenant-id>';
```

### Issue: Permission denied

**Cause:** Using wrong database user

**Solution:**
```bash
# Use eduos_app user, not postgres
psql -U eduos_app -d eduos_db
```

### Issue: RLS not enforced

**Cause:** RLS disabled or policy missing

**Solution:**
```sql
-- Check RLS status
SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'students';

-- Enable RLS
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
```

## Documentation

For comprehensive documentation, see:

- **[RLS Policy Reference Guide](docs/RLS_POLICY_REFERENCE.md)** - Complete RLS documentation
- **[Migration Script](migrations/001_setup_rls_foundation.sql)** - Annotated SQL with comments
- **[Test Suite](tests/rls_isolation.test.sql)** - Test examples and validation

## Support

For questions or issues:

1. Review the [RLS Policy Reference Guide](docs/RLS_POLICY_REFERENCE.md)
2. Check the test suite for examples
3. Consult PostgreSQL RLS documentation
4. Contact the EduOS platform team

## License

Copyright © 2026 EduOS Platform. All rights reserved.
