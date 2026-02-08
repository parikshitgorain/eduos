# Scheduling System - Quick Start Guide

## Overview

The EduOS Scheduling System provides real-time conflict detection for class schedules. This guide will help you get started quickly.

## Installation

### 1. Run Database Migration

```bash
node database/run_migration_027.js
```

This creates:
- 7 tables (rooms, teachers, subjects, batches, schedule_slots, schedule_overrides, schedule_conflicts)
- Conflict detection function
- Row-Level Security policies
- Performance indexes

### 2. Verify Installation

```bash
# Check tables
psql -U postgres -d eduos -c "\dt schedule*"

# Check function
psql -U postgres -d eduos -c "\df detect_schedule_conflicts"
```

## Quick Examples

### Example 1: Validate a Schedule (No Conflicts)

```bash
curl -X POST http://localhost:3000/api/v1/schedules/validate \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "123e4567-e89b-12d3-a456-426614174000",
    "room_id": "123e4567-e89b-12d3-a456-426614174001",
    "teacher_id": "123e4567-e89b-12d3-a456-426614174002",
    "batch_id": "123e4567-e89b-12d3-a456-426614174003",
    "day_of_week": 1,
    "start_time": "09:00:00",
    "end_time": "10:00:00",
    "effective_from": "2026-01-01"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "conflicts": [],
    "conflict_count": 0
  }
}
```

### Example 2: Create a Schedule

```bash
curl -X POST http://localhost:3000/api/v1/schedules \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "123e4567-e89b-12d3-a456-426614174000",
    "room_id": "123e4567-e89b-12d3-a456-426614174001",
    "teacher_id": "123e4567-e89b-12d3-a456-426614174002",
    "batch_id": "123e4567-e89b-12d3-a456-426614174003",
    "subject_id": "123e4567-e89b-12d3-a456-426614174004",
    "day_of_week": 1,
    "start_time": "09:00:00",
    "end_time": "10:00:00",
    "effective_from": "2026-01-01",
    "effective_to": "2026-06-30",
    "is_recurring": true,
    "recurrence_pattern": "weekly"
  }'
```

### Example 3: Get Weekly Schedule

```bash
curl "http://localhost:3000/api/v1/schedules?tenant_id=123e4567-e89b-12d3-a456-426614174000&day_of_week=1&status=active"
```

### Example 4: Check for Conflicts

```bash
curl "http://localhost:3000/api/v1/schedules/conflicts/list?tenant_id=123e4567-e89b-12d3-a456-426614174000&status=unresolved"
```

## Common Use Cases

### Use Case 1: Validate Before Creating

```javascript
// Always validate first
const validation = await fetch('/api/v1/schedules/validate', {
  method: 'POST',
  body: JSON.stringify(scheduleData)
});

const result = await validation.json();

if (result.data.valid) {
  // Safe to create
  await fetch('/api/v1/schedules', {
    method: 'POST',
    body: JSON.stringify(scheduleData)
  });
} else {
  // Show conflicts to user
  alert(`Conflicts: ${result.data.conflicts.map(c => c.description).join(', ')}`);
}
```

### Use Case 2: Update with Conflict Check

```javascript
// Update automatically validates
const response = await fetch(`/api/v1/schedules/${slotId}`, {
  method: 'PUT',
  body: JSON.stringify({
    room_id: newRoomId
  })
});

if (response.status === 409) {
  // Conflict detected
  const error = await response.json();
  console.log('Cannot update:', error.error);
}
```

### Use Case 3: Get Teacher's Schedule

```javascript
const response = await fetch('/api/v1/schedules?' + new URLSearchParams({
  tenant_id: tenantId,
  teacher_id: teacherId,
  status: 'active'
}));

const schedule = await response.json();
console.log(`Teacher has ${schedule.count} classes`);
```

## Conflict Types

The system detects three types of conflicts:

1. **Room Double-Booking**: Same room assigned to multiple classes at the same time
2. **Teacher Double-Booking**: Teacher assigned to multiple classes simultaneously
3. **Batch Double-Booking**: Student batch scheduled for multiple classes at once

## Day of Week Values

- `0` = Sunday
- `1` = Monday
- `2` = Tuesday
- `3` = Wednesday
- `4` = Thursday
- `5` = Friday
- `6` = Saturday

## Time Format

Use 24-hour format: `HH:MM:SS`
- Example: `09:00:00` (9 AM)
- Example: `14:30:00` (2:30 PM)

## Date Format

Use ISO 8601 format: `YYYY-MM-DD`
- Example: `2026-01-01`
- Example: `2026-06-30`

## Status Values

- `active`: Currently active schedule
- `cancelled`: Cancelled/deleted schedule
- `completed`: Past schedule (no longer active)
- `draft`: Draft schedule (not yet published)

## Recurrence Patterns

- `weekly`: Repeats every week
- `biweekly`: Repeats every two weeks
- `monthly`: Repeats every month
- `one-time`: Does not repeat

## Error Codes

- `400`: Bad request (missing/invalid fields)
- `404`: Schedule not found
- `409`: Conflict detected
- `500`: Server error

## Testing

Run tests:
```bash
npm test -- --testPathPattern="scheduling" --no-coverage
```

Expected: 33 tests passing (17 service + 16 route tests)

## Troubleshooting

### Issue: "Tenant ID is required"
**Solution:** Ensure `tenant_id` is included in request body or query parameters.

### Issue: "day_of_week must be between 0 and 6"
**Solution:** Use integer values 0-6 (0=Sunday, 6=Saturday).

### Issue: "Schedule conflicts detected"
**Solution:** Use `/validate` endpoint first to check for conflicts before creating.

### Issue: "Schedule slot not found"
**Solution:** Verify the `slot_id` exists and belongs to the correct tenant.

## Performance Tips

1. **Use Filters**: Always filter by tenant_id, room_id, teacher_id, or batch_id to improve query performance
2. **Validate First**: Use `/validate` endpoint before creating to avoid unnecessary database writes
3. **Batch Operations**: Group multiple schedule creations in a transaction
4. **Index Usage**: Queries on day_of_week, start_time, end_time use optimized indexes

## Next Steps

- Read full documentation: `docs/SCHEDULING_SYSTEM.md`
- Review implementation: `docs/tasks/TASK_5.2.1_IMPLEMENTATION_SUMMARY.md`
- Explore API: `src/routes/schedules.js`
- Check service logic: `src/services/schedulingService.js`

## Support

For issues or questions:
- Check logs: `console.error` messages in API responses
- Review tests: `src/services/schedulingService.test.js`
- Database schema: `database/migrations/027_scheduling_system.sql`
