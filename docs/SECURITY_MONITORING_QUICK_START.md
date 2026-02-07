# Security Monitoring Quick Start Guide

**Version:** 1.0  
**Last Updated:** 2026-02-07  
**Task:** 4.3.5 - Setup security monitoring and incident response

---

## Overview

This guide provides a quick start for setting up and using the EduOS security monitoring system. The system provides real-time threat detection, alerting, and incident response capabilities.

---

## Prerequisites

- PostgreSQL 14+ with security monitoring tables
- Redis 7+ for caching
- Node.js application with security monitoring service
- Access to security monitoring dashboard

---

## Quick Setup

### 1. Run Database Migration

```bash
# Navigate to database directory
cd database

# Run migration 022
node run_migration_022.js
```

This creates the following tables:
- `security_events` - Security events detected by the system
- `security_alerts` - Alerts requiring human attention
- `security_incidents` - Formal incident records
- `incident_timeline` - Timeline of incident events
- `alert_rules` - Configurable alerting rules
- `threat_intelligence` - Threat indicators

### 2. Configure Alert Rules

Alert rules are pre-configured for common threats:
- Brute force detection (5 failed logins in 15 minutes)
- Privilege escalation monitoring
- Bulk data access detection (>100 records)

To add custom rules:

```javascript
const { db } = require('./config/database');

await db.query(`
  INSERT INTO alert_rules (
    name, description, event_type, conditions, severity,
    notification_channels, recipients, created_by
  ) VALUES (
    'Custom Rule',
    'Description of rule',
    'event_type',
    '{"threshold": 10}'::JSONB,
    'high',
    ARRAY['email', 'slack'],
    ARRAY['security@example.com'],
    '<admin-user-id>'
  )
`);
```

### 3. Enable Security Monitoring

Add security monitoring to your application:

```javascript
const {
  detectBruteForce,
  detectPrivilegeEscalation,
  detectBulkDataAccess,
  logSecurityEvent
} = require('./services/securityMonitoringService');

// Example: Monitor failed logins
app.post('/api/v1/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  // Attempt authentication
  const user = await authenticateUser(email, password);
  
  if (!user) {
    // Detect brute force
    const bruteForce = await detectBruteForce(
      email,
      db,
      {
        tenantId: req.tenant?.id,
        ipAddress: req.ip
      }
    );
    
    if (bruteForce.detected) {
      return res.status(429).json({
        error: 'Too many failed attempts',
        message: 'Account temporarily locked'
      });
    }
    
    return res.status(401).json({
      error: 'Invalid credentials'
    });
  }
  
  // Success - login user
  res.json({ token: generateToken(user) });
});
```

---

## Common Use Cases

### Detecting Brute Force Attacks

```javascript
const { detectBruteForce } = require('./services/securityMonitoringService');

// After failed login attempt
const result = await detectBruteForce(
  userEmail,
  db,
  {
    tenantId: req.tenant.id,
    ipAddress: req.ip
  }
);

if (result.detected) {
  // Lock account or block IP
  console.log(`Brute force detected: ${result.attemptCount} attempts`);
}
```

### Monitoring Privilege Escalation

```javascript
const { detectPrivilegeEscalation } = require('./services/securityMonitoringService');

// When changing user role
const result = await detectPrivilegeEscalation(
  userId,
  oldRole,
  newRole,
  changedBy,
  db
);

if (result.detected && result.suspicious) {
  // Require additional approval
  console.log(`Suspicious escalation: ${result.reason}`);
}
```

### Detecting Bulk Data Access

```javascript
const { detectBulkDataAccess } = require('./services/securityMonitoringService');

// After data export
const result = await detectBulkDataAccess(
  userId,
  'student',
  recordCount,
  db
);

if (result.detected) {
  // Flag for review
  console.log(`Bulk access detected: ${result.count} records`);
}
```

### Logging Security Events

```javascript
const { logSecurityEvent, SECURITY_EVENT_TYPES, ALERT_SEVERITY } = require('./services/securityMonitoringService');

// Log any security event
await logSecurityEvent({
  eventType: SECURITY_EVENT_TYPES.UNAUTHORIZED_ACCESS,
  severity: ALERT_SEVERITY.HIGH,
  tenantId: req.tenant.id,
  userId: req.user.id,
  resourceType: 'student_records',
  resourceId: recordId,
  ipAddress: req.ip
}, db);
```

---

## Viewing Security Events

### Query Security Events

```sql
-- Recent security events
SELECT 
  event_type,
  severity,
  user_id,
  detected_at,
  event_data
FROM security_events
WHERE tenant_id = '<tenant-id>'
  AND detected_at >= NOW() - INTERVAL '24 hours'
ORDER BY detected_at DESC
LIMIT 100;

-- Critical events
SELECT *
FROM security_events
WHERE severity = 'critical'
  AND detected_at >= NOW() - INTERVAL '7 days'
ORDER BY detected_at DESC;

-- Events by type
SELECT 
  event_type,
  COUNT(*) as count,
  MAX(detected_at) as last_occurrence
FROM security_events
WHERE tenant_id = '<tenant-id>'
GROUP BY event_type
ORDER BY count DESC;
```

### Query Security Alerts

```sql
-- Open alerts
SELECT 
  alert_type,
  severity,
  message,
  created_at
FROM security_alerts
WHERE status = 'open'
  AND tenant_id = '<tenant-id>'
ORDER BY severity DESC, created_at DESC;

-- Alert statistics
SELECT 
  status,
  COUNT(*) as count
FROM security_alerts
WHERE tenant_id = '<tenant-id>'
GROUP BY status;
```

---

## Responding to Alerts

### Update Alert Status

```javascript
const { updateAlertStatus } = require('./services/securityMonitoringService');

// Resolve alert
await updateAlertStatus(
  alertId,
  'resolved',
  adminUserId,
  'False positive - legitimate activity verified',
  db
);
```

### Create Incident

```sql
-- Create security incident
INSERT INTO security_incidents (
  incident_number,
  title,
  description,
  severity,
  status,
  tenant_id,
  reported_by,
  incident_type,
  detected_at
) VALUES (
  generate_incident_number(),
  'Unauthorized Data Access',
  'User accessed data outside their permissions',
  'high',
  'investigating',
  '<tenant-id>',
  '<admin-user-id>',
  'unauthorized_access',
  NOW()
);
```

---

## SIEM Integration

### Export Events for SIEM

```javascript
const { exportForSIEM } = require('./services/securityMonitoringService');

// Export in CEF format (for Splunk, ArcSight)
const events = await exportForSIEM(
  tenantId,
  'cef',
  db,
  {
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-01-31')
  }
);

// Export in LEEF format (for IBM QRadar)
const events = await exportForSIEM(
  tenantId,
  'leef',
  db,
  {
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-01-31')
  }
);

// Export in JSON format
const events = await exportForSIEM(
  tenantId,
  'json',
  db,
  {
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-01-31')
  }
);
```

### Configure SIEM Forwarding

```javascript
// Example: Forward events to Splunk
const splunk = require('splunk-logging');

const logger = new splunk.Logger({
  token: process.env.SPLUNK_TOKEN,
  url: process.env.SPLUNK_URL
});

// Forward security event
logger.send({
  message: {
    event_type: event.event_type,
    severity: event.severity,
    tenant_id: event.tenant_id,
    user_id: event.user_id,
    event_data: event.event_data
  },
  severity: event.severity,
  source: 'eduos-security',
  sourcetype: 'security_event'
});
```

---

## Generating Reports

### Security Metrics

```javascript
const { generateSecurityMetrics } = require('./services/securityMonitoringService');

// Generate monthly metrics
const metrics = await generateSecurityMetrics(
  tenantId,
  db,
  new Date('2026-01-01'),
  new Date('2026-01-31')
);

console.log('Security Metrics:', {
  totalEvents: metrics.events.total_events,
  criticalEvents: metrics.events.critical_events,
  totalAlerts: metrics.alerts.total_alerts,
  openAlerts: metrics.alerts.open_alerts,
  avgResolutionHours: metrics.alerts.avg_resolution_hours
});
```

### Dashboard Views

```sql
-- Security dashboard summary
SELECT * FROM security_dashboard_summary;

-- Open alerts summary
SELECT * FROM open_alerts_summary;

-- Incident response metrics
SELECT * FROM incident_response_metrics;
```

---

## Best Practices

### 1. Regular Monitoring

- Review security dashboard daily
- Investigate all critical and high severity alerts
- Monitor trends and patterns

### 2. Alert Tuning

- Adjust thresholds based on your environment
- Mark false positives to improve detection
- Add custom rules for specific threats

### 3. Incident Response

- Follow the incident response playbook
- Document all incidents thoroughly
- Conduct post-incident reviews

### 4. Compliance

- Export audit logs regularly
- Generate compliance reports monthly
- Maintain evidence for audits

### 5. Training

- Conduct quarterly security drills
- Keep team updated on new threats
- Review and update procedures regularly

---

## Troubleshooting

### No Events Being Logged

**Check:**
1. Database migration completed successfully
2. Security monitoring service is enabled
3. Application has database permissions

**Solution:**
```bash
# Verify tables exist
psql -d eduos -c "\dt security_*"

# Check permissions
psql -d eduos -c "SELECT * FROM information_schema.table_privileges WHERE grantee = 'eduos_app';"
```

### Alerts Not Triggering

**Check:**
1. Alert rules are enabled
2. Thresholds are configured correctly
3. Notification channels are working

**Solution:**
```sql
-- Check alert rules
SELECT * FROM alert_rules WHERE enabled = TRUE;

-- Test alert manually
INSERT INTO security_alerts (
  alert_type, severity, message, tenant_id, status
) VALUES (
  'test_alert', 'low', 'Test alert', '<tenant-id>', 'open'
);
```

### High False Positive Rate

**Solution:**
1. Review and adjust detection thresholds
2. Add exceptions for known patterns
3. Improve baseline understanding

```sql
-- Mark as false positive
UPDATE security_alerts
SET status = 'false_positive',
    resolution = 'Legitimate activity - adjusted threshold'
WHERE id = '<alert-id>';
```

---

## Next Steps

1. **Review Documentation:**
   - [Incident Response Playbook](./INCIDENT_RESPONSE_PLAYBOOK.md)
   - [Security Training Program](./SECURITY_TRAINING_PROGRAM.md)
   - [SOC 2 Audit Preparation](./SOC2_AUDIT_PREPARATION.md)

2. **Configure Integrations:**
   - Set up SIEM forwarding
   - Configure notification channels
   - Integrate with ticketing system

3. **Conduct Training:**
   - Train security team on tools
   - Run tabletop exercises
   - Practice incident response

4. **Establish Processes:**
   - Daily security review
   - Weekly metrics reporting
   - Monthly compliance reporting

---

## Support

For questions or issues:
- **Security Team:** security@eduos.com
- **Documentation:** https://docs.eduos.com/security
- **Emergency:** Follow incident response playbook

---

**Document Control:**
- **Version:** 1.0
- **Last Review:** 2026-02-07
- **Next Review:** 2026-08-07
- **Owner:** Security Team
