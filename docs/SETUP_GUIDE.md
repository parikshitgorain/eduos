# EduOS Platform - Setup Guide

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+
- Docker (optional, for containerized setup)

## Quick Start

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd eduos-platform
npm install
```

### 2. Database Setup

#### Option A: Local PostgreSQL

1. Install PostgreSQL 14+ on your system

2. Create database and user:
```sql
-- Connect to PostgreSQL as superuser
psql -U postgres

-- Create database
CREATE DATABASE eduos_db;

-- Create application user
CREATE USER eduos_app WITH PASSWORD 'your_secure_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE eduos_db TO eduos_app;
```

3. Copy environment file:
```bash
cp .env.example .env
```

4. Update `.env` with your database credentials:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=eduos_db
DB_USER=eduos_app
DB_PASSWORD=your_secure_password
JWT_SECRET=your_long_random_secret_key_here
```

#### Option B: Docker Compose

```bash
# Start PostgreSQL in Docker
docker-compose up -d postgres

# Database will be available at localhost:5432
# Default credentials are in docker-compose.yml
```

### 3. Run Database Migrations

```bash
npm run migrate
```

This will create all required tables:
- `tenants` - Tenant organizations
- `tenant_quotas` - Resource quotas per tenant
- `audit_logs` - Audit trail
- `students` - Student records
- `enrollments` - Student enrollments
- `attendance` - Attendance records
- `payments` - Payment transactions

### 4. Start the Server

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

The API will be available at `http://localhost:3000`

### 5. Verify Installation

```bash
# Check health endpoint
curl http://localhost:3000/health

# Expected response:
# {
#   "status": "healthy",
#   "timestamp": "2026-02-05T10:30:00.000Z",
#   "database": "connected"
# }
```

## Running Tests

### Unit and Integration Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- src/routes/tenants.test.js
```

**Note:** Integration tests require a running PostgreSQL database with the migrations applied.

### Test Database Setup

For testing, you can create a separate test database:

```sql
CREATE DATABASE eduos_test_db;
GRANT ALL PRIVILEGES ON DATABASE eduos_test_db TO eduos_app;
```

Update your `.env` for test environment:
```env
NODE_ENV=test
DB_NAME=eduos_test_db
```

## API Usage Examples

### Create a Tenant

```bash
curl -X POST http://localhost:3000/api/v1/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Springfield Elementary",
    "subdomain": "springfield-elementary",
    "tier": "Basic"
  }'
```

### Get Tenant by ID

```bash
curl http://localhost:3000/api/v1/tenants/{tenant_id}
```

### List All Tenants

```bash
curl http://localhost:3000/api/v1/tenants
```

## Development Workflow

### 1. Create a New Migration

Create a new SQL file in `database/migrations/`:

```sql
-- database/migrations/003_your_migration_name.sql
-- Description: What this migration does

-- Your SQL here
CREATE TABLE example (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL
);

-- Record migration
INSERT INTO schema_migrations (version, description)
VALUES ('003', 'Your migration description')
ON CONFLICT (version) DO NOTHING;
```

### 2. Run the Migration

```bash
npm run migrate
```

### 3. Create Tests

Add tests in `src/**/*.test.js` files following the existing patterns.

### 4. Run Linter

```bash
npm run lint
```

## Project Structure

```
eduos-platform/
├── database/
│   ├── migrations/          # SQL migration files
│   │   ├── 001_setup_rls_foundation.sql
│   │   └── 002_tenant_provisioning.sql
│   ├── migrate.js           # Migration runner
│   └── README.md
├── docs/
│   ├── SETUP_GUIDE.md       # This file
│   └── TENANT_PROVISIONING_API.md
├── src/
│   ├── config/
│   │   └── database.js      # Database connection pool
│   ├── middleware/
│   │   └── tenantContext.js # Tenant isolation middleware
│   ├── routes/
│   │   ├── tenants.js       # Tenant API routes
│   │   └── tenants.test.js  # Tenant API tests
│   ├── services/
│   │   └── tenantService.js # Tenant business logic
│   └── server.js            # Express server
├── .env.example             # Environment template
├── package.json
└── README.md
```

## Environment Variables

### Required

- `DB_HOST` - PostgreSQL host (default: localhost)
- `DB_PORT` - PostgreSQL port (default: 5432)
- `DB_NAME` - Database name
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
- `JWT_SECRET` - Secret key for JWT tokens

### Optional

- `PORT` - API server port (default: 3000)
- `NODE_ENV` - Environment (development/test/production)
- `DB_POOL_MAX` - Max database connections (default: 20)
- `DB_POOL_MIN` - Min database connections (default: 2)

See `.env.example` for complete list.

## Troubleshooting

### Database Connection Errors

**Error:** `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string`

**Solution:** Ensure `DB_PASSWORD` is set in your `.env` file.

**Error:** `Connection refused`

**Solution:** 
1. Check PostgreSQL is running: `pg_isready`
2. Verify connection settings in `.env`
3. Check firewall rules

### Migration Errors

**Error:** `relation "tenants" already exists`

**Solution:** Migrations have already been applied. Check `schema_migrations` table:
```sql
SELECT * FROM schema_migrations;
```

### Test Failures

**Error:** Tests fail with database errors

**Solution:**
1. Ensure test database exists and migrations are applied
2. Set `NODE_ENV=test` in your environment
3. Check database credentials in `.env`

## Next Steps

After setup:

1. **Task 1.1.3 ✅ Complete** - Tenant provisioning API is ready
2. **Task 1.2.1** - Implement custom domain mapping
3. **Task 1.3.1** - Setup OAuth2/OIDC authentication

## Support

For issues or questions:
- Check documentation in `/docs`
- Review test files for usage examples
- Check database migrations for schema details

## Security Notes

⚠️ **Important for Production:**

1. Change all default passwords
2. Use strong random strings for `JWT_SECRET`
3. Enable HTTPS/TLS
4. Configure proper firewall rules
5. Set up database backups
6. Enable audit logging
7. Review and update rate limits
8. Use environment-specific `.env` files
9. Never commit `.env` files to version control
