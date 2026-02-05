# Schema Definition and Storage System

**Version:** 1.0  
**Task:** 2.2.1 - Build schema definition and storage system  
**Status:** Complete

---

## Overview

The Schema Definition and Storage System provides a flexible, versioned approach to managing dynamic form schemas in the EduOS Platform. It supports immutable schema snapshots with cryptographic integrity verification, semantic versioning, and full import/export capabilities.

---

## Features

### Core Capabilities

1. **JSON Schema Format** - Flexible JSON-based schema definitions
2. **Immutable Snapshots** - Schema versions are immutable with SHA-256 hashing
3. **Semantic Versioning** - SemVer (v1.2.3) for schema versions
4. **Field Types** - Support for multiple field types
5. **Validation Rules** - Comprehensive validation rule system
6. **Import/Export** - Portable schema definitions
7. **Multi-Tenancy** - Full tenant isolation with RLS

---

## Supported Field Types

The system supports the following field types:

- `text` - Single-line text input
- `textarea` - Multi-line text input
- `number` - Numeric input
- `date` - Date picker
- `email` - Email address with validation
- `phone` - Phone number with validation
- `dropdown` - Single-select dropdown
- `radio` - Radio button group
- `checkbox` - Checkbox (single or multiple)
- `file_upload` - File upload field

---

## Supported Validation Rules

- `required` - Field must have a value
- `min` - Minimum numeric value
- `max` - Maximum numeric value
- `min_length` - Minimum string length
- `max_length` - Maximum string length
- `regex` - Regular expression pattern matching
- `email` - Email format validation
- `phone` - Phone number format validation
- `url` - URL format validation
- `custom` - Custom validation logic

---

## Database Schema

### Tables

#### schema_snapshots
Stores immutable schema versions with cryptographic integrity.

```sql
CREATE TABLE schema_snapshots (
    snapshot_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    form_type VARCHAR(100) NOT NULL,
    semantic_version VARCHAR(20) NOT NULL,
    schema_hash CHAR(64) NOT NULL,
    schema_definition JSONB NOT NULL,
    parent_snapshot_id UUID,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    change_summary TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    metadata JSONB
);
```

#### field_definitions
Stores individual field configurations for each schema snapshot.

```sql
CREATE TABLE field_definitions (
    field_id UUID PRIMARY KEY,
    snapshot_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    field_type VARCHAR(50) NOT NULL,
    label VARCHAR(255) NOT NULL,
    description TEXT,
    placeholder VARCHAR(255),
    default_value TEXT,
    is_required BOOLEAN NOT NULL DEFAULT false,
    is_unique BOOLEAN NOT NULL DEFAULT false,
    is_encrypted BOOLEAN NOT NULL DEFAULT false,
    display_order INTEGER NOT NULL DEFAULT 0,
    validation_rules JSONB,
    field_options JSONB,
    permissions JSONB,
    metadata JSONB
);
```

#### validation_rules
Stores detailed validation rules for fields.

```sql
CREATE TABLE validation_rules (
    rule_id UUID PRIMARY KEY,
    field_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    rule_type VARCHAR(50) NOT NULL,
    rule_value TEXT,
    error_message VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB
);
```

---

## API Endpoints

### Create Schema Snapshot

```http
POST /api/v1/schemas
Authorization: Bearer <token>
Content-Type: application/json

{
  "formType": "student_enrollment",
  "fields": [
    {
      "field_name": "first_name",
      "field_type": "text",
      "label": "First Name",
      "is_required": true,
      "validation_rules": {
        "required": true,
        "min_length": 2,
        "max_length": 50
      }
    },
    {
      "field_name": "email",
      "field_type": "email",
      "label": "Email Address",
      "is_required": true,
      "validation_rules": {
        "required": true,
        "email": true
      }
    },
    {
      "field_name": "status",
      "field_type": "dropdown",
      "label": "Status",
      "is_required": true,
      "field_options": {
        "options": [
          { "value": "active", "label": "Active" },
          { "value": "inactive", "label": "Inactive" }
        ]
      }
    }
  ],
  "changeSummary": "Initial schema for student enrollment",
  "changeType": "minor"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "snapshot": {
      "snapshot_id": "uuid",
      "tenant_id": "uuid",
      "form_type": "student_enrollment",
      "semantic_version": "v1.0.0",
      "schema_hash": "sha256-hash",
      "status": "active",
      "created_at": "2026-02-05T10:00:00Z"
    },
    "fields": [...]
  }
}
```

### Get Schema Snapshot

```http
GET /api/v1/schemas/:snapshotId
Authorization: Bearer <token>
```

### Get Latest Schema

```http
GET /api/v1/schemas/latest/:formType
Authorization: Bearer <token>
```

### List Schema Snapshots

```http
GET /api/v1/schemas?page=1&limit=20&formType=student_enrollment&status=active
Authorization: Bearer <token>
```

### Get Schema Version History

```http
GET /api/v1/schemas/:snapshotId/history
Authorization: Bearer <token>
```

### Verify Schema Integrity

```http
GET /api/v1/schemas/:snapshotId/verify
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "is_valid": true,
    "stored_hash": "sha256-hash",
    "computed_hash": "sha256-hash"
  }
}
```

### Update Schema Status

```http
PATCH /api/v1/schemas/:snapshotId/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "archived"
}
```

### Export Schema

```http
POST /api/v1/schemas/:snapshotId/export
Authorization: Bearer <token>
Content-Type: application/json

{
  "format": "json"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "export_id": "uuid",
    "export_data": {
      "export_format": "eduos-schema-v1",
      "snapshot_id": "uuid",
      "form_type": "student_enrollment",
      "semantic_version": "v1.0.0",
      "schema_definition": {...},
      "fields": [...],
      "exported_at": "2026-02-05T10:00:00Z"
    }
  }
}
```

### Import Schema

```http
POST /api/v1/schemas/import
Authorization: Bearer <token>
Content-Type: application/json

{
  "importData": {
    "export_format": "eduos-schema-v1",
    "form_type": "student_enrollment",
    "fields": [...]
  },
  "importMode": "create_new",
  "conflictResolution": "skip"
}
```

### Get Supported Field Types

```http
GET /api/v1/schemas/field-types
Authorization: Bearer <token>
```

---

## Usage Examples

### Creating a Student Enrollment Schema

```javascript
const schemaService = require('./services/schemaService');

const result = await schemaService.createSchemaSnapshot({
  tenantId: 'tenant-uuid',
  formType: 'student_enrollment',
  fields: [
    {
      field_name: 'first_name',
      field_type: 'text',
      label: 'First Name',
      is_required: true,
      display_order: 1,
      validation_rules: {
        required: true,
        min_length: 2,
        max_length: 50
      }
    },
    {
      field_name: 'date_of_birth',
      field_type: 'date',
      label: 'Date of Birth',
      is_required: true,
      display_order: 2,
      validation_rules: {
        required: true
      }
    },
    {
      field_name: 'grade_level',
      field_type: 'dropdown',
      label: 'Grade Level',
      is_required: true,
      display_order: 3,
      field_options: {
        options: [
          { value: '1', label: 'Grade 1' },
          { value: '2', label: 'Grade 2' },
          { value: '3', label: 'Grade 3' }
        ]
      }
    }
  ],
  createdBy: 'user-uuid',
  changeSummary: 'Initial student enrollment schema'
});

console.log('Schema created:', result.snapshot.semantic_version);
```

### Retrieving Latest Schema

```javascript
const latestSchema = await schemaService.getLatestSchema(
  'tenant-uuid',
  'student_enrollment'
);

console.log('Latest version:', latestSchema.semantic_version);
console.log('Fields:', latestSchema.fields.length);
```

### Verifying Schema Integrity

```javascript
const integrity = await schemaService.verifySchemaIntegrity(
  'snapshot-uuid',
  'tenant-uuid'
);

if (integrity.is_valid) {
  console.log('Schema integrity verified ✓');
} else {
  console.error('Schema integrity check failed!');
  console.error('Stored hash:', integrity.stored_hash);
  console.error('Computed hash:', integrity.computed_hash);
}
```

### Exporting and Importing Schemas

```javascript
// Export
const exportResult = await schemaService.exportSchema(
  'snapshot-uuid',
  'tenant-uuid',
  'user-uuid'
);

// Save to file or send to another system
const exportData = exportResult.export_data;

// Import
const importResult = await schemaService.importSchema(
  'target-tenant-uuid',
  exportData,
  'user-uuid',
  {
    importMode: 'create_new',
    conflictResolution: 'skip'
  }
);

console.log('Import status:', importResult.status);
console.log('New snapshot ID:', importResult.snapshot_id);
```

---

## Semantic Versioning

The system uses semantic versioning (SemVer) for schema versions:

- **Major (v2.0.0)** - Breaking changes (field removal, type change)
- **Minor (v1.1.0)** - Backward-compatible additions (new optional field)
- **Patch (v1.0.1)** - Non-functional changes (label updates, help text)

### Version Increment Examples

```javascript
// Increment major version (breaking change)
const newVersion = schemaService.incrementSemVer('v1.2.3', 'major');
// Result: v2.0.0

// Increment minor version (new feature)
const newVersion = schemaService.incrementSemVer('v1.2.3', 'minor');
// Result: v1.3.0

// Increment patch version (bug fix)
const newVersion = schemaService.incrementSemVer('v1.2.3', 'patch');
// Result: v1.2.4
```

---

## Security Features

### Cryptographic Integrity

All schema snapshots are protected with SHA-256 hashing:

1. Schema definition is serialized to canonical JSON
2. SHA-256 hash is computed and stored
3. On retrieval, hash is recomputed and verified
4. Tampering is detected if hashes don't match

### Row-Level Security (RLS)

All schema tables enforce tenant isolation:

```sql
CREATE POLICY schema_snapshots_tenant_isolation ON schema_snapshots
    FOR ALL
    USING (tenant_id = current_tenant_id());
```

### Immutability

Schema snapshots are immutable once created:
- No updates or deletes allowed
- Changes create new versions
- Full audit trail maintained

---

## Best Practices

### 1. Schema Design

- Keep field names consistent across versions
- Use descriptive labels and help text
- Group related fields logically
- Set appropriate display_order values

### 2. Validation Rules

- Always validate required fields
- Set reasonable min/max constraints
- Use regex for complex patterns
- Provide clear error messages

### 3. Versioning Strategy

- Use major versions for breaking changes
- Use minor versions for new features
- Use patch versions for cosmetic changes
- Document changes in change_summary

### 4. Field Options

For dropdown, radio, and checkbox fields:

```javascript
{
  field_type: 'dropdown',
  field_options: {
    options: [
      { value: 'option1', label: 'Option 1' },
      { value: 'option2', label: 'Option 2' }
    ],
    allow_multiple: false,
    allow_custom: false
  }
}
```

### 5. Permissions

Define field-level permissions:

```javascript
{
  permissions: {
    visible_to_roles: ['admin', 'teacher', 'student'],
    editable_by_roles: ['admin', 'teacher']
  }
}
```

---

## Testing

The schema service includes comprehensive unit tests covering:

- Field type validation
- Validation rule types
- SHA-256 hash computation
- Semantic versioning
- Schema creation and retrieval
- Integrity verification
- Export/import functionality
- Status updates

Run tests:

```bash
npm test -- schemaService.test.js
```

---

## Migration

The schema system is deployed via migration 009:

```bash
node database/run_migration_009.js
```

Rollback if needed:

```bash
psql -U postgres -d eduos_dev -f database/migrations/009_schema_snapshots_rollback.sql
```

---

## Related Documentation

- [Requirements](../.kiro/specs/eduos-platform/requirements.md) - Module A, Requirement 1
- [Design Document](../.kiro/specs/eduos-platform/design.md) - Section 2.1
- [Tasks](../.kiro/specs/eduos-platform/tasks.md) - Task 2.2.1

---

## Support

For issues or questions about the schema system:

1. Check the test suite for usage examples
2. Review the API documentation above
3. Consult the design document for architecture details
4. Contact the development team

---

**Last Updated:** 2026-02-05  
**Maintained By:** EduOS Development Team
