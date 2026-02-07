# Audit Dashboard & Reporting

## Overview

The Audit Dashboard provides comprehensive analytics, anomaly detection, and compliance reporting for audit logs. It enables administrators and compliance officers to monitor system activity, detect suspicious behavior, and generate compliance reports for GDPR and FERPA requirements.

## Features

- **Dashboard Summary**: Real-time metrics including total events, unique users, failed logins, and critical events
- **Recent Activity**: View recent audit log entries with filtering options
- **Top Users Analytics**: Identify most active users by event count
- **Suspicious Event Detection**: Automatically detect multiple failed logins, bulk operations, unusual IP access, and permission escalation attempts
- **Anomaly Detection**: Identify unusual access patterns including after-hours access, rapid operations, and unusual export volumes
- **Compliance Reports**: Generate GDPR and FERPA compliance reports with detailed metrics
- **Real-time Alerts**: Configure alerts for critical security events with email/SMS notifications
- **Role-Based Access**: Only authorized users (superadmin, admin, auditor, compliance_officer) can access the dashboard

## API Endpoints

### 1. Dashboard Summary

**Endpoint:** `GET /api/v1/audit-dashboard/summary`

**Description:** Get dashboard summary with key metrics for the specified time period.

**Query Parameters:**
- `tenant_id` (required) - Tenant ID
- `hours` (optional) - Number of hours to look back (default: 24)

**Required Role:** superadmin, admin, auditor, compliance_officer

**Example Request:**
```bash
curl -X GET "http://localhost:3000/api/v1/audit-dashboard/summary?tenant_id=tenant-123&hours=24" \
  -H "x-user-role: admin"
```

**Example Response:**
```json
{
  "success": true,
  "summary": {
    "period_hours": 24,
    "start_date": "2026-02-06T10:30:00Z",
    "total_events": 1500,
    "unique_users": 45,
    "failed_logins": 12,
    "critical_events": 3,
    "suspicious_events": 5
  }
}
```

### 2. Recent Activity

**Endpoint:** `GET /api/v1/audit-dashboard/recent-activity`

**Description:** Get recent audit log entries.

**Query Parameters:**
- `tenant_id` (required) - Tenant ID
- `limit` (optional) - Limit number of results (default: 50)
- `hours` (optional) - Number of hours to look back (default: 24)

**Example Response:**
```json
{
  "success": true,
  "activity": [
    {
      "id": "log-123",
      "event_type": "user_login",
      "action": "login",
      "resource_type": null,
      "resource_id": null,
      "user_id": "user-456",
      "user_email": "user@example.com",
      "user_role": "admin",
      "severity": "info",
      "status": "success",
      "created_at": "2026-02-07T10:30:00Z"
    }
  ]
}
```

### 3. Top Users

**Endpoint:** `GET /api/v1/audit-dashboard/top-users`

**Description:** Get top users by activity count.

**Query Parameters:**
- `tenant_id` (required) - Tenant ID
- `limit` (optional) - Limit number of results (default: 10)
- `hours` (optional) - Number of hours to look back (default: 24)

**Example Response:**
```json
{
  "success": true,
  "top_users": [
    {
      "user_id": "user-123",
      "user_email": "admin@example.com",
      "user_role": "admin",
      "event_count": 250,
      "unique_event_types": 15,
      "last_activity": "2026-02-07T10:30:00Z"
    }
  ]
}
```

### 4. Suspicious Events Detection

**Endpoint:** `GET /api/v1/audit-dashboard/suspicious-events`

**Description:** Detect suspicious events including multiple failed logins, bulk operations, unusual IP access, and permission escalation attempts.

**Query Parameters:**
- `tenant_id` (required) - Tenant ID
- `hours` (optional) - Number of hours to look back (default: 24)

**Example Response:**
```json
{
  "success": true,
  "suspicious_events": [
    {
      "type": "multiple_failed_logins",
      "severity": "critical",
      "description": "10 failed login attempts for user@example.com",
      "details": {
        "user_email": "user@example.com",
        "failed_count": 10,
        "ip_addresses": ["192.168.1.1", "192.168.1.2"],
        "first_attempt": "2026-02-07T09:00:00Z",
        "last_attempt": "2026-02-07T10:30:00Z"
      }
    },
    {
      "type": "bulk_operation",
      "severity": "warning",
      "description": "Bulk bulk_deletion operation by admin@example.com",
      "details": {
        "user_id": "user-123",
        "user_email": "admin@example.com",
        "event_type": "bulk_deletion",
        "action": "delete",
        "operation_count": 5,
        "first_operation": "2026-02-07T10:00:00Z",
        "last_operation": "2026-02-07T10:30:00Z"
      }
    }
  ],
  "total": 2
}
```

**Suspicious Event Types:**
- `multiple_failed_logins` - Multiple failed login attempts (≥5) from same user
- `bulk_operation` - Bulk deletion, modification, or export operations
- `unusual_ip_access` - User accessing from multiple IP addresses (≥3)
- `permission_escalation` - Potential permission escalation attempts (≥3)

### 5. Anomaly Detection

**Endpoint:** `GET /api/v1/audit-dashboard/anomalies`

**Description:** Detect anomalies in access patterns including after-hours access, rapid operations, and unusual export volumes.

**Query Parameters:**
- `tenant_id` (required) - Tenant ID
- `hours` (optional) - Number of hours to look back (default: 24)

**Example Response:**
```json
{
  "success": true,
  "anomalies": [
    {
      "type": "after_hours_access",
      "severity": "warning",
      "description": "User user@example.com accessed system 10 times outside business hours",
      "details": {
        "user_id": "user-123",
        "user_email": "user@example.com",
        "after_hours_count": 10,
        "event_types": ["data_access", "data_modification"],
        "first_access": "2026-02-07T02:00:00Z",
        "last_access": "2026-02-07T04:30:00Z"
      }
    },
    {
      "type": "unusual_export_volume",
      "severity": "critical",
      "description": "User admin@example.com performed 15 data exports",
      "details": {
        "user_id": "user-456",
        "user_email": "admin@example.com",
        "export_count": 15,
        "resource_types": ["student", "grade"],
        "first_export": "2026-02-07T08:00:00Z",
        "last_export": "2026-02-07T10:30:00Z"
      }
    }
  ],
  "total": 2
}
```

**Anomaly Types:**
- `after_hours_access` - Access outside business hours (before 6 AM or after 10 PM, ≥5 times)
- `rapid_operations` - Rapid successive operations (< 1 second apart, ≥10 times)
- `unusual_export_volume` - Unusual data export volume (≥5 exports)

### 6. GDPR Compliance Report

**Endpoint:** `POST /api/v1/audit-dashboard/reports/gdpr`

**Description:** Generate GDPR compliance report with data access, modification, deletion, and export metrics.

**Request Body:**
```json
{
  "tenant_id": "tenant-123",
  "start_date": "2026-01-01T00:00:00Z",
  "end_date": "2026-12-31T23:59:59Z",
  "generated_by_user_id": "admin-123"
}
```

**Example Response:**
```json
{
  "success": true,
  "report": {
    "report_type": "GDPR",
    "tenant_id": "tenant-123",
    "period": {
      "start_date": "2026-01-01T00:00:00Z",
      "end_date": "2026-12-31T23:59:59Z"
    },
    "data_access": {
      "total_access": 5000,
      "unique_users": 50,
      "unique_resources": 1000
    },
    "data_modifications": {
      "total_modifications": 2000,
      "unique_users": 30,
      "unique_resources": 500
    },
    "data_deletions": {
      "total_deletions": 100,
      "unique_users": 10,
      "unique_resources": 100
    },
    "data_exports": {
      "total_exports": 50,
      "unique_users": 15
    },
    "consent_changes": 200,
    "generated_at": "2026-02-07T10:30:00Z"
  }
}
```

### 7. FERPA Compliance Report

**Endpoint:** `POST /api/v1/audit-dashboard/reports/ferpa`

**Description:** Generate FERPA compliance report with student record access, modifications, and unauthorized attempts.

**Request Body:**
```json
{
  "tenant_id": "tenant-123",
  "start_date": "2026-01-01T00:00:00Z",
  "end_date": "2026-12-31T23:59:59Z",
  "generated_by_user_id": "admin-123"
}
```

**Example Response:**
```json
{
  "success": true,
  "report": {
    "report_type": "FERPA",
    "tenant_id": "tenant-123",
    "period": {
      "start_date": "2026-01-01T00:00:00Z",
      "end_date": "2026-12-31T23:59:59Z"
    },
    "student_record_access": {
      "total_access": 10000,
      "unique_users": 75,
      "unique_students": 2000
    },
    "student_record_modifications": {
      "total_modifications": 3000,
      "unique_users": 40,
      "unique_students": 1500
    },
    "grade_access": {
      "total_access": 5000,
      "unique_users": 50
    },
    "unauthorized_attempts": {
      "total_attempts": 25,
      "unique_users": 5
    },
    "directory_disclosures": {
      "total_disclosures": 100,
      "unique_users": 20
    },
    "generated_at": "2026-02-07T10:30:00Z"
  }
}
```

### 8. Configure Alerts

**Endpoint:** `POST /api/v1/audit-dashboard/alerts/configure`

**Description:** Configure real-time alerts for critical security events.

**Request Body:**
```json
{
  "tenant_id": "tenant-123",
  "alert_type": "failed_logins",
  "threshold": 5,
  "notification_channels": ["email", "sms"],
  "recipients": ["admin@example.com", "+1234567890"],
  "enabled": true,
  "configured_by_user_id": "admin-123"
}
```

**Alert Types:**
- `failed_logins` - Multiple failed login attempts
- `bulk_operations` - Bulk operations (deletion, modification, export)
- `suspicious_access` - Suspicious access patterns
- `permission_escalation` - Permission escalation attempts
- `after_hours_access` - Access outside business hours
- `unusual_export_volume` - Unusual data export volume

**Notification Channels:**
- `email` - Email notification
- `sms` - SMS notification
- `webhook` - Webhook notification

**Example Response:**
```json
{
  "success": true,
  "alert_config": {
    "id": "alert-1707305400000",
    "tenant_id": "tenant-123",
    "alert_type": "failed_logins",
    "threshold": 5,
    "notification_channels": ["email", "sms"],
    "recipients": ["admin@example.com", "+1234567890"],
    "enabled": true,
    "created_at": "2026-02-07T10:30:00Z"
  },
  "message": "Alert configuration saved successfully"
}
```

### 9. List Available Alerts

**Endpoint:** `GET /api/v1/audit-dashboard/alerts/list`

**Description:** List available alert types and their configurations.

**Query Parameters:**
- `tenant_id` (required) - Tenant ID

**Example Response:**
```json
{
  "success": true,
  "available_alerts": [
    {
      "alert_type": "failed_logins",
      "description": "Alert when multiple failed login attempts detected",
      "default_threshold": 5,
      "recommended_channels": ["email", "sms"]
    },
    {
      "alert_type": "bulk_operations",
      "description": "Alert when bulk operations are performed",
      "default_threshold": 1,
      "recommended_channels": ["email"]
    }
  ],
  "message": "Use POST /api/v1/audit-dashboard/alerts/configure to configure alerts"
}
```

## Role-Based Access Control

Only users with the following roles can access the audit dashboard:
- `superadmin` - Full access to all audit dashboard features
- `admin` - Full access to audit dashboard for their tenant
- `auditor` - Read-only access to audit logs and reports
- `compliance_officer` - Access to compliance reports and analytics

**Access Control Implementation:**
All audit dashboard endpoints check the `x-user-role` header. If the role is not authorized, the API returns a 403 Forbidden response.

**Example:**
```bash
# Authorized access
curl -X GET "http://localhost:3000/api/v1/audit-dashboard/summary?tenant_id=tenant-123" \
  -H "x-user-role: admin"

# Unauthorized access
curl -X GET "http://localhost:3000/api/v1/audit-dashboard/summary?tenant_id=tenant-123" \
  -H "x-user-role: student"
# Returns: 403 Forbidden
```

## Security Considerations

1. **Role-Based Access**: Only authorized users can access the audit dashboard
2. **Tenant Isolation**: Row-Level Security (RLS) ensures tenants can only access their own audit logs
3. **Audit Logging**: All dashboard access and report generation is logged in the audit log
4. **Rate Limiting**: API endpoints are rate-limited to prevent abuse
5. **Data Privacy**: Sensitive information is redacted in reports based on user permissions

## Best Practices

1. **Regular Monitoring**: Review the dashboard daily to identify suspicious activity
2. **Configure Alerts**: Set up real-time alerts for critical security events
3. **Generate Reports**: Generate compliance reports monthly or quarterly
4. **Investigate Anomalies**: Investigate all detected anomalies and suspicious events
5. **Review Top Users**: Monitor top users to ensure activity is legitimate
6. **After-Hours Access**: Review after-hours access to ensure it's authorized
7. **Export Volume**: Monitor data export volumes to detect potential data breaches

## Integration with Existing Systems

The audit dashboard integrates seamlessly with the existing audit log system:
- Uses the same database tables and RLS policies
- Leverages existing audit log service functions
- Automatically logs all dashboard access and report generation
- Supports the same tenant isolation and security model

## Performance Considerations

- **Indexes**: Database indexes on tenant_id, user_id, event_type, action, and created_at ensure fast queries
- **Pagination**: Use limit and offset parameters for large result sets
- **Time Windows**: Limit queries to reasonable time windows (24-48 hours) for better performance
- **Caching**: Consider caching dashboard summaries for frequently accessed data
- **Read Replicas**: Use read replicas for dashboard queries to avoid impacting primary database

## Troubleshooting

### Dashboard Shows No Data
- Verify tenant_id is correct
- Check that audit logs exist for the specified time period
- Ensure user has proper role (admin, auditor, compliance_officer)
- Verify RLS policies are configured correctly

### Suspicious Events Not Detected
- Check that audit logs are being created properly
- Verify detection thresholds are appropriate
- Ensure time window is sufficient (default: 24 hours)
- Review database queries for performance issues

### Alerts Not Triggering
- Verify alert configuration is saved correctly
- Check notification channels are configured
- Ensure recipients are valid email addresses or phone numbers
- Review application logs for alert processing errors

## Future Enhancements

- **Machine Learning**: Use ML models to improve anomaly detection accuracy
- **Predictive Analytics**: Predict potential security incidents before they occur
- **Custom Dashboards**: Allow users to create custom dashboard views
- **Scheduled Reports**: Automatically generate and email reports on a schedule
- **Integration with SIEM**: Integrate with Security Information and Event Management systems
- **Real-time Streaming**: Stream audit events in real-time to the dashboard
- **Advanced Visualizations**: Add charts, graphs, and heatmaps for better insights

## Support

For questions or issues with the audit dashboard, refer to:
- Main documentation: `/docs/README.md`
- Audit log API documentation: `/docs/AUDIT_LOG_API.md`
- Quick start guide: `/docs/AUDIT_LOG_QUICK_START.md`
