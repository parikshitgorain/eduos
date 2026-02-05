# EduOS Database - Quick Reference Card

## Connection

```bash
# Local PostgreSQL
psql -U eduos_app -d eduos_db -h localhost -p 5432

# Docker
docker-compose exec postgres psql -U eduos_app -d eduos_db
```

## Setup Commands

```bash
# Validate files
powershell -ExecutionPolicy Bypass -File database/validate.ps1

# Start Docker
docker-compose up -d postgres

# Apply migration (Docker)
docker-compose exec postgres psql -U postgres -d eduos_db -f /docker-entrypoint-initdb.d/001_setup_rls_foundation.sql

# Run tests
psql -U eduos_app -d eduos_db -f database/tests/rls_isolation.test.sql
```

## RLS Usage

### Set Tenant Context
```sql
-- Set tenant context (required before queries)
SET LOCAL app.current_tenant_id = '11111111-1111-1111-1111-111111111111';

-- Check current context
SELECT current_setting('app.current_tenant_id', TRUE);
```

### Query with RLS
```sql
-- RLS automatically filters by tenant
SELECT * FROM students WHERE status = 'active';

-- Equivalent to (but you don't write this):
-- SELECT * FROM students 
-- WHERE status = 'active' 
-- AND tenant_id = current_tenant_id();
```

## Application Integration

### Node.js
```javascript
// Set context in middleware
await db.query('SET LOCAL app.current_tenant_id = $1', [tenantId]);

// Query (RLS auto-filters)
const students = await db.query('SELECT * FROM students');
```

### Python
```python
# Set context
cursor.execute("SET LOCAL app.current_tenant_id = %s", (tenant_id,))

# Query (RLS auto-filters)
cursor.execute("SELECT * FROM students")
```

## Common Operations

### Create Tenant
```sql
INSERT INTO tenants (name, subdomain, tier)
VALUES ('School A', 'school-a', 'Business')
RETURNING tenant_id;
```

### Create Student
```sql
-- Set context first!
SET LOCAL app.current_tenant_id = '<tenant-id>';

INSERT INTO students (tenant_id, first_name, last_name, email)
VALUES ('<tenant-id>', 'John', 'Doe', 'john@example.com')
RETURNING student_id;
```

### Query Students
```sql
-- Set context first!
SET LOCAL app.current_tenant_id = '<tenant-id>';

SELECT * FROM students WHERE status = 'active';
```

## Troubleshooting

### Query returns 0 rows
```sql
-- Check if context is set
SELECT current_setting('app.current_tenant_id', TRUE);

-- If NULL, set it
SET LOCAL app.current_tenant_id = '<tenant-id>';
```

### Permission denied
```bash
# Use eduos_app user, not postgres
psql -U eduos_app -d eduos_db
```

### RLS not working
```sql
-- Check if RLS is enabled
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'students';

-- Enable if needed
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
```

## Performance

### Check Query Plan
```sql
EXPLAIN ANALYZE
SELECT * FROM students WHERE status = 'active';

-- Look for "Index Scan" (good) vs "Seq Scan" (bad)
```

### Add Index
```sql
CREATE INDEX idx_students_status 
ON students(tenant_id, status);
```

## Tables

| Table | RLS | Purpose |
|-------|-----|---------|
| tenants | No | Tenant configuration |
| students | Yes | Student profiles |
| enrollments | Yes | Enrollment records |
| attendance | Yes | Attendance tracking |
| payments | Yes | Financial transactions |

## Key Columns

- **tenant_id** - UUID, required on all RLS tables
- **student_id** - UUID, primary key for students
- **idempotency_key** - Prevents duplicate attendance
- **webhook_id** - Prevents duplicate payments

## Environment Variables

```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=eduos_db
DB_USER=eduos_app
DB_PASSWORD=your_password
```

## Documentation

- Full Guide: `database/docs/RLS_POLICY_REFERENCE.md`
- Setup: `database/README.md`
- Tests: `database/tests/rls_isolation.test.sql`

## Support

1. Check documentation
2. Run validation: `database/validate.ps1`
3. Review test suite for examples
4. Contact platform team
