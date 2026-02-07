# AI Kill Switch Documentation

**Task:** 3.4.3 - Create AI Kill Switch mechanism  
**Status:** Complete  
**Version:** 1.0.0

---

## Overview

The AI Kill Switch is a critical safety mechanism that allows SuperAdmins to instantly disable all AI inference services across the EduOS platform. When activated, the system reverts to deterministic logic only, ensuring operational continuity while addressing AI-related issues.

## Purpose

The AI Kill Switch serves as a safeguard for:
- **Security Incidents:** Immediately disable AI if a security vulnerability is discovered
- **Model Performance Issues:** Stop AI predictions if model accuracy degrades
- **Compliance Requirements:** Disable AI to meet regulatory requirements
- **Emergency Situations:** Quick response to any AI-related problems

## Architecture

### Components

1. **Python AI Service (FastAPI)**
   - Kill switch status stored in Redis
   - All AI endpoints check kill switch before processing
   - Returns 503 Service Unavailable when disabled

2. **Node.js Backend Service**
   - Provides SuperAdmin UI endpoints
   - Manages kill switch state
   - Handles notifications and audit logging

3. **Redis Cache**
   - Stores kill switch status for fast access
   - Key: `ai:kill_switch:status`
   - Checked on every AI request

4. **Database Audit Trail**
   - Logs all kill switch events
   - Tracks who toggled, when, and why
   - Immutable audit history

### Data Flow

```
SuperAdmin UI
    ↓
POST /api/v1/ai/kill-switch/toggle
    ↓
Node.js Service
    ↓
AI Service (FastAPI)
    ↓
Redis Cache (update status)
    ↓
Database (audit log)
    ↓
Notification System (alert admins)
```

---

## API Endpoints

### 1. Get Kill Switch Status

**Endpoint:** `GET /api/v1/ai/kill-switch`  
**Access:** SuperAdmin, InstituteAdmin (read-only)

**Response:**
```json
{
  "success": true,
  "data": {
    "enabled": false,
    "disabled_at": "2026-02-07T12:00:00Z",
    "disabled_by": "superadmin_001",
    "reason": "Security incident - disabling AI pending investigation"
  }
}
```

### 2. Toggle Kill Switch

**Endpoint:** `POST /api/v1/ai/kill-switch/toggle`  
**Access:** SuperAdmin only

**Request Body:**
```json
{
  "enable": false,
  "reason": "Security incident - disabling AI pending investigation"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "enabled": false,
    "disabled_at": "2026-02-07T12:00:00Z",
    "disabled_by": "superadmin_001",
    "reason": "Security incident - disabling AI pending investigation"
  },
  "message": "AI services have been disabled. System reverted to deterministic logic."
}
```

**Validation:**
- `enable`: Required, must be boolean
- `reason`: Required, must be non-empty string

### 3. Get Kill Switch History

**Endpoint:** `GET /api/v1/ai/kill-switch/history?limit=50`  
**Access:** SuperAdmin, InstituteAdmin

**Response:**
```json
{
  "success": true,
  "data": {
    "history": [
      {
        "event_type": "AI_GOVERNANCE",
        "user_id": "superadmin_001",
        "action": "AI_KILL_SWITCH_DISABLED",
        "details": {
          "enabled": false,
          "reason": "Security incident",
          "toggled_by": "superadmin_001",
          "timestamp": "2026-02-07T12:00:00Z"
        },
        "timestamp": "2026-02-07T12:00:00Z",
        "ip_address": "192.168.1.1"
      }
    ],
    "total": 1
  }
}
```

---

## Python AI Service Integration

### Kill Switch Check

All AI endpoints automatically check the kill switch:

```python
# Check AI Kill Switch
kill_switch_status = governance_manager.get_kill_switch_status()
if not kill_switch_status.enabled:
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="AI services are currently disabled via Kill Switch"
    )
```

### Affected Endpoints

When the kill switch is disabled, these endpoints return 503:
- `/api/v1/semantic/find-duplicates`
- `/api/v1/semantic/pairwise-similarity`
- `/api/v1/semantic/batch-process`
- `/api/v1/recommendations` (POST)
- Any other AI inference endpoints

### Fallback Behavior

When AI is disabled:
- **Duplicate Detection:** Falls back to deterministic fuzzy matching only
- **Risk Scoring:** Disabled, no risk scores generated
- **Anomaly Detection:** Disabled, no anomaly flags
- **Schedule Optimization:** Manual scheduling only

---

## Node.js Service Integration

### Service Functions

```javascript
const aiKillSwitchService = require('./services/aiKillSwitchService');

// Get current status
const status = await aiKillSwitchService.getKillSwitchStatus();

// Toggle kill switch
const newStatus = await aiKillSwitchService.toggleKillSwitch(
  false, // enable
  'Security incident',
  'superadmin_001',
  pool
);

// Check if AI is enabled
const isEnabled = await aiKillSwitchService.isAIEnabled();
```

### Middleware

Protect AI-dependent routes with middleware:

```javascript
const { checkAIKillSwitch } = require('./services/aiKillSwitchService');

// Apply to routes that depend on AI
router.post('/api/v1/students/check-duplicates', 
  checkAIKillSwitch,
  async (req, res) => {
    // AI-dependent logic
  }
);
```

---

## Notifications

### Admin Notifications

When the kill switch is toggled, all admins (SuperAdmin and InstituteAdmin) receive notifications:

**Disable Notification:**
- **Priority:** Critical
- **Title:** "AI Services Disabled"
- **Message:** "⚠️ CRITICAL: AI services have been disabled by {user}. The system has reverted to deterministic logic only. Reason: {reason}"

**Enable Notification:**
- **Priority:** Medium
- **Title:** "AI Services Enabled"
- **Message:** "AI services have been re-enabled by {user}. Reason: {reason}"

### Email Alerts (TODO)

For critical events (AI disabled), email alerts should be sent to all admins. This is currently logged as a TODO and should be implemented in production.

---

## Audit Logging

### Database Audit Trail

All kill switch events are logged to the `audit_logs` table:

```sql
INSERT INTO audit_logs (
  event_type,
  user_id,
  resource_type,
  resource_id,
  action,
  details,
  timestamp
) VALUES (
  'AI_GOVERNANCE',
  'superadmin_001',
  'ai_kill_switch',
  'global',
  'AI_KILL_SWITCH_DISABLED',
  '{"enabled": false, "reason": "Security incident", "toggled_by": "superadmin_001"}',
  NOW()
);
```

### AI Service Audit Trail

The AI service also maintains its own audit log:

```python
log_entry = AuditLogEntry(
    log_id="log_abc123",
    recommendation_id="kill_switch",
    recommendation_type=RecommendationType.DUPLICATE_DETECTION,
    confidence_score=1.0,
    human_decision=ApprovalStatus.REJECTED,  # for disable
    decided_by="superadmin_001",
    timestamp=datetime.now(timezone.utc),
    metadata={
        "action": "disable",
        "reason": "Security incident",
        "kill_switch_event": True
    }
)
```

---

## Security Considerations

### Access Control

- **SuperAdmin Only:** Only SuperAdmin role can toggle the kill switch
- **Read Access:** InstituteAdmin can view status and history
- **Audit Trail:** All actions are logged with user ID and timestamp

### Fail-Safe Design

- **Fail Open:** If Redis is unavailable, AI requests are allowed (default to enabled)
- **Graceful Degradation:** System continues to function with deterministic logic
- **No Data Loss:** Disabling AI does not affect existing data

### Redis Persistence

The kill switch status is stored in Redis for fast access:
- **Key:** `ai:kill_switch:status`
- **Format:** JSON string
- **TTL:** None (persists until explicitly changed)

---

## Testing

### Unit Tests

**Node.js Service:**
- `src/services/aiKillSwitchService.test.js` (21 tests)
- `src/routes/aiKillSwitch.test.js` (15 tests)

**Python AI Service:**
- `ai-service/test_kill_switch.py` (16 tests)

### Test Coverage

- ✅ Get kill switch status
- ✅ Toggle kill switch (enable/disable)
- ✅ Audit logging
- ✅ Admin notifications
- ✅ AI request blocking when disabled
- ✅ Middleware protection
- ✅ Error handling
- ✅ Integration with governance framework

### Running Tests

```bash
# Node.js tests
npm test -- src/services/aiKillSwitchService.test.js
npm test -- src/routes/aiKillSwitch.test.js

# Python tests
cd ai-service
python -m pytest test_kill_switch.py -v
```

---

## Usage Examples

### Scenario 1: Security Incident

```bash
# Disable AI immediately
curl -X POST http://localhost:3000/api/v1/ai/kill-switch/toggle \
  -H "Content-Type: application/json" \
  -d '{
    "enable": false,
    "reason": "Security vulnerability detected in AI model - CVE-2026-12345"
  }'

# Response: AI services disabled, all admins notified
```

### Scenario 2: Model Performance Issue

```bash
# Disable AI due to accuracy drop
curl -X POST http://localhost:3000/api/v1/ai/kill-switch/toggle \
  -H "Content-Type: application/json" \
  -d '{
    "enable": false,
    "reason": "Model accuracy dropped below 80% - investigating"
  }'
```

### Scenario 3: Re-enable After Fix

```bash
# Re-enable AI after issue resolved
curl -X POST http://localhost:3000/api/v1/ai/kill-switch/toggle \
  -H "Content-Type: application/json" \
  -d '{
    "enable": true,
    "reason": "Security patch applied and verified - re-enabling AI"
  }'
```

### Scenario 4: Check Status

```bash
# Check current kill switch status
curl http://localhost:3000/api/v1/ai/kill-switch

# Response
{
  "success": true,
  "data": {
    "enabled": false,
    "disabled_at": "2026-02-07T12:00:00Z",
    "disabled_by": "superadmin_001",
    "reason": "Security vulnerability detected"
  }
}
```

---

## Monitoring and Alerts

### Metrics to Monitor

1. **Kill Switch Status:** Current state (enabled/disabled)
2. **Toggle Frequency:** How often the kill switch is toggled
3. **Downtime Duration:** How long AI services are disabled
4. **Failed AI Requests:** Number of 503 responses due to kill switch

### Recommended Alerts

1. **Kill Switch Activated:** Immediate alert to on-call team
2. **Extended Downtime:** Alert if AI disabled for > 1 hour
3. **Frequent Toggles:** Alert if toggled > 3 times in 24 hours

---

## Future Enhancements

### Phase 1 (Current)
- ✅ Global kill switch for all AI services
- ✅ Redis-based state management
- ✅ Audit logging
- ✅ Admin notifications

### Phase 2 (Planned)
- [ ] Granular kill switches per AI feature (duplicate detection, risk scoring, etc.)
- [ ] Scheduled kill switch (disable AI during maintenance windows)
- [ ] Email alerts for critical events
- [ ] Dashboard widget showing kill switch status

### Phase 3 (Future)
- [ ] Automatic kill switch based on model performance metrics
- [ ] Integration with incident management systems
- [ ] Kill switch API for external monitoring tools
- [ ] Historical analytics and reporting

---

## Troubleshooting

### Issue: Kill switch not working

**Symptoms:** AI requests still processing after disabling

**Solutions:**
1. Check Redis connection: `redis-cli ping`
2. Verify AI service is reading from Redis
3. Check logs for errors: `docker logs ai-service`
4. Restart AI service to reload configuration

### Issue: Cannot toggle kill switch

**Symptoms:** 403 Forbidden or 500 Internal Server Error

**Solutions:**
1. Verify user has SuperAdmin role
2. Check database connection
3. Verify AI service is running: `curl http://localhost:8000/health`
4. Check Redis connection

### Issue: Admins not receiving notifications

**Symptoms:** Kill switch toggled but no notifications

**Solutions:**
1. Check database for admin users: `SELECT * FROM users WHERE role = 'SuperAdmin'`
2. Verify notifications table: `SELECT * FROM notifications ORDER BY created_at DESC LIMIT 10`
3. Check notification service logs
4. Verify email service configuration (if email alerts enabled)

---

## References

- **Requirements:** `.kiro/specs/eduos-platform/requirements.md` - Module F, Section 35
- **Design:** `.kiro/specs/eduos-platform/design.md` - Section 7.3
- **Tasks:** `.kiro/specs/eduos-platform/tasks.md` - Task 3.4.3
- **Code:**
  - `ai-service/governance.py` - Kill switch logic
  - `src/services/aiKillSwitchService.js` - Node.js service
  - `src/routes/aiKillSwitch.js` - API routes

---

## Support

For issues or questions about the AI Kill Switch:
1. Check this documentation
2. Review audit logs for recent events
3. Contact the AI Governance team
4. Escalate to SuperAdmin if critical

**Emergency Contact:** SuperAdmin on-call rotation
