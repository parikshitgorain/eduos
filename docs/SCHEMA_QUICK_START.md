# Schema System Quick Start Guide

**Quick reference for developers working with the EduOS Schema System**

---

## 5-Minute Quick Start

### 1. Create Your First Schema

```javascript
const schemaService = require('./services/schemaService');

// Define your form fields
const fields = [
  {
    field_name: 'first_name',
    field_type: 'text',
    label: 'First Name',
    is_required: true,
    validation_rules: {
      required: true,
      min_length: 2,
      max_length: 50
    }
  },
  {
    field_name: 'email',
    field_type: 'email',
    label: 'Email Address',
    is_required: true,
    validation_rules: {
      required: true,
      email: true
    }
  }
];

// Create the schema
const result = await schemaService.createSchemaSnapshot({
  tenantId: req.user.tenant_id,
  formType: 'student_enrollment',
  fields: fields,
  createdBy: req.user.user_id,
  changeSummary: 'Initial schema'
});

console.log('Created schema version:', result.snapshot.semantic_version);
```

### 2. Retrieve Latest Schema

```javascript
const schema = await schemaService.getLatestSchema(
  tenantId,
  'student_enrollment'
);

// Use the schema to render your form
schema.fields.forEach(field => {
  console.log(`${field.label}: ${field.field_type}`);
});
```

### 3. Verify Integrity

```javascript
const integrity = await schemaService.verifySchemaIntegrity(
  snapshotId,
  tenantId
);

if (!integrity.is_valid) {
  console.error('Schema has been tampered with!');
}
```

---

## Field Types Cheat Sheet

| Type | Use Case | Required Options |
|------|----------|------------------|
| `text` | Short text input | None |
| `textarea` | Long text input | None |
| `number` | Numeric values | None |
| `date` | Date selection | None |
| `email` | Email addresses | None |
| `phone` | Phone numbers | None |
| `dropdown` | Single selection | `field_options.options` |
| `radio` | Single choice | `field_options.options` |
| `checkbox` | Multiple choices | `field_options.options` |
| `file_upload` | File uploads | None |

---

## Validation Rules Cheat Sheet

| Rule | Description | Example |
|------|-------------|---------|
| `required` | Field must have value | `{ required: true }` |
| `min` | Minimum number | `{ min: 0 }` |
| `max` | Maximum number | `{ max: 100 }` |
| `min_length` | Min string length | `{ min_length: 2 }` |
| `max_length` | Max string length | `{ max_length: 50 }` |
| `regex` | Pattern match | `{ regex: '^[A-Z]' }` |
| `email` | Email format | `{ email: true }` |
| `phone` | Phone format | `{ phone: true }` |
| `url` | URL format | `{ url: true }` |
| `custom` | Custom logic | `{ custom: 'function' }` |

---

## Common Patterns

### Dropdown Field

```javascript
{
  field_name: 'status',
  field_type: 'dropdown',
  label: 'Status',
  is_required: true,
  field_options: {
    options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'graduated', label: 'Graduated' }
    ]
  }
}
```

### Required Text Field with Length Limits

```javascript
{
  field_name: 'description',
  field_type: 'textarea',
  label: 'Description',
  is_required: true,
  validation_rules: {
    required: true,
    min_length: 10,
    max_length: 500
  }
}
```

### Optional Number Field with Range

```javascript
{
  field_name: 'age',
  field_type: 'number',
  label: 'Age',
  is_required: false,
  validation_rules: {
    min: 5,
    max: 100
  }
}
```

### Email Field with Validation

```javascript
{
  field_name: 'email',
  field_type: 'email',
  label: 'Email Address',
  is_required: true,
  validation_rules: {
    required: true,
    email: true
  }
}
```

---

## API Quick Reference

### Create Schema
```http
POST /api/v1/schemas
Body: { formType, fields, changeSummary }
```

### Get Latest
```http
GET /api/v1/schemas/latest/:formType
```

### List Schemas
```http
GET /api/v1/schemas?page=1&limit=20&formType=...
```

### Verify Integrity
```http
GET /api/v1/schemas/:snapshotId/verify
```

### Export
```http
POST /api/v1/schemas/:snapshotId/export
```

### Import
```http
POST /api/v1/schemas/import
Body: { importData, importMode, conflictResolution }
```

---

## Versioning Quick Guide

### When to Increment

- **Major (v2.0.0)** - Breaking changes
  - Remove a field
  - Change field type
  - Make optional field required

- **Minor (v1.1.0)** - New features
  - Add new optional field
  - Add new validation rule
  - Expand dropdown options

- **Patch (v1.0.1)** - Cosmetic changes
  - Update field label
  - Change help text
  - Reorder fields

### Example

```javascript
// Create new version
const newSchema = await schemaService.createSchemaSnapshot({
  tenantId,
  formType: 'student_enrollment',
  fields: updatedFields,
  createdBy: userId,
  changeSummary: 'Added emergency contact field',
  parentSnapshotId: currentSnapshotId,
  changeType: 'minor' // Will increment to v1.1.0
});
```

---

## Error Handling

```javascript
try {
  const schema = await schemaService.createSchemaSnapshot({...});
} catch (error) {
  if (error.message.includes('field_type must be one of')) {
    // Invalid field type
  } else if (error.message.includes('is required')) {
    // Missing required field
  } else {
    // Other error
  }
}
```

---

## Testing Your Schema

```javascript
const schemaService = require('./services/schemaService');

describe('My Schema', () => {
  test('should create schema successfully', async () => {
    const result = await schemaService.createSchemaSnapshot({
      tenantId: 'test-tenant',
      formType: 'my_form',
      fields: [...],
      createdBy: 'test-user'
    });
    
    expect(result.snapshot).toBeDefined();
    expect(result.snapshot.semantic_version).toBe('v1.0.0');
  });
});
```

---

## Common Mistakes to Avoid

❌ **Don't** modify existing snapshots
```javascript
// WRONG - snapshots are immutable
await query('UPDATE schema_snapshots SET ...');
```

✅ **Do** create new versions
```javascript
// CORRECT
await schemaService.createSchemaSnapshot({
  parentSnapshotId: oldSnapshotId,
  ...
});
```

❌ **Don't** forget field options for dropdowns
```javascript
// WRONG - will throw error
{ field_type: 'dropdown', label: 'Status' }
```

✅ **Do** include options
```javascript
// CORRECT
{
  field_type: 'dropdown',
  label: 'Status',
  field_options: {
    options: [...]
  }
}
```

---

## Need More Help?

- 📖 Full Documentation: `docs/SCHEMA_SYSTEM.md`
- 🧪 Test Examples: `src/services/schemaService.test.js`
- 🎯 Task Details: `.kiro/specs/eduos-platform/tasks.md` (Task 2.2.1)
- 📋 Implementation Summary: `docs/tasks/TASK_2.2.1_IMPLEMENTATION_SUMMARY.md`

---

**Last Updated:** 2026-02-05
