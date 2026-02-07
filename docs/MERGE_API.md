# Merge Operations API Documentation

**Version:** 1.0  
**Task:** 3.3.3 Create merge audit trail and reversibility  
**Last Updated:** 2026-02-07

---

## Overview

The Merge Operations API provides endpoints for managing student record merges with full audit trail and reversibility capabilities. All merge operations are protected by tenant context middleware and require authentication.

---

## Base URL

```
/api/v1/merges
```

---

## Authentication

All endpoints require:
- Valid JWT token in Authorization header
- Tenant context (automatically extracted from JWT)
- User context (automatically extracted from JWT)

---

## Endpoints

### 1. Execute Merge

Execute a student merge operation with full audit trail.

**Endpoint:** `POST /api/v1/merges`

**Request Body:**
```json
{
  "primaryStudentId": "uuid-v4",
  "secondaryStudentIds": ["uuid-v4", "uuid-v4"],
  "mergeReason": "Duplicate records identified during data cleanup"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "mergeId": "merge-uuid",
    "snapshotId": "snapshot-uuid",
    "primaryStudentId": "primary-uuid",
    "secondaryStudentIds": ["secondary-uuid-1", "secondary-uuid-2"],
    "mergedAt": "2026-02-07T10:30:00.000Z",
    "mergedBy": "user-uuid",
    "mergeReason": "Duplicate records identified during data cleanup",
    "impact": {
      "enrollments": 5,
      "attendance": 120,
      "payments": 3,
      "total": 128
    },
    "status": "completed"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Missing required fields
- `500 Internal Server Error` - Merge execution failed

---

### 2. Get Impact Assessment

Calculate the impact of a potential merge without executing it.

**Endpoint:** `POST /api/v1/merges/impact-assessment`

**Request Body:**
```json
{
  "primaryStudentId": "uuid-v4",
  "secondaryStudentIds": ["uuid-v4", "uuid-v4"]
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "primaryStudent": {
      "studentId": "primary-uuid",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "secondaryStudents": [
      {
        "studentId": "secondary-uuid-1",
        "name": "Jon Doe",
        "email": "jon@example.com"
      }
    ],
    "affectedRecords": {
      "enrollments": 5,
      "attendance": 120,
      "payments": 3,
      "total": 128
    },
    "confirmationMessage": "I understand this will affect 128 records (5 enrollments, 120 attendance records, 3 payments)",
    "requiresConfirmation": true
  }
}
```

**Error Responses:**
- `400 Bad Request` - Missing required fields
- `500 Internal Server Error` - Assessment calculation failed

---

### 3. Get Merge Details

Retrieve details of a specific merge operation.

**Endpoint:** `GET /api/v1/merges/:mergeId`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "mergeId": "merge-uuid",
    "snapshotId": "snapshot-uuid",
    "primaryStudentId": "primary-uuid",
    "secondaryStudentIds": ["secondary-uuid-1", "secondary-uuid-2"],
    "mergeReason": "Duplicate records identified during data cleanup",
    "mergedBy": "user-uuid",
    "mergedAt": "2026-02-07T10:30:00.000Z",
    "status": "completed",
    "reversedAt": null,
    "reversedBy": null,
    "reverseReason": null,
    "affectedRecords": {
      "enrollments": 5,
      "attendance": 120,
      "payments": 3,
      "total": 128
    },
    "metadata": {}
  }
}
```

**Error Responses:**
- `404 Not Found` - Merge not found
- `500 Internal Server Error` - Retrieval failed

---

### 4. Get Merge History

Retrieve merge history for a specific student (as primary or secondary).

**Endpoint:** `GET /api/v1/merges/student/:studentId/history`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "studentId": "student-uuid",
    "merges": [
      {
        "mergeId": "merge-uuid-1",
        "snapshotId": "snapshot-uuid-1",
        "primaryStudentId": "primary-uuid",
        "secondaryStudentIds": ["secondary-uuid-1"],
        "mergeReason": "Duplicate records",
        "mergedBy": "user-uuid",
        "mergedAt": "2026-02-07T10:30:00.000Z",
        "status": "completed",
        "reversedAt": null,
        "reversedBy": null,
        "reverseReason": null,
        "affectedRecords": {
          "enrollments": 5,
          "attendance": 120,
          "payments": 3,
          "total": 128
        }
      }
    ]
  }
}
```

**Error Responses:**
- `500 Internal Server Error` - Retrieval failed

---

### 5. Restore Merge (Undo)

Restore a merge operation within the SLA window.

**Endpoint:** `POST /api/v1/merges/:mergeId/restore`

**Request Body:**
```json
{
  "reverseReason": "Incorrect merge - students are not duplicates"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "mergeId": "merge-uuid",
    "status": "reversed",
    "reversedAt": "2026-02-07T12:30:00.000Z",
    "reversedBy": "user-uuid",
    "reverseReason": "Incorrect merge - students are not duplicates",
    "restoredRecords": {
      "primary": 1,
      "secondary": 2
    }
  }
}
```

**Error Responses:**
- `400 Bad Request` - Missing reverseReason
- `403 Forbidden` - Restore window expired
- `404 Not Found` - Merge not found
- `409 Conflict` - Merge already reversed
- `500 Internal Server Error` - Restore failed

**SLA Windows:**
- **Basic Tier:** 4 hours
- **Business Tier:** 1 hour
- **Enterprise Tier:** 1 hour

---

### 6. Get Restore Preview

Preview what will be restored without executing the restore.

**Endpoint:** `GET /api/v1/merges/:mergeId/restore-preview`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "mergeId": "merge-uuid",
    "canRestore": true,
    "slaWindow": {
      "hours": 4,
      "timeRemaining": "2.5 hours",
      "mergedAt": "2026-02-07T10:30:00.000Z"
    },
    "restoreActions": {
      "willRestoreStudents": 2,
      "willRevertEnrollments": 5,
      "willRevertAttendance": 120,
      "willRevertPayments": 3
    },
    "primaryStudent": {
      "studentId": "primary-uuid",
      "name": "John Doe"
    },
    "secondaryStudents": [
      {
        "studentId": "secondary-uuid-1",
        "name": "Jon Doe"
      },
      {
        "studentId": "secondary-uuid-2",
        "name": "J. Doe"
      }
    ]
  }
}
```

**Error Responses:**
- `404 Not Found` - Merge not found
- `500 Internal Server Error` - Preview generation failed

---

## Audit Trail

All merge operations are fully audited with the following information:

### Audit Log Fields

- **merge_id** - Unique identifier for the merge operation
- **merge_snapshot_id** - Reference to pre-merge cryptographic snapshot
- **primary_student_id** - Primary (canonical) student record
- **secondary_student_ids** - Array of secondary student records merged
- **merge_reason** - Mandatory reason for the merge
- **merged_by** - User who executed the merge
- **merged_at** - Timestamp of merge execution
- **status** - Merge status (completed, reversed)
- **reversed_at** - Timestamp of reversal (if applicable)
- **reversed_by** - User who reversed the merge (if applicable)
- **reverse_reason** - Reason for reversal (if applicable)
- **affected_enrollments** - Count of enrollment records affected
- **affected_attendance** - Count of attendance records affected
- **affected_payments** - Count of payment records affected

### Bidirectional References

The system maintains bidirectional references between merged records:

**Primary Student Record:**
```sql
merged_from: [secondary-uuid-1, secondary-uuid-2]
```

**Secondary Student Records:**
```sql
merged_into: primary-uuid
merged_at: 2026-02-07T10:30:00.000Z
status: 'merged'
```

---

## Reversibility

### SLA Windows

Merge operations can be reversed within tenant-specific SLA windows:

| Tier | Restore Window |
|------|----------------|
| Basic | 4 hours |
| Business | 1 hour |
| Enterprise | 1 hour |

### Restore Process

1. **Validation**
   - Verify merge exists and belongs to tenant
   - Check merge status (must be 'completed', not 'reversed')
   - Validate SLA window has not expired

2. **Snapshot Retrieval**
   - Retrieve pre-merge cryptographic snapshot
   - Verify snapshot integrity (SHA-256 hash)

3. **Record Restoration**
   - Restore secondary student records from snapshot
   - Revert foreign key references (enrollments, attendance, payments)
   - Update primary student record (remove merge metadata)

4. **Audit Update**
   - Mark merge as 'reversed' in audit log
   - Record reversal timestamp, user, and reason

### Limitations

- Merges cannot be reversed after the SLA window expires
- Already reversed merges cannot be reversed again
- Foreign key references are reverted to primary student (original ownership tracking not yet implemented)

---

## Error Handling

### Common Error Codes

- **400 Bad Request** - Invalid request parameters
- **403 Forbidden** - Operation not allowed (e.g., expired SLA window)
- **404 Not Found** - Resource not found
- **409 Conflict** - Resource conflict (e.g., already reversed)
- **500 Internal Server Error** - Server-side error

### Error Response Format

```json
{
  "error": "Error Type",
  "message": "Detailed error message"
}
```

---

## Security Considerations

### Tenant Isolation

- All operations enforce tenant context via Row-Level Security (RLS)
- Users can only access merges within their tenant
- Cross-tenant merge operations are prevented

### Authentication

- All endpoints require valid JWT authentication
- User identity is tracked in audit logs
- Merge and restore operations require appropriate permissions

### Audit Trail

- All merge operations are logged with full context
- Audit logs are tamper-evident (append-only table)
- Cryptographic snapshots ensure data integrity

---

## Best Practices

### Before Merging

1. **Review Duplicates** - Use the duplicate review queue to identify potential duplicates
2. **Impact Assessment** - Always check impact assessment before merging
3. **Verify Records** - Manually verify that records are truly duplicates
4. **Document Reason** - Provide clear, detailed merge reason

### During Merge

1. **Confirmation** - Require explicit user confirmation with impact summary
2. **Transaction Safety** - All merge operations are atomic (all-or-nothing)
3. **Snapshot Creation** - Pre-merge snapshot is automatically created

### After Merge

1. **Verify Results** - Check merge history to confirm successful merge
2. **Monitor SLA** - Be aware of restore window expiration
3. **Document Issues** - If merge was incorrect, restore immediately with clear reason

---

## Examples

### Complete Merge Workflow

```javascript
// 1. Get impact assessment
const assessment = await fetch('/api/v1/merges/impact-assessment', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <token>',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    primaryStudentId: 'primary-uuid',
    secondaryStudentIds: ['secondary-uuid-1', 'secondary-uuid-2']
  })
});

// 2. Show confirmation dialog to user
const { confirmationMessage } = await assessment.json();
const confirmed = confirm(confirmationMessage);

// 3. Execute merge if confirmed
if (confirmed) {
  const merge = await fetch('/api/v1/merges', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer <token>',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      primaryStudentId: 'primary-uuid',
      secondaryStudentIds: ['secondary-uuid-1', 'secondary-uuid-2'],
      mergeReason: 'Duplicate records identified during data cleanup'
    })
  });
  
  const result = await merge.json();
  console.log('Merge completed:', result.data.mergeId);
}
```

### Restore Merge Workflow

```javascript
// 1. Get restore preview
const preview = await fetch('/api/v1/merges/merge-uuid/restore-preview', {
  headers: {
    'Authorization': 'Bearer <token>'
  }
});

const previewData = await preview.json();

// 2. Check if restore is possible
if (previewData.data.canRestore) {
  console.log(`Time remaining: ${previewData.data.slaWindow.timeRemaining}`);
  
  // 3. Execute restore
  const restore = await fetch('/api/v1/merges/merge-uuid/restore', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer <token>',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      reverseReason: 'Incorrect merge - students are not duplicates'
    })
  });
  
  const result = await restore.json();
  console.log('Merge restored:', result.data.status);
} else {
  console.error('Restore window expired');
}
```

---

## Related Documentation

- [Duplicate Review Queue API](./DUPLICATE_REVIEW_QUEUE.md)
- [Student Merge Service](../src/services/studentMergeService.js)
- [Merge Snapshot Service](../src/services/mergeSnapshotService.js)
- [Task 3.3.1: Pre-merge Cryptographic Snapshots](./tasks/TASK_3.3.1_IMPLEMENTATION_SUMMARY.md)
- [Task 3.3.2: Merge Workflow Implementation](./tasks/TASK_3.3.2_IMPLEMENTATION_SUMMARY.md)

---

## Changelog

### Version 1.0 (2026-02-07)
- Initial API documentation
- Complete merge operations endpoints
- Audit trail and reversibility features
- SLA window enforcement
- Comprehensive examples and best practices
