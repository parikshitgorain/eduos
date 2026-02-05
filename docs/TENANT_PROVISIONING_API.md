# Tenant Provisioning API

## Overview

The Tenant Provisioning API allows you to create and manage multi-tenant organizations within the EduOS Platform. Each tenant represents an educational institution with isolated data and configurable resource quotas.

**Task:** 1.1.3 - Create tenant provisioning API

## Features

- ✅ Create new tenants with UUID v4 identifiers
- ✅ Automatic database schema initialization
- ✅ Tier-based resource quota configuration (Basic/Business/Enterprise)
- ✅ Subdomain validation and uniqueness enforcement
- ✅ Audit logging for all tenant operations
- ✅ RESTful API with comprehensive error handling

## API Endpoints

### Create Tenant

**POST** `/api/v1/tenants`

Creates a new tenant with automatic schema initialization and quota configuration.

**Request Body:**
```json
{
  "name": "Example School",
  "subdomain": "example-school",
  "tier": "Basic",
  "metadata": {
    "contact_email": "admin@example.com",
    "phone": "+1234567890"
  }
}
```

**Required Fields:**
- `name` (string, 2-255 characters): Institution name
- `subdomain` (string, 2-63 characters): Unique subdomain identifier (lowercase alphanumeric with hyphens)
- `tier` (string): One of `Basic`, `Business`, or `Enterprise`

**Optional Fields:**
- `metadata` (object): Additional tenant information

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Tenant created successfully",
  "data": {
    "tenant": {
      "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Example School",
      "subdomain": "example-school",
      "tier": "Basic",
      "status": "active",
      "created_at": "2026-02-05T10:30:00Z",
      "updated_at": "2026-02-05T10:30:00Z",
      "metadata": {
        "contact_email": "admin@example.com",
        "phone": "+1234567890"
      }
    },
    "quotas": {
      "max_students": 500,
      "max_storage_gb": 10,
      "max_api_calls_per_day": 10000,
      "max_concurrent_users": 50,
      "backup_retention_days": 30,
      "support_level": "email"
    }
  }
}
```

**Error Responses:**

- **400 Bad Request:** Invalid input data
  ```json
  {
    "success": false,
    "error": "Bad Request",
    "message": "Validation failed: subdomain must be lowercase alphanumeric with hyphens"
  }
  ```

- **409 Conflict:** Subdomain already exists
  ```json
  {
    "success": false,
    "error": "Conflict",
    "message": "Subdomain already exists"
  }
  ```

### Get Tenant by ID

**GET** `/api/v1/tenants/:tenantId`

Retrieves a tenant by its UUID.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Example School",
    "subdomain": "example-school",
    "tier": "Basic",
    "status": "active",
    "max_students": 500,
    "current_students": 42,
    "max_storage_gb": 10,
    "current_storage_gb": "2.35",
    "support_level": "email",
    "created_at": "2026-02-05T10:30:00Z",
    "updated_at": "2026-02-05T10:30:00Z"
  }
}
```

### Get Tenant by Subdomain

**GET** `/api/v1/tenants/subdomain/:subdomain`

Retrieves a tenant by its subdomain.

**Example:** `GET /api/v1/tenants/subdomain/example-school`

### List Tenants

**GET** `/api/v1/tenants`

Lists all tenants with pagination and filtering.

**Query Parameters:**
- `page` (integer, default: 1): Page number
- `limit` (integer, default: 20, max: 100): Items per page
- `status` (string): Filter by status (`active`, `suspended`, `deleted`)
- `tier` (string): Filter by tier (`Basic`, `Business`, `Enterprise`)

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Example School",
      "subdomain": "example-school",
      "tier": "Basic",
      "status": "active",
      "max_students": 500,
      "current_students": 42,
      "support_level": "email",
      "created_at": "2026-02-05T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "pages": 1
  }
}
```

### Update Tenant

**PATCH** `/api/v1/tenants/:tenantId`

Updates tenant information.

**Request Body:**
```json
{
  "name": "Updated School Name",
  "tier": "Business",
  "status": "active",
  "metadata": {
    "contact_email": "newadmin@example.com"
  }
}
```

**Allowed Fields:**
- `name` (string)
- `tier` (string): Changing tier automatically updates quotas
- `status` (string): `active`, `suspended`, or `deleted`
- `metadata` (object)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Tenant updated successfully",
  "data": {
    "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Updated School Name",
    "tier": "Business",
    "status": "active",
    "updated_at": "2026-02-05T11:00:00Z"
  }
}
```

## Tier-Based Resource Quotas

### Basic Tier
- **Max Students:** 500
- **Max Storage:** 10 GB
- **API Calls/Day:** 10,000
- **Concurrent Users:** 50
- **Backup Retention:** 30 days
- **Support Level:** Email

### Business Tier
- **Max Students:** 5,000
- **Max Storage:** 100 GB
- **API Calls/Day:** 100,000
- **Concurrent Users:** 500
- **Backup Retention:** 90 days
- **Support Level:** Priority

### Enterprise Tier
- **Max Students:** Unlimited
- **Max Storage:** Unlimited
- **API Calls/Day:** Unlimited
- **Concurrent Users:** Unlimited
- **Backup Retention:** 365 days
- **Support Level:** 24/7

## Subdomain Validation Rules

1. **Format:** Lowercase alphanumeric characters and hyphens only
2. **Length:** 2-63 characters
3. **Pattern:** Must start and end with alphanumeric character
4. **Reserved:** Cannot use reserved subdomains: `www`, `api`, `admin`, `app`, `mail`, `ftp`, `localhost`, `staging`, `dev`, `test`
5. **Uniqueness:** Must be globally unique across all tenants

**Valid Examples:**
- `example-school`
- `abc123`
- `my-school-2026`

**Invalid Examples:**
- `Example-School` (uppercase)
- `-example` (starts with hyphen)
- `example_school` (underscore not allowed)
- `admin` (reserved)

## Database Schema

### Tenants Table
```sql
CREATE TABLE tenants (
    tenant_id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE NOT NULL,
    tier VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    metadata JSONB
);
```

### Tenant Quotas Table
```sql
CREATE TABLE tenant_quotas (
    quota_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL UNIQUE,
    max_students INTEGER NOT NULL,
    max_storage_gb INTEGER NOT NULL,
    max_api_calls_per_day INTEGER NOT NULL,
    max_concurrent_users INTEGER NOT NULL,
    backup_retention_days INTEGER NOT NULL,
    support_level VARCHAR(20) NOT NULL,
    current_students INTEGER NOT NULL DEFAULT 0,
    current_storage_gb DECIMAL(10, 2) NOT NULL DEFAULT 0,
    current_api_calls_today INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
```

## Automatic Schema Initialization

When a tenant is created, the system automatically:

1. **Creates Tenant Record:** Generates UUID v4 and stores tenant information
2. **Initializes Quotas:** Creates quota record with tier-based limits
3. **Sets Up RLS:** Row-Level Security policies automatically isolate tenant data
4. **Creates Audit Log:** Records tenant creation event
5. **Initializes Counters:** Sets current usage counters to zero

## Usage Examples

### cURL Examples

**Create a Basic Tier Tenant:**
```bash
curl -X POST http://localhost:3000/api/v1/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Springfield Elementary",
    "subdomain": "springfield-elementary",
    "tier": "Basic"
  }'
```

**Get Tenant by ID:**
```bash
curl http://localhost:3000/api/v1/tenants/550e8400-e29b-41d4-a716-446655440000
```

**List All Active Tenants:**
```bash
curl "http://localhost:3000/api/v1/tenants?status=active&limit=10"
```

### JavaScript/Node.js Example

```javascript
const axios = require('axios');

async function createTenant() {
  try {
    const response = await axios.post('http://localhost:3000/api/v1/tenants', {
      name: 'Springfield Elementary',
      subdomain: 'springfield-elementary',
      tier: 'Business',
      metadata: {
        contact_email: 'admin@springfield.edu',
        phone: '+1-555-0123'
      }
    });
    
    console.log('Tenant created:', response.data.data.tenant);
    console.log('Quotas:', response.data.data.quotas);
  } catch (error) {
    console.error('Error:', error.response.data);
  }
}

createTenant();
```

## Testing

Run the integration tests:

```bash
npm test -- src/routes/tenants.test.js
```

The test suite validates:
- ✅ Tenant creation with all three tiers
- ✅ UUID v4 generation
- ✅ Quota configuration per tier
- ✅ Subdomain validation and uniqueness
- ✅ Database schema initialization
- ✅ Audit log creation
- ✅ Error handling for invalid inputs
- ✅ End-to-end tenant provisioning workflow

## Migration

Run the database migration to create required tables:

```bash
npm run migrate
```

This will execute:
- `001_setup_rls_foundation.sql` - Core tables with RLS
- `002_tenant_provisioning.sql` - Tenant quotas and audit logs

## Security Considerations

1. **Input Validation:** All inputs are validated before database operations
2. **SQL Injection Prevention:** Parameterized queries used throughout
3. **Subdomain Restrictions:** Reserved subdomains blocked to prevent conflicts
4. **Audit Logging:** All tenant operations logged for compliance
5. **Quota Enforcement:** Database triggers prevent quota violations

## Next Steps

After tenant provisioning:

1. **Domain Resolution (Task 1.2.1):** Map custom domains to tenants
2. **Auth Service (Task 1.3.1):** Implement OAuth2/OIDC authentication
3. **Tenant Context:** Use tenant_id in JWT tokens for API access

## Support

For issues or questions about the Tenant Provisioning API, please refer to:
- API Documentation: `/docs/TENANT_PROVISIONING_API.md`
- Database Schema: `/database/migrations/`
- Integration Tests: `/src/routes/tenants.test.js`
