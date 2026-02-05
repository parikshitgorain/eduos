# Student Enrollment Workflow

**Task:** 2.1.3 - Create student enrollment workflow  
**Status:** Complete  
**Last Updated:** 2026-02-05

---

## Overview

The Student Enrollment Workflow provides a comprehensive system for managing student enrollments in batches. This implementation ensures data integrity, prevents duplicate enrollments, and maintains a complete enrollment history for each student.

---

## Features

### ✅ Core Features Implemented

1. **Multiple Batch Enrollments**
   - Students can be enrolled in multiple batches simultaneously
   - Each enrollment is tracked independently with its own status and dates

2. **Comprehensive Enrollment Data**
   - `start_date`: When the enrollment begins (required)
   - `end_date`: When the enrollment ends (optional)
   - `status`: Current enrollment status (active/inactive/graduated/withdrawn)
   - `metadata`: Flexible JSONB field for additional data

3. **Immutable Enrollment History**
   - All enrollment records are preserved
   - Status changes are tracked in metadata with timestamps
   - Soft delete (withdrawal) instead of hard delete

4. **Bulk Enrollment API**
   - CSV import support for bulk enrollment creation
   - Partial failure handling with detailed error reporting
   - Transaction-based processing for data consistency

5. **Duplicate Prevention**
   - Validates that a student is not already enrolled in the same batch
   - Checks for both active and inactive enrollments
   - Clear error messages for duplicate attempts

---

## API Endpoints

### 1. Create Enrollment

**Endpoint:** `POST /api/v1/enrollments`

**Request Body:**
```json
{
  "studentId": "uuid-v4",
  "batchId": "uuid-v4",
  "startDate": "2026-01-01",
  "endDate": "2026-12-31",
  "status": "active",
  "metadata": {}
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "enrollment": {
    "enrollment_id": "uuid-v4",
    "tenant_id": "uuid-v4",
    "student_id": "uuid-v4",
    "batch_id": "uuid-v4",
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "status": "active",
    "metadata": {},
    "created_at": "2026-02-05T10:00:00Z",
    "updated_at": "2026-02-05T10:00:00Z"
  }
}
```

**Validation Rules:**
- `studentId` is required and must exist
- `batchId` is required and must exist
- `startDate` is required
- `status` must be one of: active, inactive, graduated, withdrawn
- `startDate` must be before `endDate` (if provided)
- Student cannot be enrolled in the same batch twice (active or inactive)

---

### 2. Get Enrollment by ID

**Endpoint:** `GET /api/v1/enrollments/:id`

**Response (200 OK):**
```json
{
  "success": true,
  "enrollment": {
    "enrollment_id": "uuid-v4",
    "tenant_id": "uuid-v4",
    "student_id": "uuid-v4",
    "batch_id": "uuid-v4",
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "status": "active",
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com",
    "batch_name": "Batch A",
    "created_at": "2026-02-05T10:00:00Z",
    "updated_at": "2026-02-05T10:00:00Z"
  }
}
```

---

### 3. List Enrollments

**Endpoint:** `GET /api/v1/enrollments`

**Query Parameters:**
- `page` (default: 1): Page number for pagination
- `limit` (default: 20): Number of results per page
- `studentId`: Filter by student ID
- `batchId`: Filter by batch ID
- `status`: Filter by enrollment status
- `startDateFrom`: Filter enrollments starting from this date
- `startDateTo`: Filter enrollments starting before this date

**Example:** `GET /api/v1/enrollments?studentId=uuid&status=active&page=1&limit=20`

**Response (200 OK):**
```json
{
  "success": true,
  "enrollments": [
    {
      "enrollment_id": "uuid-v4",
      "student_id": "uuid-v4",
      "batch_id": "uuid-v4",
      "first_name": "John",
      "last_name": "Doe",
      "batch_name": "Batch A",
      "status": "active"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### 4. Update Enrollment Status

**Endpoint:** `PATCH /api/v1/enrollments/:id/status`

**Request Body:**
```json
{
  "status": "graduated",
  "metadata": {
    "graduation_date": "2026-12-31",
    "notes": "Completed with honors"
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "enrollment": {
    "enrollment_id": "uuid-v4",
    "status": "graduated",
    "metadata": {
      "graduation_date": "2026-12-31",
      "notes": "Completed with honors",
      "status_history": [
        {
          "from_status": "active",
          "to_status": "graduated",
          "changed_at": "2026-02-05T10:00:00Z"
        }
      ]
    }
  }
}
```

**Note:** Status changes are tracked in the `metadata.status_history` array, preserving the complete history of status transitions.

---

### 5. Update Enrollment Dates

**Endpoint:** `PATCH /api/v1/enrollments/:id/dates`

**Request Body:**
```json
{
  "startDate": "2026-01-15",
  "endDate": "2026-12-15"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "enrollment": {
    "enrollment_id": "uuid-v4",
    "start_date": "2026-01-15",
    "end_date": "2026-12-15"
  }
}
```

---

### 6. Get Student Enrollment History

**Endpoint:** `GET /api/v1/enrollments/student/:studentId/history`

**Response (200 OK):**
```json
{
  "success": true,
  "enrollments": [
    {
      "enrollment_id": "uuid-v4",
      "student_id": "uuid-v4",
      "batch_name": "Batch A",
      "program_name": "Computer Science",
      "center_name": "Main Campus",
      "institute_name": "Tech University",
      "start_date": "2026-01-01",
      "end_date": null,
      "status": "active"
    },
    {
      "enrollment_id": "uuid-v4-2",
      "student_id": "uuid-v4",
      "batch_name": "Batch B",
      "program_name": "Mathematics",
      "center_name": "Main Campus",
      "institute_name": "Tech University",
      "start_date": "2025-01-01",
      "end_date": "2025-12-31",
      "status": "graduated"
    }
  ],
  "count": 2
}
```

**Note:** Returns complete enrollment history ordered by start date (most recent first), including the full hierarchy (Institute → Center → Program → Batch).

---

### 7. Bulk Create Enrollments

**Endpoint:** `POST /api/v1/enrollments/bulk`

**Request Body:**
```json
{
  "enrollments": [
    {
      "studentId": "uuid-1",
      "batchId": "uuid-batch",
      "startDate": "2026-01-01",
      "status": "active"
    },
    {
      "studentId": "uuid-2",
      "batchId": "uuid-batch",
      "startDate": "2026-01-01",
      "status": "active"
    }
  ]
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "results": {
    "successful": 2,
    "failed": 0,
    "total": 2
  },
  "details": {
    "successful": [
      {
        "enrollment": {
          "enrollment_id": "uuid-v4",
          "student_id": "uuid-1",
          "batch_id": "uuid-batch",
          "status": "active"
        },
        "originalData": { ... }
      }
    ],
    "failed": []
  }
}
```

**Partial Failure Example:**
```json
{
  "success": true,
  "results": {
    "successful": 1,
    "failed": 1,
    "total": 2
  },
  "details": {
    "successful": [ ... ],
    "failed": [
      {
        "enrollment": {
          "studentId": "uuid-2",
          "batchId": "uuid-batch",
          "startDate": "2026-01-01"
        },
        "error": "Student with ID uuid-2 not found"
      }
    ]
  }
}
```

**Features:**
- Transaction-based processing for data consistency
- Continues processing even if some enrollments fail
- Detailed error reporting for each failed enrollment
- All validations applied (duplicate check, student/batch existence, date validation)

---

### 8. Delete Enrollment (Soft Delete)

**Endpoint:** `DELETE /api/v1/enrollments/:id`

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Enrollment withdrawn successfully",
  "enrollment": {
    "enrollment_id": "uuid-v4",
    "status": "withdrawn",
    "metadata": {
      "deleted_at": "2026-02-05T10:00:00Z",
      "status_history": [
        {
          "from_status": "active",
          "to_status": "withdrawn",
          "changed_at": "2026-02-05T10:00:00Z"
        }
      ]
    }
  }
}
```

**Note:** This is a soft delete that sets the status to "withdrawn" and preserves the enrollment record for historical purposes.

---

## Database Schema

The enrollment workflow uses the existing `enrollments` table:

```sql
CREATE TABLE enrollments (
    enrollment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    batch_id UUID NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' 
        CHECK (status IN ('active', 'inactive', 'graduated', 'withdrawn')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for performance
CREATE INDEX idx_enrollments_tenant_id ON enrollments(tenant_id);
CREATE INDEX idx_enrollments_student_id ON enrollments(tenant_id, student_id);
CREATE INDEX idx_enrollments_batch_id ON enrollments(tenant_id, batch_id);
CREATE INDEX idx_enrollments_status ON enrollments(tenant_id, status);

-- Row-Level Security enabled
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
```

---

## Service Layer

**File:** `src/services/enrollmentService.js`

### Key Functions:

1. **createEnrollment(params)** - Create a new enrollment with validation
2. **getEnrollmentById(enrollmentId, tenantId)** - Retrieve enrollment with student/batch details
3. **listEnrollments(tenantId, options)** - List enrollments with filtering and pagination
4. **updateEnrollmentStatus(enrollmentId, tenantId, newStatus, metadata)** - Update status with history tracking
5. **updateEnrollmentDates(enrollmentId, tenantId, dates)** - Update start/end dates
6. **getStudentEnrollmentHistory(studentId, tenantId)** - Get complete enrollment history
7. **bulkCreateEnrollments(tenantId, enrollments)** - Bulk create with partial failure handling
8. **deleteEnrollment(enrollmentId, tenantId)** - Soft delete (withdraw)

### Validation Functions:

- **validateStudent(studentId, tenantId, client)** - Verify student exists
- **validateBatch(batchId, tenantId, client)** - Verify batch exists
- **checkDuplicateEnrollment(studentId, batchId, tenantId, client)** - Prevent duplicates

---

## Testing

### Unit Tests

**File:** `src/services/enrollmentService.test.js`

**Coverage:** 19 test cases covering:
- Successful enrollment creation
- Validation error handling
- Duplicate enrollment prevention
- Student/batch existence validation
- Date validation
- Status updates with history tracking
- Bulk enrollment with partial failures
- Enrollment history retrieval

**Run tests:**
```bash
npm test -- src/services/enrollmentService.test.js
```

### Integration Tests

**File:** `src/routes/enrollments.test.js`

**Coverage:** 21 test cases covering:
- All API endpoints
- Request/response validation
- Error handling (400, 404, 500)
- Query parameter filtering
- Bulk operations
- Soft delete functionality

**Run tests:**
```bash
npm test -- src/routes/enrollments.test.js
```

---

## Usage Examples

### Example 1: Enroll a Student in a Batch

```javascript
// POST /api/v1/enrollments
const response = await fetch('/api/v1/enrollments', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <token>'
  },
  body: JSON.stringify({
    studentId: '223e4567-e89b-12d3-a456-426614174000',
    batchId: '323e4567-e89b-12d3-a456-426614174000',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    status: 'active'
  })
});

const data = await response.json();
console.log(data.enrollment);
```

### Example 2: Get All Active Enrollments for a Student

```javascript
// GET /api/v1/enrollments?studentId=xxx&status=active
const response = await fetch(
  '/api/v1/enrollments?studentId=223e4567-e89b-12d3-a456-426614174000&status=active',
  {
    headers: {
      'Authorization': 'Bearer <token>'
    }
  }
);

const data = await response.json();
console.log(data.enrollments);
```

### Example 3: Mark Student as Graduated

```javascript
// PATCH /api/v1/enrollments/:id/status
const response = await fetch('/api/v1/enrollments/423e4567-e89b-12d3-a456-426614174000/status', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <token>'
  },
  body: JSON.stringify({
    status: 'graduated',
    metadata: {
      graduation_date: '2026-12-31',
      final_grade: 'A'
    }
  })
});

const data = await response.json();
console.log(data.enrollment);
```

### Example 4: Bulk Enroll Students from CSV

```javascript
// POST /api/v1/enrollments/bulk
const csvData = [
  { studentId: 'uuid-1', batchId: 'batch-uuid', startDate: '2026-01-01' },
  { studentId: 'uuid-2', batchId: 'batch-uuid', startDate: '2026-01-01' },
  { studentId: 'uuid-3', batchId: 'batch-uuid', startDate: '2026-01-01' }
];

const response = await fetch('/api/v1/enrollments/bulk', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <token>'
  },
  body: JSON.stringify({ enrollments: csvData })
});

const data = await response.json();
console.log(`Successful: ${data.results.successful}, Failed: ${data.results.failed}`);
console.log('Failed enrollments:', data.details.failed);
```

### Example 5: View Student's Complete Enrollment History

```javascript
// GET /api/v1/enrollments/student/:studentId/history
const response = await fetch(
  '/api/v1/enrollments/student/223e4567-e89b-12d3-a456-426614174000/history',
  {
    headers: {
      'Authorization': 'Bearer <token>'
    }
  }
);

const data = await response.json();
data.enrollments.forEach(enrollment => {
  console.log(`${enrollment.institute_name} > ${enrollment.center_name} > ${enrollment.program_name} > ${enrollment.batch_name}`);
  console.log(`Status: ${enrollment.status}, Period: ${enrollment.start_date} to ${enrollment.end_date || 'Present'}`);
});
```

---

## Error Handling

### Common Error Responses

**400 Bad Request - Validation Error:**
```json
{
  "success": false,
  "error": "Validation failed: student_id is required"
}
```

**400 Bad Request - Duplicate Enrollment:**
```json
{
  "success": false,
  "error": "Duplicate enrollment detected: Student is already enrolled in this batch with status 'active'"
}
```

**404 Not Found:**
```json
{
  "success": false,
  "error": "Student with ID xxx not found"
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "error": "Internal server error"
}
```

---

## Security Considerations

1. **Multi-Tenancy Isolation**
   - All queries are automatically scoped to the tenant via Row-Level Security (RLS)
   - Tenant ID is extracted from JWT token in the tenant context middleware

2. **Input Validation**
   - All required fields are validated
   - Date ranges are validated (start_date < end_date)
   - Status values are restricted to allowed values
   - UUIDs are validated for student and batch existence

3. **Transaction Safety**
   - Bulk operations use database transactions
   - Rollback on failure ensures data consistency
   - Duplicate checks prevent data integrity issues

4. **Audit Trail**
   - All status changes are tracked in metadata
   - Created/updated timestamps are automatically maintained
   - Soft delete preserves historical records

---

## Performance Considerations

1. **Database Indexes**
   - Indexes on tenant_id, student_id, batch_id, and status
   - Optimized for common query patterns

2. **Pagination**
   - Default limit of 20 results per page
   - Prevents large result sets from impacting performance

3. **Query Optimization**
   - JOINs with students and batches tables for enriched data
   - Efficient filtering using indexed columns

---

## Future Enhancements

1. **Enrollment Approval Workflow**
   - Add approval status for enrollments requiring admin approval
   - Notification system for pending approvals

2. **Enrollment Capacity Management**
   - Batch capacity limits
   - Waitlist functionality

3. **Enrollment Transfer**
   - Transfer students between batches
   - Preserve enrollment history during transfers

4. **Advanced Reporting**
   - Enrollment trends and analytics
   - Batch fill rates
   - Student progression tracking

---

## Related Documentation

- [Hierarchy Service](./RBAC_SYSTEM.md) - Institute → Center → Program → Batch hierarchy
- [Multi-Tenancy](./DOMAIN_MAPPING.md) - Tenant isolation and RLS
- [Authentication](./AUTH_SERVICE.md) - JWT tokens and tenant context

---

## Task Completion Checklist

- [x] Students can be enrolled in multiple batches
- [x] Enrollment includes: start_date, end_date, status (active/inactive/graduated/withdrawn)
- [x] Enrollment history preserved (immutable records with status tracking)
- [x] Bulk enrollment API for CSV imports
- [x] Validation: prevent duplicate enrollments in same batch
- [x] Comprehensive unit tests (19 test cases)
- [x] Integration tests for all API endpoints (21 test cases)
- [x] Documentation complete

**Status:** ✅ Complete
