# Historic Rendering with Snapshot Association

**Task:** 2.2.5 - Implement historic rendering with snapshot association  
**Status:** Complete  
**Date:** 2026-02-05

---

## Overview

Historic rendering ensures that student records are always displayed using the exact schema snapshot that existed when they were created. This guarantees data integrity and prevents confusion when schemas evolve over time.

## Key Features

### 1. Immutable Snapshot Association

Every student record stores an immutable `snapshot_id` reference that links it to the schema version used at creation time.

```javascript
{
  "record_id": "uuid",
  "student_id": "uuid",
  "snapshot_id": "uuid",  // Immutable reference
  "data": { ... },
  "created_at": "2025-01-15T10:30:00Z"
}
```

### 2. Schema Version Badge

When rendering a record, the UI displays a clear version badge:

```
Schema v1.2.3 - 6/15/2025
```

This helps users understand which schema version was used for the record.

### 3. SHA-256 Integrity Verification

Every time a record is rendered, the system:
1. Fetches the schema snapshot
2. Computes SHA-256 hash of the schema definition
3. Compares with stored hash
4. Throws error if tampering is detected

```javascript
{
  "integrity_verified": true,
  "verification_timestamp": "2026-02-05T14:30:00Z"
}
```

### 4. Schema Transformation Export

Admins can transform historical records to new schema formats without modifying the originals:

```javascript
POST /api/v1/student-records/:recordId/transform
{
  "target_snapshot_id": "new-schema-uuid",
  "field_mappings": {
    "first_name": "name",  // Map old field to new field
    "last_name": "name"
  }
}
```

The transformation creates a **new artifact** and logs the operation in the audit trail.

---

## API Endpoints

### Render Record with Original Schema

```http
GET /api/v1/student-records/:recordId/render
```

**Response:**
```json
{
  "success": true,
  "data": {
    "record_id": "uuid",
    "student_id": "uuid",
    "snapshot_id": "uuid",
    "schema_version": "v1.2.3",
    "schema_created_at": "2025-01-01T00:00:00Z",
    "form_type": "student_enrollment",
    "record_created_at": "2025-01-15T10:30:00Z",
    "fields": [
      {
        "field_name": "first_name",
        "field_type": "text",
        "label": "First Name",
        "value": "John",
        "display_order": 0
      }
    ],
    "schema_version_badge": "Schema v1.2.3 - 1/1/2025",
    "integrity_verified": true,
    "verification_timestamp": "2026-02-05T14:30:00Z"
  }
}
```

### Batch Render Multiple Records

```http
POST /api/v1/student-records/render/batch
Content-Type: application/json

{
  "record_ids": ["uuid1", "uuid2", "uuid3"]
}
```

### Get Student Record History

```http
GET /api/v1/student-records/student/:studentId/history
```

Returns all records for a student across different schema versions.

### Create Student Record

```http
POST /api/v1/student-records
Content-Type: application/json

{
  "student_id": "uuid",
  "snapshot_id": "uuid",
  "data": {
    "first_name": "John",
    "last_name": "Doe",
    "date_of_birth": "2005-03-15"
  }
}
```

### Transform Record (Admin Only)

```http
POST /api/v1/student-records/:recordId/transform
Content-Type: application/json

{
  "target_snapshot_id": "new-schema-uuid",
  "field_mappings": {
    "first_name": "name",
    "last_name": "name"
  }
}
```

---

## Database Schema

### student_records Table

```sql
CREATE TABLE student_records (
    record_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    student_id UUID NOT NULL,
    snapshot_id UUID NOT NULL REFERENCES schema_snapshots(snapshot_id),
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL,
    updated_by UUID
);
```

### schema_transformations Table

```sql
CREATE TABLE schema_transformations (
    transformation_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    source_record_id UUID NOT NULL,
    source_snapshot_id UUID NOT NULL,
    target_snapshot_id UUID NOT NULL,
    field_mappings JSONB NOT NULL,
    source_data JSONB NOT NULL,
    transformed_data JSONB NOT NULL,
    transformed_by UUID NOT NULL,
    transformation_status VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Usage Examples

### Example 1: Render a Historical Record

```javascript
const schemaService = require('./services/schemaService');

const rendered = await schemaService.renderRecordWithSnapshot(
  'record-uuid',
  'tenant-uuid'
);

console.log(rendered.schema_version_badge);
// Output: "Schema v1.2.3 - 1/1/2025"

console.log(rendered.integrity_verified);
// Output: true
```

### Example 2: View Student History

```javascript
const history = await schemaService.getStudentRecordHistory(
  'student-uuid',
  'tenant-uuid'
);

history.forEach(record => {
  console.log(`${record.schema_version_badge} - ${record.form_type}`);
});

// Output:
// Schema v2.0.0 - 3/1/2025 - student_enrollment
// Schema v1.0.0 - 1/1/2025 - student_enrollment
```

### Example 3: Transform to New Schema

```javascript
const transformation = await schemaService.transformRecordToNewSchema(
  'record-uuid',
  'new-snapshot-uuid',
  'tenant-uuid',
  'admin-user-uuid',
  {
    first_name: 'name',  // Map 'name' field to 'first_name'
    last_name: 'name'
  }
);

console.log(transformation.note);
// Output: "This is a transformation export. The original record remains unchanged."
```

---

## Security Considerations

### 1. Integrity Verification

Every render operation verifies the SHA-256 hash of the schema snapshot. If tampering is detected, the system throws an error and logs the incident.

### 2. Immutability

The `snapshot_id` field in student records is immutable after creation. This prevents accidental or malicious modification of historical associations.

### 3. Admin-Only Transformations

Schema transformations require admin role and are fully audited in the `schema_transformations` table.

### 4. Audit Trail

All transformations are logged with:
- Source and target schema versions
- Field mappings used
- Admin who performed the transformation
- Timestamp

---

## Testing

Comprehensive test suite available at:
- `src/services/schemaService.historicRendering.test.js`

Run tests:
```bash
npm test -- schemaService.historicRendering.test.js
```

Test coverage:
- ✅ Rendering with original schema
- ✅ Integrity verification
- ✅ Batch rendering
- ✅ Student history
- ✅ Schema transformations
- ✅ Error handling

---

## Migration

Database migration files:
- `database/migrations/011_historic_rendering.sql`
- `database/migrations/011_historic_rendering_rollback.sql`

Run migration:
```bash
node database/migrate.js
```

---

## Performance Considerations

### Caching

Schema snapshots should be cached in Redis to avoid repeated database queries:

```javascript
const cacheKey = `schema:snapshot:${snapshotId}`;
const cached = await redis.get(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

const snapshot = await getSchemaSnapshotById(snapshotId, tenantId);
await redis.setex(cacheKey, 3600, JSON.stringify(snapshot));
```

### Batch Operations

Use `renderRecordsWithSnapshots()` for rendering multiple records to optimize database queries.

### Indexes

The migration creates indexes on:
- `student_records.snapshot_id`
- `student_records.student_id`
- `schema_transformations.source_record_id`

---

## Future Enhancements

1. **UI Components**: React components for displaying schema version badges
2. **Comparison View**: Side-by-side comparison of records across schema versions
3. **Bulk Transformations**: Transform multiple records in a single operation
4. **Transformation Templates**: Pre-defined field mappings for common schema migrations
5. **Version Timeline**: Visual timeline showing schema evolution

---

## References

- Requirements: `.kiro/specs/eduos-platform/requirements.md` (Module A, Section 1)
- Design: `.kiro/specs/eduos-platform/design.md` (Section 2.1.3)
- Tasks: `.kiro/specs/eduos-platform/tasks.md` (Task 2.2.5)
