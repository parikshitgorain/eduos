# Audit Log API Documentation

## Overview

The Audit Log API provides comprehensive event logging capabilities with tamper-evident hash chains, digital signatures, and flexible search and export functionality. All audit logs are immutable and cryptographically secured using SHA-256 hashing.

## Features

- **Comprehensive Event Logging**: Logs all critical events including login, logout, data access, data modification, and permission changes
- **Tamper-Evident Hash Chain**: Each audit entry is cryptographically linked to the previous entry using SHA-256 hashing
- **Digital Signatures**: Audit log exports include digital signatures for verification
- **Flexible Search**: Filter audit logs by user, event type, action, resource, date range, and severity
- **Retention Policies**: Configurable retention periods based on tenant tier (7 years for Basic, 10 years for Business, 99 years for Enterprise)
- **Integrity Verification**: Built-in verification to detect any tampering with audit logs
- **JSON Format**: Structured JSON format with all relevant context (user, tenant, IP, user agent, etc.)

## Event Types

The system logs the following event types:

### Authentication Events
- `user_login` - Successful user login
- `user_logout` - User logout
- `login_failed` - Failed login attempt
- `password_reset` - Password reset
- `mfa_enabled` - Multi-factor authentication enabled
- `mfa_disabled` - Multi-factor authentication disabled

### Data Access Events
- `data_access` - Data read/view operation
- `data_export` - Data export operation
- `bulk_export` - Bulk data export

### Data Modification Events
- `data_modification` - Data create/update/delete operation
- `bulk_modification` - Bulk data modification
- `data_deletion` - Data deletion
- `bulk_deletion` - Bulk data deletion

### Permission Events
- `permission_granted` - Permission granted to user
- `permission_revoked` - Permission revoked from user
- `role_assigned` - Role assigned to user
- `role_removed` - Role removed from user

### Schema Events
- `schema_created` - Schema created
- `schema_modified` - Schema modified
- `schema_migration` - Schema migration performed

### Merge Events
- `student_merged` - Student records merged
- `merge_reversed` - Merge operation reversed

### Payment Events
- `payment_created` - Payment created
- `payment_captured` - Payment captured
- `refund_requested` - Refund requested
- `refund_approved` - Refund approved
- `refund_processed` - Refund processed

### System Events
- `system_config_changed` - System configuration changed
- `tenant_created` - Tenant created
- `tenant_suspended` - Tenant suspended
- `ai_kill_switch_activated` - AI kill switch activated
- `ai_kill_switch_deactivated` - AI kill switch deactivated

## Actions

- `create` - Create operation
- `read` - Read/view operation
- `update` - Update operation
- `delete` - Delete operation
- `login` - Login operation
- `logout` - Logout operation
- `grant` - Grant permission
- `revoke` - Revoke permission
- `approve` - Approve operation
- `reject` - Reject operation
- `export` - Export operation
- `import` - Import operation

## Severity Levels

- `debug` - Debug information
- `info` - Informational message
- `warning` - Warning message
- `error` - Error message
- `critical` - Critical error

## API Endpoints

### 1. Search Audit Logs

**Endpoint:** `GET /api/v1/audit-logs`

**Description:** Search audit logs with flexible filtering options.

**Query Parameters:**
- `tenant_id` (required) - Tenant ID
- `user_id` (optional) - Filter by user ID
- `event_type` (optional) - Filter by event type
- `action` (optional) - Filter by action
- `resource_type` (optional) - Filter by resource type
- `resource_id` (optional) - Filter by resource ID
- `start_date` (optional) - Filter by start date (ISO 8601 format)
- `end_date` (optional) - Filter by end date (ISO 8601 format)
- `severity` (optional) - Filter by severity level
- `limit` (optional) - Limit number of results (default: 100, max: 1000)
- `offset` (optional) - Offset for pagination (default: 0)

**Example Request:**
```bash
GET /api/v1/audit-logs?tenant_id=tenant-123&event_type=user_login&start_date=2026-01-01T00:00:00Z&limit=50
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "audit-log-123",
      "tenant_id": "tenant-123",
      "event_type": "user_login",
      "action": "login",
      "resource_type": null,
      "resource_id": null,
      "user_id": "user-456",
      "user_email": "user@example.com",
      "user_role": "admin",
      "ip_address": "192.168.1.1",
      "user_agent": "Mozilla/5.0...",
      "request_id": "req-789",
      "session_id": "session-012",
      "event_data": {
        "success": true
      },
      "old_values": null,
      "new_values": null,
      "previous_hash": "abc123...",
      "current_hash": "def456...",
      "severity": "info",
      "status": "success",
      "error_message": null,
      "created_at": "2026-02-07T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0,
    "has_more": true
  }
}
```

### 2. Get Audit Log by ID

**Endpoint:** `GET /api/v1/audit-logs/:id`

**Description:** Retrieve a single audit log entry by ID.

**Query Parameters:**
- `tenant_id` (required) - Tenant ID

**Example Request:**
```bash
GET /api/v1/audit-logs/audit-log-123?tenant_id=tenant-123
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": "audit-log-123",
    "tenant_id": "tenant-123",
    "event_type": "data_modification",
    "action": "update",
    "resource_type": "student",
    "resource_id": "student-789",
    "user_id": "user-456",
    "user_email": "user@example.com",
    "old_values": {
      "name": "Old Name"
    },
    "new_values": {
      "name": "New Name"
    },
    "created_at": "2026-02-07T10:30:00Z"
  }
}
```

### 3. Export Audit Logs

**Endpoint:** `POST /api/v1/audit-logs/export`

**Description:** Export audit logs with digital signature for verification.

**Request Body:**
```json
{
  "tenant_id": "tenant-123",
  "user_id": "user-456",
  "event_type": "data_modification",
  "start_date": "2026-01-01T00:00:00Z",
  "end_date": "2026-12-31T23:59:59Z",
  "exported_by_user_id": "admin-123"
}
```

**Example Response:**
```json
{
  "success": true,
  "export": {
    "tenant_id": "tenant-123",
    "export_date": "2026-02-07T10:30:00Z",
    "total_entries": 1500,
    "integrity_verified": true,
    "filters": {
      "userId": "user-456",
      "eventType": "data_modification",
      "startDate": "2026-01-01T00:00:00Z",
      "endDate": "2026-12-31T23:59:59Z"
    },
    "logs": [...],
    "signature": "a1b2c3d4e5f6..."
  }
}
```

### 4. Verify Audit Integrity

**Endpoint:** `POST /api/v1/audit-logs/verify`

**Description:** Verify the integrity of the audit log hash chain.

**Request Body:**
```json
{
  "tenant_id": "tenant-123",
  "start_date": "2026-01-01T00:00:00Z",
  "end_date": "2026-12-31T23:59:59Z",
  "verified_by_user_id": "admin-123"
}
```

**Example Response:**
```json
{
  "success": true,
  "verification": {
    "is_valid": true,
    "total_entries": 1500,
    "invalid_entries": 0,
    "first_invalid_id": null,
    "first_invalid_created_at": null,
    "error_message": null
  }
}
```

### 5. Get Retention Policy

**Endpoint:** `GET /api/v1/audit-logs/retention-policy`

**Description:** Get the retention policy for a tenant.

**Query Parameters:**
- `tenant_id` (required) - Tenant ID

**Example Response:**
```json
{
  "success": true,
  "policy": {
    "id": "policy-123",
    "tenant_id": "tenant-123",
    "retention_days": 36135,
    "archive_after_days": 365,
    "tier": "enterprise",
    "created_at": "2026-01-01T00:00:00Z",
    "updated_at": "2026-01-01T00:00:00Z"
  }
}
```

### 6. Set Retention Policy

**Endpoint:** `POST /api/v1/audit-logs/retention-policy`

**Description:** Set the retention policy for a tenant based on tier.

**Request Body:**
```json
{
  "tenant_id": "tenant-123",
  "tier": "enterprise",
  "updated_by_user_id": "admin-123"
}
```

**Retention Periods by Tier:**
- **Basic**: 2,555 days (7 years)
- **Business**: 3,650 days (10 years)
- **Enterprise**: 36,135 days (99 years)

**Example Response:**
```json
{
  "success": true,
  "policy": {
    "id": "policy-123",
    "tenant_id": "tenant-123",
    "retention_days": 36135,
    "tier": "enterprise",
    "created_at": "2026-01-01T00:00:00Z",
    "updated_at": "2026-02-07T10:30:00Z"
  }
}
```

### 7. Get Event Types

**Endpoint:** `GET /api/v1/audit-logs/event-types`

**Description:** Get list of all available event types.

**Example Response:**
```json
{
  "success": true,
  "event_types": [
    "user_login",
    "user_logout",
    "data_access",
    "data_modification",
    "permission_granted",
    ...
  ]
}
```

### 8. Get Actions

**Endpoint:** `GET /api/v1/audit-logs/actions`

**Description:** Get list of all available actions.

**Example Response:**
```json
{
  "success": true,
  "actions": [
    "create",
    "read",
    "update",
    "delete",
    "login",
    "logout",
    ...
  ]
}
```

## Automatic Event Logging

The system includes middleware that automatically logs HTTP requests and responses. This middleware can be configured to:

- Log all API requests
- Capture user context (user ID, email, role, IP address, user agent)
- Record request/response details (method, path, status code, response time)
- Exclude specific paths (e.g., health checks, metrics)
- Log only successful requests or all requests

### Usage Example

```javascript
const { auditLogger } = require('./middleware/auditLogger');

// Apply to all routes
app.use(auditLogger({
  excludePaths: ['/health', '/metrics'],
  logSuccessOnly: false
}));
```

## Manual Event Logging

For specific events that need to be logged manually, use the helper functions:

```javascript
const { logLogin, logLogout, logDataAccess, logDataModification, logPermissionChange } = require('./middleware/auditLogger');

// Log successful login
await logLogin(userId, userEmail, tenantId, true, ipAddress, userAgent, db);

// Log failed login
await logLogin(null, userEmail, tenantId, false, ipAddress, userAgent, db);

// Log logout
await logLogout(userId, userEmail, tenantId, ipAddress, userAgent, db);

// Log data access
await logDataAccess({
  tenantId,
  userId,
  resourceType: 'student',
  resourceId: 'student-123',
  eventData: { fields: ['name', 'email'] }
}, db);

// Log data modification
await logDataModification({
  tenantId,
  userId,
  action: 'update',
  resourceType: 'student',
  resourceId: 'student-123',
  oldValues: { name: 'Old Name' },
  newValues: { name: 'New Name' }
}, db);

// Log permission change
await logPermissionChange({
  tenantId,
  userId,
  action: 'grant',
  resourceType: 'role',
  resourceId: 'role-123',
  eventData: { permission: 'read:students' }
}, db);
```

## Security Considerations

1. **Immutability**: Audit logs are immutable. Once created, they cannot be modified or deleted through the API.

2. **Hash Chain**: Each audit entry is cryptographically linked to the previous entry, making tampering detectable.

3. **Digital Signatures**: Exports include SHA-256 signatures for verification.

4. **Row-Level Security**: PostgreSQL RLS policies ensure tenants can only access their own audit logs.

5. **Retention Policies**: Automatic enforcement of retention policies based on tenant tier.

6. **Integrity Verification**: Regular integrity checks can detect any tampering with the audit log chain.

## Compliance

The audit log system supports compliance with:

- **GDPR**: Data subject access requests, right to be forgotten
- **FERPA**: Educational records audit requirements
- **SOC 2**: Audit trail requirements
- **HIPAA**: Healthcare data access logging (if applicable)

## Performance Considerations

- **Indexes**: Multiple indexes on tenant_id, user_id, event_type, action, resource, and created_at for fast queries
- **Pagination**: Use limit and offset parameters to paginate large result sets
- **Async Logging**: Automatic logging middleware logs asynchronously to avoid blocking requests
- **Read Replicas**: Consider using read replicas for audit log queries to avoid impacting primary database performance

## Best Practices

1. **Regular Verification**: Run integrity verification regularly (daily or weekly) to detect tampering
2. **Export for Compliance**: Export audit logs periodically for compliance and archival purposes
3. **Monitor Retention**: Ensure retention policies are set correctly for each tenant tier
4. **Review Critical Events**: Regularly review critical events (failed logins, permission changes, data exports)
5. **Secure Exports**: Store exported audit logs securely with their digital signatures
6. **Alert on Anomalies**: Set up alerts for unusual patterns (e.g., bulk deletions, failed login spikes)

## Troubleshooting

### Integrity Verification Fails

If integrity verification fails:
1. Check the `first_invalid_id` and `first_invalid_created_at` in the verification response
2. Investigate what happened around that time
3. Check database logs for any unauthorized access
4. Contact security team immediately

### Missing Audit Logs

If audit logs are missing:
1. Check if the middleware is properly configured
2. Verify database connection is working
3. Check for errors in application logs
4. Ensure RLS policies are not blocking log creation

### Performance Issues

If audit log queries are slow:
1. Use appropriate filters to narrow down results
2. Use pagination with reasonable limits
3. Consider using date range filters
4. Check database indexes are present
5. Consider using read replicas for queries

## Support

For questions or issues with the audit log system, contact the platform team or refer to the main documentation at `/docs/README.md`.
