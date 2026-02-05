# RBAC Quick Reference Guide

## Role Hierarchy

```
SuperAdmin (Level 0) - Full system access
    ↓
InstituteAdmin (Level 1) - Institution management
    ↓
CenterAdmin (Level 2) - Center operations
    ↓
Teacher (Level 3) - Class management
    ↓
Student (Level 4) - View own data
```

## Common Permission Checks

### Check if user has permission
```javascript
const hasPermission = await rbacService.userHasPermission(
  userId,
  tenantId,
  'student:write'
);
```

### Get all user permissions
```javascript
const permissions = await rbacService.getUserPermissions(userId, tenantId);
```

### Get field permissions
```javascript
const fieldPerms = await rbacService.getUserFieldPermissions(
  userId,
  tenantId,
  'student'
);
```

## API Endpoints

### Get user permissions
```http
GET /auth/permissions
Authorization: Bearer <token>
```

### Get field permissions
```http
GET /auth/permissions/fields/student
Authorization: Bearer <token>
```

## Default Permissions by Role

### SuperAdmin
- All permissions

### InstituteAdmin
- student:read, student:write
- enrollment:read, enrollment:write
- attendance:read, attendance:write, attendance:approve
- payment:read, payment:write
- user:read, user:write
- role:read, role:assign
- report:read, report:export
- audit:read

### CenterAdmin
- student:read, student:write
- enrollment:read, enrollment:write
- attendance:read, attendance:write
- payment:read
- user:read
- report:read, report:export

### Teacher
- student:read
- enrollment:read
- attendance:read, attendance:write
- report:read

### Student
- student:read
- enrollment:read
- attendance:read

## Permission Format

Format: `resource:action`

Examples:
- `student:read`
- `student:write`
- `attendance:write`
- `payment:refund`

## Role Management

### Assign role to user
```javascript
await rbacService.assignRoleToUser(userId, roleId, tenantId, adminUserId);
```

### Remove role from user
```javascript
await rbacService.removeRoleFromUser(userId, roleId, tenantId, adminUserId);
```

### Create default roles for tenant
```javascript
await rbacService.createDefaultRoles(tenantId);
```

## Field-Level Permissions

### Set field permission
```javascript
await rbacService.setFieldPermission(
  roleId,
  tenantId,
  'email',        // field name
  'student',      // resource type
  true,           // can read
  false           // can write
);
```

## Security Best Practices

1. ✅ Always check permissions server-side
2. ✅ Use `userHasPermission()` before operations
3. ✅ Include tenant_id in all queries
4. ✅ Log role assignments to audit_logs
5. ❌ Never rely on client-side permission checks

## Common Patterns

### Protect API endpoint
```javascript
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
```

### Check multiple permissions
```javascript
const permissions = await rbacService.getUserPermissions(userId, tenantId);
const permissionNames = permissions.map(p => p.permissionName);

if (permissionNames.includes('student:write') && 
    permissionNames.includes('enrollment:write')) {
  // User has both permissions
}
```

### Filter fields based on permissions
```javascript
const fieldPerms = await rbacService.getUserFieldPermissions(
  userId,
  tenantId,
  'student'
);

const readableFields = fieldPerms
  .filter(fp => fp.canRead)
  .map(fp => fp.fieldName);

const writableFields = fieldPerms
  .filter(fp => fp.canWrite)
  .map(fp => fp.fieldName);
```

## Database Functions

### get_user_permissions(user_id, tenant_id)
Returns all permissions including inherited ones.

### user_has_permission(user_id, tenant_id, permission_name)
Fast boolean check for a specific permission.

### get_user_field_permissions(user_id, tenant_id, resource_type)
Returns field-level permissions for a resource.

### create_default_roles(tenant_id)
Creates the default role hierarchy for a tenant.

## Troubleshooting

### User has no permissions
1. Check if user has any roles assigned
2. Verify role has permissions assigned
3. Check tenant_id matches

### Permission check fails
1. Verify permission name format (resource:action)
2. Check if permission exists in permissions table
3. Verify user's role has the permission

### Field permissions not working
1. Check if field_permissions are set for the role
2. Verify resource_type matches
3. Check role hierarchy (parent roles override)

## Migration

Apply migration:
```bash
node database/migrate.js 006_rbac_hierarchy.sql
```

Rollback:
```bash
node database/migrate.js 006_rbac_hierarchy_rollback.sql
```

## Testing

Run RBAC tests:
```bash
npm test -- --testPathPattern=rbacService.test.js
```

Run integration tests:
```bash
npm test -- --testPathPattern=auth.test.js
```
