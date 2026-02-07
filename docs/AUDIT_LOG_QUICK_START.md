# Audit Log System - Quick Start Guide

## Overview

The EduOS Platform includes a comprehensive audit logging system that automatically tracks all critical events with tamper-evident hash chains and digital signatures.

## Quick Setup

### 1. Enable Automatic Logging

Add the audit logger middleware to your Express app:

```javascript
const express = require('express');
const { auditLogger } = require('./middleware/auditLogger');

const app = express();

// Enable automatic audit logging for all routes
app.use(auditLogger({
  excludePaths: ['/health', '/metrics'],  // Paths to exclude
  logSuccessOnly: false                    // Log all requests or only successful ones
}));
```

### 2. Manual Event Logging

For specific events that need custom logging:

```javascript
const { 
  logLogin, 
  logLogout, 
  logDataAccess, 
  logDataModification, 
  logPermissionChange 
} = require('./middleware/auditLogger');

// Log successful login
await logLogin(
  userId,
  userEmail,
  tenantId,
  true,           // success
  ipAddress,
  userAgent,
  db
);

// Log data modification
await logDataModification({
  tenantId: 'tenant-123',
  userId: 'user-456',
  action: 'update',
  resourceType: 'student',
  resourceId: 'student-789',
  oldValues: { name: 'Old Name' },
  newValues: { name: 'New Name' }
}, db);
```

## Common Use Cases

### Search Audit Logs

```bash
# Get all login events for a user
GET /api/v1/audit-logs?tenant_id=tenant-123&user_id=user-456&event_type=user_login

# Get all data modifications in date range
GET /api/v1/audit-logs?tenant_id=tenant-123&event_type=data_modification&start_date=2026-01-01T00:00:00Z&end_date=2026-12-31T23:59:59Z

# Get critical events
GET /api/v1/audit-logs?tenant_id=tenant-123&severity=critical
```

### Export Audit Logs

```bash
POST /api/v1/audit-logs/export
Content-Type: application/json

{
  "tenant_id": "tenant-123",
  "start_date": "2026-01-01T00:00:00Z",
  "end_date": "2026-12-31T23:59:59Z"
}
```

### Verify Integrity

```bash
POST /api/v1/audit-logs/verify
Content-Type: application/json

{
  "tenant_id": "tenant-123"
}
```

## Event Types Reference

### Authentication
- `user_login` - User logged in
- `user_logout` - User logged out
- `login_failed` - Login attempt failed

### Data Operations
- `data_access` - Data was read/viewed
- `data_modification` - Data was created/updated/deleted
- `data_export` - Data was exported

### Permissions
- `permission_granted` - Permission was granted
- `permission_revoked` - Permission was revoked
- `role_assigned` - Role was assigned to user

### System
- `system_config_changed` - System configuration changed
- `ai_kill_switch_activated` - AI services disabled

## Log Format

Every audit log entry includes:

```json
{
  "id": "audit-log-123",
  "tenant_id": "tenant-123",
  "event_type": "data_modification",
  "action": "update",
  "resource_type": "student",
  "resource_id": "student-789",
  "user_id": "user-456",
  "user_email": "user@example.com",
  "user_role": "admin",
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "event_data": { "custom": "data" },
  "old_values": { "name": "Old" },
  "new_values": { "name": "New" },
  "previous_hash": "abc123...",
  "current_hash": "def456...",
  "severity": "info",
  "status": "success",
  "created_at": "2026-02-07T10:30:00Z"
}
```

## Retention Policies

Audit logs are retained based on tenant tier:

- **Basic**: 7 years (2,555 days)
- **Business**: 10 years (3,650 days)
- **Enterprise**: 99 years (36,135 days)

Set retention policy:

```bash
POST /api/v1/audit-logs/retention-policy
Content-Type: application/json

{
  "tenant_id": "tenant-123",
  "tier": "enterprise"
}
```

## Security Features

1. **Immutable**: Logs cannot be modified or deleted
2. **Hash Chain**: Each log is cryptographically linked to the previous one
3. **Digital Signatures**: Exports include SHA-256 signatures
4. **Tenant Isolation**: Row-Level Security ensures data separation
5. **Integrity Verification**: Detect any tampering attempts

## Best Practices

1. **Regular Verification**: Run integrity checks weekly
2. **Monitor Critical Events**: Set up alerts for failed logins, permission changes
3. **Export for Compliance**: Export logs quarterly for archival
4. **Review Anomalies**: Investigate unusual patterns promptly
5. **Secure Exports**: Store exported logs with their signatures

## Troubleshooting

### Logs Not Appearing

1. Check middleware is configured: `app.use(auditLogger())`
2. Verify database connection is working
3. Check `req.db` is available in request context
4. Review application logs for errors

### Slow Queries

1. Use date range filters to narrow results
2. Use pagination with reasonable limits (≤ 1000)
3. Add indexes if querying custom fields frequently
4. Consider using read replicas for queries

### Integrity Verification Failed

1. Check `first_invalid_id` in verification response
2. Investigate what happened at that time
3. Review database logs for unauthorized access
4. Contact security team immediately

## API Reference

For complete API documentation, see: `docs/AUDIT_LOG_API.md`

## Support

For questions or issues:
- Check main documentation: `docs/README.md`
- Review API reference: `docs/AUDIT_LOG_API.md`
- Contact platform team

---

**Quick Links:**
- [Full API Documentation](./AUDIT_LOG_API.md)
- [Implementation Summary](./tasks/TASK_4.2.2_IMPLEMENTATION_SUMMARY.md)
- [Main Documentation](./README.md)
