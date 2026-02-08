# Real-Time Rule Evaluation - Integration Guide

This guide shows how to integrate the real-time rule evaluation system with your attendance and grade services.

---

## Quick Start

### 1. Import the Trigger Utilities

```javascript
const { 
  triggerAttendanceRuleEvaluation,
  triggerGradeRuleEvaluation,
  triggerBatchRuleEvaluation 
} = require('../utils/ruleEvaluationTrigger');
```

### 2. Trigger After Data Changes

#### Attendance Service Integration

Add to `src/routes/attendance.js` after successful attendance sync:

```javascript
router.post('/sync', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const attendanceService = new AttendanceService(req.db, req.redis);
    
    // Sync attendance events
    const result = await attendanceService.syncOfflineEvents(
      req.body.events,
      tenantId
    );

    // NEW: Trigger rule evaluation for affected students
    const affectedStudents = new Set(
      req.body.events.map(event => event.data.student_id)
    );

    for (const studentId of affectedStudents) {
      try {
        await triggerAttendanceRuleEvaluation(
          studentId,
          tenantId,
          req.db,
          req.redis
        );
      } catch (error) {
        console.error(`Rule evaluation failed for student ${studentId}:`, error);
        // Don't fail the sync if rule evaluation fails
      }
    }

    res.status(200).json({
      status: 'success',
      synced_events: result.synced,
      conflicts_resolved: result.conflicts,
      errors: result.errors,
      rules_evaluated: affectedStudents.size
    });
  } catch (error) {
    // ... error handling
  }
});
```

#### Grade Service Integration

Add to your grade update endpoint:

```javascript
router.put('/grades/:gradeId', async (req, res) => {
  try {
    const { gradeId } = req.params;
    const { student_id, marks, max_marks } = req.body;
    const tenantId = req.tenantId;

    // Update grade in database
    await db('grades')
      .where({ grade_id: gradeId, tenant_id: tenantId })
      .update({
        marks: marks,
        max_marks: max_marks,
        percentage: (marks / max_marks) * 100,
        updated_at: new Date()
      });

    // NEW: Trigger rule evaluation
    try {
      const grade = (marks / max_marks) * 100;
      await triggerGradeRuleEvaluation(
        student_id,
        tenantId,
        grade,
        marks,
        max_marks,
        req.db,
        req.redis
      );
    } catch (error) {
      console.error('Rule evaluation failed:', error);
      // Don't fail the grade update if rule evaluation fails
    }

    res.json({
      success: true,
      message: 'Grade updated successfully'
    });
  } catch (error) {
    // ... error handling
  }
});
```

---

## API Usage Examples

### Manual Rule Evaluation

You can also manually trigger rule evaluation via the API:

```bash
# Evaluate rules for a student
curl -X POST http://localhost:3000/api/v1/policies/rules/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "550e8400-e29b-41d4-a716-446655440000",
    "context": {
      "attendance_percentage": 72.5,
      "total_sessions": 40,
      "present_count": 29
    }
  }'
```

### Get Evaluation History

```bash
# Get evaluation history for a student
curl http://localhost:3000/api/v1/policies/rules/evaluations/550e8400-e29b-41d4-a716-446655440000?limit=20
```

---

## Batch Processing

For bulk operations (e.g., end-of-day processing):

```javascript
const { triggerBatchRuleEvaluation } = require('../utils/ruleEvaluationTrigger');

// Get all active students
const students = await db('students')
  .where({ tenant_id: tenantId, status: 'active' })
  .select('student_id');

const studentIds = students.map(s => s.student_id);

// Evaluate rules for all students
const context = {
  attendance_percentage: 75, // Or calculate per student
  grade: 70
};

const results = await triggerBatchRuleEvaluation(
  studentIds,
  tenantId,
  context,
  db,
  redis
);

console.log(`Evaluated: ${results.evaluated}, Failed: ${results.failed}`);
```

---

## Error Handling Best Practices

### 1. Don't Block Primary Operations

Rule evaluation should never block the primary operation (attendance sync, grade update):

```javascript
try {
  await triggerAttendanceRuleEvaluation(studentId, tenantId, db, redis);
} catch (error) {
  console.error('Rule evaluation failed:', error);
  // Log but don't throw - primary operation succeeded
}
```

### 2. Log Evaluation Failures

```javascript
const winston = require('winston');

try {
  await triggerAttendanceRuleEvaluation(studentId, tenantId, db, redis);
} catch (error) {
  winston.error('Rule evaluation failed', {
    studentId,
    tenantId,
    error: error.message,
    stack: error.stack
  });
}
```

### 3. Retry Logic (Optional)

For critical rules, implement retry logic:

```javascript
async function evaluateWithRetry(studentId, tenantId, db, redis, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await triggerAttendanceRuleEvaluation(studentId, tenantId, db, redis);
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}
```

---

## Performance Considerations

### 1. Async Processing

For high-volume operations, consider async processing:

```javascript
const queue = require('../services/queueService');

// Queue rule evaluation instead of blocking
await queue.add('rule-evaluation', {
  studentId,
  tenantId,
  context
});
```

### 2. Batch Evaluation

Group evaluations to reduce overhead:

```javascript
// Instead of evaluating one by one
for (const studentId of studentIds) {
  await triggerAttendanceRuleEvaluation(studentId, tenantId, db, redis);
}

// Use batch evaluation
await triggerBatchRuleEvaluation(studentIds, tenantId, context, db, redis);
```

### 3. Cache Warming

Pre-warm the rule cache during low-traffic periods:

```javascript
const academicRuleService = require('../services/academicRuleService');

// Warm cache for all tenants
const tenants = await db('tenants').select('tenant_id');

for (const tenant of tenants) {
  await academicRuleService.getApplicableRules(
    tenant.tenant_id,
    { attendance_percentage: 0 } // Dummy context
  );
}
```

---

## Monitoring

### Metrics to Track

1. **Evaluation Latency**
   - Average time per evaluation
   - P95, P99 latencies
   - Alert if > 100ms

2. **Cache Hit Rate**
   - Track Redis cache hits vs misses
   - Target: > 95% hit rate

3. **Action Execution**
   - Count of notifications sent
   - Count of eligibility changes
   - Failed action executions

4. **Evaluation Volume**
   - Evaluations per minute
   - Evaluations per student
   - Peak evaluation times

### Example Prometheus Metrics

```javascript
const promClient = require('prom-client');

const ruleEvaluationDuration = new promClient.Histogram({
  name: 'rule_evaluation_duration_ms',
  help: 'Rule evaluation duration in milliseconds',
  labelNames: ['tenant_id', 'rule_type']
});

const ruleEvaluationTotal = new promClient.Counter({
  name: 'rule_evaluation_total',
  help: 'Total number of rule evaluations',
  labelNames: ['tenant_id', 'condition_met']
});

// In your evaluation code
const startTime = Date.now();
const evaluations = await triggerAttendanceRuleEvaluation(studentId, tenantId, db, redis);
const duration = Date.now() - startTime;

ruleEvaluationDuration.observe({ tenant_id: tenantId, rule_type: 'attendance' }, duration);
ruleEvaluationTotal.inc({ tenant_id: tenantId, condition_met: evaluations[0]?.condition_met });
```

---

## Testing Integration

### Unit Test Example

```javascript
describe('Attendance Sync with Rule Evaluation', () => {
  it('should trigger rule evaluation after successful sync', async () => {
    const mockTrigger = jest.fn().mockResolvedValue([]);
    jest.mock('../utils/ruleEvaluationTrigger', () => ({
      triggerAttendanceRuleEvaluation: mockTrigger
    }));

    // Sync attendance
    const response = await request(app)
      .post('/api/v1/attendance/sync')
      .send({ events: [/* ... */] });

    expect(response.status).toBe(200);
    expect(mockTrigger).toHaveBeenCalledWith(
      expect.any(String), // studentId
      expect.any(String), // tenantId
      expect.any(Object), // db
      expect.any(Object)  // redis
    );
  });
});
```

---

## Troubleshooting

### Issue: Rules Not Triggering

**Check:**
1. Are rules active? (`status = 'active'`)
2. Are rules within effective date range?
3. Is Redis cache stale? (Try invalidating cache)
4. Are conditions correctly formatted?

**Debug:**
```javascript
const rules = await academicRuleService.getApplicableRules(tenantId, context);
console.log('Applicable rules:', rules);
```

### Issue: Slow Evaluation

**Check:**
1. Redis connection healthy?
2. Database indexes present?
3. Too many rules per tenant?
4. Complex condition evaluation?

**Debug:**
```javascript
const startTime = Date.now();
await triggerAttendanceRuleEvaluation(studentId, tenantId, db, redis);
console.log('Evaluation took:', Date.now() - startTime, 'ms');
```

### Issue: Actions Not Executing

**Check:**
1. Are conditions actually met?
2. Check evaluation logs in `rule_evaluations` table
3. Check action_result field for errors

**Debug:**
```sql
SELECT * FROM rule_evaluations 
WHERE student_id = 'xxx' 
ORDER BY evaluated_at DESC 
LIMIT 10;
```

---

## Support

For issues or questions:
- Check logs: `console.log` statements in evaluation code
- Review evaluation history: `GET /api/v1/policies/rules/evaluations/:studentId`
- Check Redis: `redis-cli KEYS "rules:*"`
- Review database: `SELECT * FROM rule_evaluations WHERE student_id = 'xxx'`

---

## Summary

Real-time rule evaluation is now integrated and ready to use. Key points:

✅ Import trigger utilities  
✅ Call after data changes  
✅ Handle errors gracefully  
✅ Monitor performance  
✅ Test thoroughly  

The system will automatically evaluate rules and execute actions when student data changes, ensuring academic policies are enforced in real-time.
