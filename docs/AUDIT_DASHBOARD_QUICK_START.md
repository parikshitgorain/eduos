# Audit Dashboard Quick Start Guide

## Overview

This guide will help you quickly get started with the Audit Dashboard and Reporting system.

## Prerequisites

- Audit log system is set up and running (see `AUDIT_LOG_QUICK_START.md`)
- Database migrations have been applied
- User has appropriate role (superadmin, admin, auditor, or compliance_officer)

## Quick Start

### 1. View Dashboard Summary

Get a quick overview of audit activity for the last 24 hours:

```bash
curl -X GET "http://localhost:3000/api/v1/audit-dashboard/summary?tenant_id=YOUR_TENANT_ID" \
  -H "x-user-role: admin"
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "period_hours": 24,
    "total_events": 1500,
    "unique_users": 45,
    "failed_logins": 12,
    "critical_events": 3,
    "suspicious_events": 5
  }
}
```

### 2. Check for Suspicious Events

Detect potential security issues:

```bash
curl -X GET "http://localhost:3000/api/v1/audit-dashboard/suspicious-events?tenant_id=YOUR_TENANT_ID" \
  -H "x-user-role: admin"
```

**What it detects:**
- Multiple failed login attempts (≥5)
- Bulk operations (deletions, modifications, exports)
- Access from multiple IP addresses (≥3)
- Permission escalation attempts (≥3)

### 3. Detect Anomalies

Identify unusual access patterns:

```bash
curl -X GET "http://localhost:3000/api/v1/audit-dashboard/anomalies?tenant_id=YOUR_TENANT_ID" \
  -H "x-user-role: admin"
```

**What it detects:**
- After-hours access (before 6 AM or after 10 PM)
- Rapid operations (< 1 second apart)
- Unusual export volumes (≥5 exports)

### 4. View Top Users

See which users are most active:

```bash
curl -X GET "http://localhost:3000/api/v1/audit-dashboard/top-users?tenant_id=YOUR_TENANT_ID&limit=10" \
  -H "x-user-role: admin"
```

### 5. Generate Compliance Reports

#### GDPR Report

```bash
curl -X POST "http://localhost:3000/api/v1/audit-dashboard/reports/gdpr" \
  -H "Content-Type: application/json" \
  -H "x-user-role: compliance_officer" \
  -d '{
    "tenant_id": "YOUR_TENANT_ID",
    "start_date": "2026-01-01T00:00:00Z",
    "end_date": "2026-12-31T23:59:59Z"
  }'
```

#### FERPA Report

```bash
curl -X POST "http://localhost:3000/api/v1/audit-dashboard/reports/ferpa" \
  -H "Content-Type: application/json" \
  -H "x-user-role: compliance_officer" \
  -d '{
    "tenant_id": "YOUR_TENANT_ID",
    "start_date": "2026-01-01T00:00:00Z",
    "end_date": "2026-12-31T23:59:59Z"
  }'
```

### 6. Configure Real-time Alerts

Set up alerts for critical security events:

```bash
curl -X POST "http://localhost:3000/api/v1/audit-dashboard/alerts/configure" \
  -H "Content-Type: application/json" \
  -H "x-user-role: admin" \
  -d '{
    "tenant_id": "YOUR_TENANT_ID",
    "alert_type": "failed_logins",
    "threshold": 5,
    "notification_channels": ["email", "sms"],
    "recipients": ["admin@example.com", "+1234567890"],
    "enabled": true
  }'
```

**Available Alert Types:**
- `failed_logins` - Multiple failed login attempts
- `bulk_operations` - Bulk operations
- `suspicious_access` - Suspicious access patterns
- `permission_escalation` - Permission escalation attempts
- `after_hours_access` - Access outside business hours
- `unusual_export_volume` - Unusual data export volume

## Common Use Cases

### Daily Security Review

1. Check dashboard summary for anomalies
2. Review suspicious events
3. Investigate any critical events
4. Check top users for unusual activity

```bash
# Get summary
curl -X GET "http://localhost:3000/api/v1/audit-dashboard/summary?tenant_id=YOUR_TENANT_ID" \
  -H "x-user-role: admin"

# Check suspicious events
curl -X GET "http://localhost:3000/api/v1/audit-dashboard/suspicious-events?tenant_id=YOUR_TENANT_ID" \
  -H "x-user-role: admin"

# Check anomalies
curl -X GET "http://localhost:3000/api/v1/audit-dashboard/anomalies?tenant_id=YOUR_TENANT_ID" \
  -H "x-user-role: admin"
```

### Monthly Compliance Reporting

1. Generate GDPR report for the month
2. Generate FERPA report for the month
3. Review and export reports for compliance records

```bash
# Generate GDPR report
curl -X POST "http://localhost:3000/api/v1/audit-dashboard/reports/gdpr" \
  -H "Content-Type: application/json" \
  -H "x-user-role: compliance_officer" \
  -d '{
    "tenant_id": "YOUR_TENANT_ID",
    "start_date": "2026-01-01T00:00:00Z",
    "end_date": "2026-01-31T23:59:59Z"
  }'

# Generate FERPA report
curl -X POST "http://localhost:3000/api/v1/audit-dashboard/reports/ferpa" \
  -H "Content-Type: application/json" \
  -H "x-user-role: compliance_officer" \
  -d '{
    "tenant_id": "YOUR_TENANT_ID",
    "start_date": "2026-01-01T00:00:00Z",
    "end_date": "2026-01-31T23:59:59Z"
  }'
```

### Investigating Security Incidents

1. Check suspicious events for the incident timeframe
2. Review recent activity for affected users
3. Check anomalies for unusual patterns
4. Export audit logs for detailed analysis

```bash
# Check suspicious events for last 48 hours
curl -X GET "http://localhost:3000/api/v1/audit-dashboard/suspicious-events?tenant_id=YOUR_TENANT_ID&hours=48" \
  -H "x-user-role: admin"

# Get recent activity
curl -X GET "http://localhost:3000/api/v1/audit-dashboard/recent-activity?tenant_id=YOUR_TENANT_ID&hours=48&limit=100" \
  -H "x-user-role: admin"

# Export audit logs for detailed analysis
curl -X POST "http://localhost:3000/api/v1/audit-logs/export" \
  -H "Content-Type: application/json" \
  -H "x-user-role: admin" \
  -d '{
    "tenant_id": "YOUR_TENANT_ID",
    "start_date": "2026-02-06T00:00:00Z",
    "end_date": "2026-02-07T23:59:59Z"
  }'
```

## Role-Based Access

Only users with the following roles can access the audit dashboard:

| Role | Access Level |
|------|-------------|
| `superadmin` | Full access to all features |
| `admin` | Full access for their tenant |
| `auditor` | Read-only access to logs and reports |
| `compliance_officer` | Access to compliance reports and analytics |

**Example:**
```bash
# Admin access (allowed)
curl -X GET "http://localhost:3000/api/v1/audit-dashboard/summary?tenant_id=YOUR_TENANT_ID" \
  -H "x-user-role: admin"

# Student access (denied)
curl -X GET "http://localhost:3000/api/v1/audit-dashboard/summary?tenant_id=YOUR_TENANT_ID" \
  -H "x-user-role: student"
# Returns: 403 Forbidden
```

## Best Practices

1. **Daily Monitoring**: Review the dashboard summary daily
2. **Alert Configuration**: Set up alerts for critical events
3. **Regular Reports**: Generate compliance reports monthly or quarterly
4. **Investigate Anomalies**: Always investigate detected anomalies
5. **Document Incidents**: Document all security incidents and resolutions
6. **Review Top Users**: Monitor top users to ensure activity is legitimate
7. **After-Hours Review**: Review after-hours access regularly

## Troubleshooting

### No Data Showing

**Problem**: Dashboard shows no data or zero events.

**Solutions:**
1. Verify tenant_id is correct
2. Check that audit logs exist for the time period
3. Ensure user has proper role (admin, auditor, compliance_officer)
4. Verify RLS policies are configured correctly

### Access Denied

**Problem**: Receiving 403 Forbidden error.

**Solutions:**
1. Check that `x-user-role` header is set
2. Verify role is one of: superadmin, admin, auditor, compliance_officer
3. Ensure user has permission to access the tenant

### Suspicious Events Not Detected

**Problem**: No suspicious events detected when they should be.

**Solutions:**
1. Check detection thresholds (e.g., ≥5 failed logins)
2. Verify time window is sufficient (default: 24 hours)
3. Ensure audit logs are being created properly
4. Review database queries for performance issues

## Next Steps

- Read the full documentation: `AUDIT_DASHBOARD.md`
- Review audit log API: `AUDIT_LOG_API.md`
- Set up automated reporting
- Configure real-time alerts
- Integrate with SIEM systems

## Support

For questions or issues:
- Main documentation: `/docs/README.md`
- Audit log API: `/docs/AUDIT_LOG_API.md`
- Audit dashboard: `/docs/AUDIT_DASHBOARD.md`
