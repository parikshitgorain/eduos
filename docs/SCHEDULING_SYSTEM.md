# Scheduling System Documentation

## Overview

The EduOS Scheduling System provides comprehensive schedule management with real-time conflict detection for educational institutions. It supports scheduling of classes with automatic detection of room, teacher, and batch conflicts.

## Features

### 1. Real-Time Conflict Detection
- **Room Double-Booking**: Detects when a room is assigned to multiple classes at the same time
- **Teacher Double-Booking**: Prevents teachers from being assigned to multiple classes simultaneously
- **Batch Double-Booking**: Ensures student batches are not scheduled for multiple classes at once
- **Time Overlap Detection**: Identifies any time conflicts across all resources

### 2. Schedule Management
- Create, read, update, and delete schedule slots
- Support for recurring schedules (weekly, biweekly, monthly, one-time)
- Date range validity (effective_from, effective_to)
- Soft delete (cancellation) of schedules

### 3. Conflict Logging
- Automatic logging of detected conflicts
- Conflict severity levels (low, medium, high, critical)
- Conflict resolution tracking
- Audit trail for all conflict-related actions

## Database Schema

### Tables

#### 1. `rooms`
Stores physical rooms/locations where classes can be held.

**Key Fields:**
- `room_id` (UUID): Primary key
- `tenant_id` (UUID): Multi-tenant isolation
- `room_name`, `room_code`: Room identification
- `capacity`: Maximum student capacity
- `room_type`: classroom, lab, auditorium, sports, library
- `facilities`: JSONB array of available facilities

#### 2. `teachers`
Stores teacher information for scheduling.

**Key Fields:**
- `teacher_id` (UUID): Primary key
- `tenant_id` (UUID): Multi-tenant isolation
- `teacher_code`, `first_name`, `last_name`: Teacher identification
- `max_hours_per_week`: Maximum teaching hours constraint

#### 3. `subjects`
Stores subjects/courses that can be scheduled.

**Key Fields:**
- `subject_id` (UUID): Primary key
- `tenant_id` (UUID): Multi-tenant isolation
- `subject_code`, `subject_name`: Subject identification
- `hours_per_week`: Recommended hours per week

#### 4. `batches`
Stores student batch information.

**Key Fields:**
- `batch_id` (UUID): Primary key
- `tenant_id` (UUID): Multi-tenant isolation
- `batch_code`, `batch_name`: Batch identification
- `student_count`: Number of students in batch

#### 5. `schedule_slots`
Stores individual schedule assignments.

**Key Fields:**
- `slot_id` (UUID): Primary key
- `tenant_id` (UUID): Multi-tenant isolation
- `room_id`, `teacher_id`, `batch_id`, `subject_id`: Resource references
- `day_of_week` (0-6): 0=Sunday, 6=Saturday
- `start_time`, `end_time`: Time range
- `effective_from`, `effective_to`: Date validity range
- `is_recurring`: Whether the schedule repeats
- `recurrence_pattern`: weekly, biweekly, monthly, one-time
- `status`: active, cancelled, completed, draft

#### 6. `schedule_overrides`
Stores temporary schedule changes (substitute teacher, room change, etc.).

**Key Fields:**
- `override_id` (UUID): Primary key
- `slot_id` (UUID): Reference to original schedule slot
- `override_type`: substitute_teacher, room_change, time_shift, cancellation
- `override_date`: Specific date for the override
- `new_room_id`, `new_teacher_id`, `new_start_time`, `new_end_time`: Override values
- `status`: pending, approved, rejected, applied

#### 7. `schedule_conflicts`
Logs detected conflicts for audit and resolution.

**Key Fields:**
- `conflict_id` (UUID): Primary key
- `conflict_type`: room_double_booking, teacher_double_booking, batch_double_booking
- `severity`: low, medium, high, critical
- `slot_id_1`, `slot_id_2`: Conflicting schedule slots
- `status`: unresolved, acknowledged, resolved, ignored

## API Endpoints

### 1. Validate Schedule Slot
**Endpoint:** `POST /api/v1/schedules/validate`

**Purpose:** Validate a schedule slot for conflicts before creation or update.

**Request Body:**
```json
{
  "tenant_id": "uuid",
  "room_id": "uuid",
  "teacher_id": "uuid",
  "batch_id": "uuid",
  "day_of_week": 1,
  "start_time": "09:00:00",
  "end_time": "10:00:00",
  "effective_from": "2026-01-01",
  "effective_to": "2026-06-30",
  "exclude_slot_id": "uuid" // Optional: exclude this slot from conflict check
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": false,
    "conflicts": [
      {
        "type": "room_double_booking",
        "conflicting_slot_id": "uuid",
        "description": "Room 101 is already booked on Monday from 09:00:00 to 10:00:00"
      }
    ],
    "conflict_count": 1
  }
}
```

### 2. Create Schedule Slot
**Endpoint:** `POST /api/v1/schedules`

**Purpose:** Create a new schedule slot (automatically validates for conflicts).

**Request Body:**
```json
{
  "tenant_id": "uuid",
  "room_id": "uuid",
  "teacher_id": "uuid",
  "batch_id": "uuid",
  "subject_id": "uuid",
  "day_of_week": 1,
  "start_time": "09:00:00",
  "end_time": "10:00:00",
  "effective_from": "2026-01-01",
  "effective_to": "2026-06-30",
  "is_recurring": true,
  "recurrence_pattern": "weekly",
  "notes": "Optional notes"
}
```

**Response:**
- **201 Created**: Schedule slot created successfully
- **409 Conflict**: Schedule conflicts detected

### 3. Get Schedule Slots
**Endpoint:** `GET /api/v1/schedules`

**Purpose:** Retrieve schedule slots with optional filters.

**Query Parameters:**
- `tenant_id` (required)
- `room_id` (optional)
- `teacher_id` (optional)
- `batch_id` (optional)
- `day_of_week` (optional): 0-6
- `status` (optional): active, cancelled, completed, draft
- `effective_date` (optional): Filter by date validity

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "slot_id": "uuid",
      "room_name": "Room 101",
      "teacher_first_name": "John",
      "teacher_last_name": "Doe",
      "batch_name": "Batch A",
      "subject_name": "Mathematics",
      "day_of_week": 1,
      "start_time": "09:00:00",
      "end_time": "10:00:00",
      "status": "active"
    }
  ],
  "count": 1
}
```

### 4. Get Schedule Slot by ID
**Endpoint:** `GET /api/v1/schedules/:slot_id`

**Purpose:** Retrieve a specific schedule slot with full details.

### 5. Update Schedule Slot
**Endpoint:** `PUT /api/v1/schedules/:slot_id`

**Purpose:** Update an existing schedule slot (automatically validates for conflicts).

**Response:**
- **200 OK**: Schedule slot updated successfully
- **409 Conflict**: Update would cause conflicts
- **404 Not Found**: Schedule slot not found

### 6. Delete Schedule Slot
**Endpoint:** `DELETE /api/v1/schedules/:slot_id`

**Purpose:** Soft delete (cancel) a schedule slot.

**Response:**
- **200 OK**: Schedule slot cancelled successfully
- **404 Not Found**: Schedule slot not found

### 7. Get Conflicts
**Endpoint:** `GET /api/v1/schedules/conflicts/list`

**Purpose:** Retrieve detected schedule conflicts.

**Query Parameters:**
- `tenant_id` (required)
- `status` (optional): unresolved, acknowledged, resolved, ignored
- `conflict_type` (optional): room_double_booking, teacher_double_booking, batch_double_booking

## Conflict Detection Algorithm

The system uses a PostgreSQL function `detect_schedule_conflicts()` that performs the following checks:

### 1. Time Overlap Detection
Checks if the new schedule overlaps with existing schedules using the formula:
```
(new_start >= existing_start AND new_start < existing_end) OR
(new_end > existing_start AND new_end <= existing_end) OR
(new_start <= existing_start AND new_end >= existing_end)
```

### 2. Date Range Overlap Detection
Checks if the date ranges overlap:
```
(existing_to IS NULL OR existing_to >= new_from) AND
(new_to IS NULL OR new_to >= existing_from)
```

### 3. Resource-Specific Checks
- **Room Conflicts**: Checks if the same room is assigned to multiple slots
- **Teacher Conflicts**: Checks if the same teacher is assigned to multiple slots
- **Batch Conflicts**: Checks if the same batch is scheduled for multiple slots

## Multi-Tenancy

All tables implement Row-Level Security (RLS) to ensure tenant isolation:
- Each table has a `tenant_id` column
- RLS policies enforce `tenant_id = current_setting('app.current_tenant_id')::UUID`
- All queries automatically filter by tenant context

## Usage Examples

### Example 1: Validate Before Creating
```javascript
// Step 1: Validate
const validation = await fetch('/api/v1/schedules/validate', {
  method: 'POST',
  body: JSON.stringify({
    tenant_id: 'tenant-uuid',
    room_id: 'room-uuid',
    teacher_id: 'teacher-uuid',
    batch_id: 'batch-uuid',
    day_of_week: 1,
    start_time: '09:00:00',
    end_time: '10:00:00',
    effective_from: '2026-01-01'
  })
});

const result = await validation.json();

if (result.data.valid) {
  // Step 2: Create if valid
  await fetch('/api/v1/schedules', {
    method: 'POST',
    body: JSON.stringify({
      // ... same data plus subject_id
    })
  });
} else {
  // Show conflicts to user
  console.log('Conflicts:', result.data.conflicts);
}
```

### Example 2: Get Weekly Schedule
```javascript
// Get all Monday classes for a specific room
const response = await fetch('/api/v1/schedules?' + new URLSearchParams({
  tenant_id: 'tenant-uuid',
  room_id: 'room-uuid',
  day_of_week: 1,
  status: 'active'
}));

const schedule = await response.json();
```

### Example 3: Check for Conflicts
```javascript
// Get all unresolved conflicts
const response = await fetch('/api/v1/schedules/conflicts/list?' + new URLSearchParams({
  tenant_id: 'tenant-uuid',
  status: 'unresolved'
}));

const conflicts = await response.json();
```

## Performance Considerations

### Indexes
The system includes optimized indexes for:
- Tenant-based queries
- Conflict detection (room, teacher, batch + day + time)
- Date range queries
- Status filtering

### Query Optimization
- Conflict detection uses a single database function call
- RLS policies are applied at the database level
- Indexes support efficient time overlap checks

## Security

### Row-Level Security (RLS)
- All tables have RLS enabled
- Tenant isolation enforced at database level
- No cross-tenant data access possible

### Input Validation
- All API endpoints validate required fields
- Time ranges validated (end_time > start_time)
- Date ranges validated (effective_to >= effective_from)
- Day of week validated (0-6)

## Testing

### Unit Tests
- 17 tests for `schedulingService.js`
- 16 tests for `schedules.js` routes
- 100% coverage of core functionality

### Test Coverage
- Conflict detection scenarios
- CRUD operations
- Error handling
- Multi-tenant isolation
- Input validation

## Future Enhancements

1. **AI-Assisted Optimization** (Task 5.2.2)
   - Constraint Satisfaction Problem (CSP) solver
   - Genetic Algorithm for optimal scheduling
   - Room utilization optimization
   - Teacher gap minimization

2. **Schedule Change Propagation** (Task 5.2.3)
   - Automatic notifications to affected stakeholders
   - Email/SMS alerts for schedule changes
   - Batch notification grouping

3. **Temporary Overrides** (Task 5.2.4)
   - Substitute teacher assignments
   - Room changes for specific dates
   - Time shifts without breaking recurrence

4. **Visual Schedule Grid**
   - Interactive calendar view
   - Drag-and-drop scheduling
   - Visual conflict indicators
   - Color-coded by subject/teacher/room

## Migration

To apply the scheduling system migration:

```bash
node database/run_migration_027.js
```

To rollback:

```bash
psql -U postgres -d eduos -f database/migrations/027_scheduling_system_rollback.sql
```

## Support

For issues or questions about the scheduling system, refer to:
- API documentation: `/api/v1/schedules` endpoints
- Database schema: `database/migrations/027_scheduling_system.sql`
- Service implementation: `src/services/schedulingService.js`
- Route implementation: `src/routes/schedules.js`
