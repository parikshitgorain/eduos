# Hierarchical Role-Based Access Control (RBAC) System

## Overview

The EduOS Platform implements a comprehensive hierarchical RBAC system with permission inheritance. The system supports:

- **Role Hierarchy**: SuperAdmin → InstituteAdmin → CenterAdmin → Teacher → Student
- **Permission Inheritance**: Child roles inherit permissions from parent roles
- **Field-Level Permissions**: Granular read/write permissions per field
- **Multi-Tenant Isolation**: Roles and permissions are scoped to tenants

## Role Hierarchy

The system implements a 5-level role hierarchy:

```
Level 0: SuperAdmin
    ↓
Level 1: InstituteAdmin
    ↓
Level 2: CenterAdmin
    ↓
Level 3: Teacher
    ↓
Level 4: Student
```

### Role Descriptions

| Role | Level | Description | Key Permissions |
|------|-------|-------------|-----------------|
| **SuperAdmin** | 0 | Full system access | All permissions |
| **InstituteAdmin** | 1 | Manage institution-level settings | Student, enrollment, attendance, payment, user management |
| **CenterAdmin** | 2 | Manage center-level operations | Student, enrollment, attendance, reports |
| **Teacher** | 3 | Manage classes and attendance | Student read, attendance write, reports |
| **Student** | 4 | View own academic information | Student read, enrollment read, attendance read |

## Permission System

### Permission Format

Permissions follow the format: `resource:action`

Examples:
- `student:read` - View student information
- `student:write` - Create and update student information
- `attendance:write` - Mark attendance
- `payment:refund` - Process refunds

### Default Permissions

The system includes the following default permissions:

#### Student Permissions
- `student:read` - View student information
- `student:write` - Create and update student information
- `student:delete` - Delete student records

#### Enrollment Permissions
- `enrollment:read` - View enrollment information
- `enrollment:write` - Create and update enrollments
- `enrollment:delete` - Delete enrollments

#### Attendance Permissions
- `attendance:read` - View attendance records
- `attendance:write` - Mark attendance
- `attendance:approve` - Approve attendance records

#### Payment Permissions
- `payment:read` - View payment information
- `payment:write` - Process payments
- `payment:refund` - Process refunds

#### User Management Permissions
- `user:read` - View user information
- `user:write` - Create and update users
- `user:delete` - Delete users

#### Role Management Permissions
- `role:read` - View roles
- `role:write` - Create and update roles
- `role:assign` - Assign roles to users

#### Tenant Management Permissions
- `tenant:read` - View tenant information
- `tenant:write` - Update tenant settings
- `tenant:delete` - Delete tenants

#### Report Permissions
- `report:read` - View reports
- `report:export` - Export reports

#### Audit Permissions
- `audit:read` - View audit logs

## Permission Inheritance

Child roles automatically inherit permissions from their parent roles. This creates a cascading permission model:

```
SuperAdmin (All Permissions)
    ↓ inherits all
InstituteAdmin (Subset of permissions)
    ↓ inherits all
CenterAdmin (Subset of permissions)
    ↓ inherits all
Teacher (Subset of permissions)
    ↓ inherits all
Student (Minimal permissions)
```

### Example

If a user has the **Teacher** role:
- They get all permissions assigned to the Teacher role
- They also inherit all permissions from CenterAdmin
- They also inherit all permissions from InstituteAdmin
- They also inherit all permissions from SuperAdmin

## Field-Level Permissions

In addition to resource-level permissions, the system supports field-level permissions for fine-grained access control.

### Field Permission Structure

```javascript
{
  fieldName: 'email',
  resourceType: 'student',
  canRead: true,
  canWrite: false
}
```

### Use Cases

- **Sensitive Fields**: Restrict access to medical records, national IDs
- **Read-Only Fields**: Allow viewing but not editing of certain fields
- **Role-Specific Access**: Different roles see different fields

## API Endpoints

### Get User Permissions

```http
GET /auth/permissions
Authorization: Bearer <access-token>
```

**Response:**
```json
{
  "user_id": "uuid",
  "tenant_id": "uuid",
  "roles": [
    {
      "roleId": "uuid",
      "roleName": "teacher",
      "displayName": "Teacher",
      "description": "Manage classes and student attendance",
      "hierarchyLevel": 3,
      "parentRoleId": "uuid"
    }
  ],
  "permissions": [
    {
      "permissionName": "student:read",
      "resourceType": "student",
      "action": "read",
      "roleName": "teacher",
      "hierarchyLevel": 3
    }
  ],
  "hierarchy": {
    "description": "SuperAdmin → InstituteAdmin → CenterAdmin → Teacher → Student",
    "levels": {
      "0": "SuperAdmin",
      "1": "InstituteAdmin",
      "2": "CenterAdmin",
      "3": "Teacher",
      "4": "Student"
    }
  }
}
```

### Get Field-Level Permissions

```http
GET /auth/permissions/fields/:resourceType
Authorization: Bearer <access-token>
```

**Example:**
```http
GET /auth/permissions/fields/student
```

**Response:**
```json
{
  "user_id": "uuid",
  "tenant_id": "uuid",
  "resource_type": "student",
  "field_permissions": [
    {
      "fieldName": "first_name",
      "canRead": true,
      "canWrite": true
    },
    {
      "fieldName": "email",
      "canRead": true,
      "canWrite": false
    }
  ]
}
```

## Database Schema

### Tables

#### `permissions`
Stores individual permissions that can be assigned to roles.

```sql
CREATE TABLE permissions (
  permission_id UUID PRIMARY KEY,
  permission_name VARCHAR(100) NOT NULL UNIQUE,
  resource_type VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `role_permissions`
Junction table linking roles to permissions.

```sql
CREATE TABLE role_permissions (
  role_permission_id UUID PRIMARY KEY,
  role_id UUID NOT NULL REFERENCES roles(role_id),
  permission_id UUID NOT NULL REFERENCES permissions(permission_id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by UUID REFERENCES users(user_id)
);
```

#### `user_roles`
Junction table linking users to roles.

```sql
CREATE TABLE user_roles (
  user_role_id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(user_id),
  role_id UUID NOT NULL REFERENCES roles(role_id),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID REFERENCES users(user_id)
);
```

#### `field_permissions`
Stores field-level permissions for dynamic forms.

```sql
CREATE TABLE field_permissions (
  field_permission_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  role_id UUID NOT NULL REFERENCES roles(role_id),
  field_name VARCHAR(255) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  can_read BOOLEAN DEFAULT FALSE,
  can_write BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Functions

#### `get_user_permissions(user_id, tenant_id)`
Returns all permissions for a user including inherited permissions from parent roles.

#### `user_has_permission(user_id, tenant_id, permission_name)`
Checks if a user has a specific permission.

#### `get_user_field_permissions(user_id, tenant_id, resource_type)`
Returns field-level permissions for a user on a specific resource type.

#### `create_default_roles(tenant_id)`
Creates the default role hierarchy for a tenant.

## Usage Examples

### Check if User Has Permission

```javascript
const rbacService = require('./services/rbacService');

const hasPermission = await rbacService.userHasPermission(
  userId,
  tenantId,
  'student:write'
);

if (hasPermission) {
  // Allow operation
} else {
  // Deny operation
}
```

### Get All User Permissions

```javascript
const permissions = await rbacService.getUserPermissions(userId, tenantId);

console.log(permissions);
// [
//   {
//     permissionName: 'student:read',
//     resourceType: 'student',
//     action: 'read',
//     roleName: 'teacher',
//     hierarchyLevel: 3
//   },
//   ...
// ]
```

### Assign Role to User

```javascript
await rbacService.assignRoleToUser(
  userId,
  roleId,
  tenantId,
  adminUserId
);
```

### Set Field-Level Permission

```javascript
await rbacService.setFieldPermission(
  roleId,
  tenantId,
  'email',
  'student',
  true,  // canRead
  false  // canWrite
);
```

### Create Default Roles for New Tenant

```javascript
await rbacService.createDefaultRoles(tenantId);
```

## Security Considerations

### Row-Level Security (RLS)

All RBAC tables have Row-Level Security enabled to ensure tenant isolation:

```sql
CREATE POLICY tenant_isolation_user_roles ON user_roles
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
```

### Audit Logging

All role assignments and removals are logged to the `audit_logs` table:

```javascript
await query(
  `INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, resource_id, details)
   VALUES ($1, $2, $3, $4, $5, $6)`,
  [tenantId, adminUserId, 'role_assigned', 'user_role', userRoleId, details]
);
```

### Permission Checks

Always check permissions on the server side, never rely on client-side checks:

```javascript
// ✅ Good: Server-side check
app.post('/api/students', async (req, res) => {
  const hasPermission = await rbacService.userHasPermission(
    req.user.id,
    req.user.tenantId,
    'student:write'
  );
  
  if (!hasPermission) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  // Process request
});

// ❌ Bad: Client-side only check
if (user.permissions.includes('student:write')) {
  // This can be bypassed
}
```

## Testing

### Unit Tests

```bash
npm test -- --testPathPattern=rbacService.test.js
```

### Integration Tests

```bash
npm test -- --testPathPattern=auth.test.js
```

## Migration

To apply the RBAC migration:

```bash
node database/migrate.js 006_rbac_hierarchy.sql
```

To rollback:

```bash
node database/migrate.js 006_rbac_hierarchy_rollback.sql
```

## Next Steps

1. **Task 1.3.3**: Build session management with Redis
2. **Task 1.3.4**: Implement multi-factor authentication (MFA)
3. **Task 2.2.3**: Integrate field-level permissions with dynamic forms

## References

- [NIST RBAC Model](https://csrc.nist.gov/projects/role-based-access-control)
- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749)
- [PostgreSQL Row-Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
