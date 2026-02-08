# Academic Rule Configuration Engine

## Overview

The Academic Rule Configuration Engine allows administrators to define and manage automated academic policy rules. Rules are evaluated in real-time when relevant data changes (attendance, grades, etc.) and can trigger automated actions or require manual approval.

## Features

- **Rule Types**: Attendance thresholds, grade eligibility, grace marks
- **Flexible Conditions**: Support for multiple operators (>=, <=, >, <, ==, !=, in, not_in)
- **Multiple Actions**: Set eligibility, apply grace marks, send notifications, block enrollment
- **Conflict Detection**: Automatically detects and prevents conflicting rules
- **Priority System**: Higher priority rules are evaluated first
- **Date-Based Activation**: Rules can be scheduled to activate/deactivate automatically
- **Visual Rule Builder**: User-friendly UI for creating and editing rules

## API Endpoints

### Create Rule
```http
POST /api/v1/policies/rules
Content-Type: application/json

{
  "name": "Minimum 75% Attendance",
  "type": "attendance_threshold",
  "conditions": [
    {
      "field": "attendance_percentage",
      "operator": "<",
      "value": 75
    }
  ],
  "actions": [
    {
      "type": "set_eligibility",
      "eligible": false,
      "reason": "Attendance below 75% threshold"
    }
  ],
  "priority": 100,
  "effective_from": "2026-01-01T00:00:00Z"
}
```

### List Rules
```http
GET /api/v1/policies/rules?type=attendance_threshold&active_only=true
```

### Get Rule by ID
```http
GET /api/v1/policies/rules/{ruleId}
```

### Update Rule
```http
PUT /api/v1/policies/rules/{ruleId}
Content-Type: application/json

{
  "name": "Updated Rule Name",
  "priority": 150
}
```

### Deactivate Rule
```http
POST /api/v1/policies/rules/{ruleId}/deactivate
```

### Delete Rule
```http
DELETE /api/v1/policies/rules/{ruleId}
```

### Validate Rule
```http
POST /api/v1/policies/rules/validate
Content-Type: application/json

{
  "name": "Test Rule",
  "type": "attendance_threshold",
  "conditions": [...],
  "actions": [...]
}
```

### Get Metadata
```http
GET /api/v1/policies/metadata/types
```

Returns available rule types, action types, and operators.

## Rule Types

### 1. Attendance Threshold
Enforces minimum attendance requirements for exam eligibility or other purposes.

**Example:**
```json
{
  "name": "Minimum 75% Attendance for Exams",
  "type": "attendance_threshold",
  "conditions": [
    {
      "field": "attendance_percentage",
      "operator": "<",
      "value": 75
    }
  ],
  "actions": [
    {
      "type": "set_eligibility",
      "eligible": false,
      "reason": "Attendance below 75%"
    }
  ]
}
```

### 2. Grade Eligibility
Determines eligibility based on academic performance.

**Example:**
```json
{
  "name": "Minimum GPA for Honors",
  "type": "grade_eligibility",
  "conditions": [
    {
      "field": "grade_average",
      "operator": ">=",
      "value": 3.5
    }
  ],
  "actions": [
    {
      "type": "set_eligibility",
      "eligible": true,
      "reason": "Qualifies for honors program"
    }
  ]
}
```

### 3. Grace Marks
Automatically applies grace marks based on defined criteria.

**Example:**
```json
{
  "name": "Grace Marks for Near Pass",
  "type": "grace_marks",
  "conditions": [
    {
      "field": "score",
      "operator": ">=",
      "value": 35
    },
    {
      "field": "score",
      "operator": "<",
      "value": 40
    }
  ],
  "actions": [
    {
      "type": "apply_grace_marks",
      "marks": 5,
      "max_marks": 5
    }
  ]
}
```

## Operators

- `>=` - Greater than or equal to
- `<=` - Less than or equal to
- `>` - Greater than
- `<` - Less than
- `==` - Equal to
- `!=` - Not equal to
- `in` - Value is in a list
- `not_in` - Value is not in a list

## Action Types

### 1. Set Eligibility
Sets a student's eligibility status for exams, programs, or other activities.

**Parameters:**
- `eligible` (boolean): Whether the student is eligible
- `reason` (string, optional): Reason for the eligibility decision

### 2. Apply Grace Marks
Automatically adds grace marks to a student's score.

**Parameters:**
- `marks` (number): Number of grace marks to apply
- `max_marks` (number, optional): Maximum grace marks allowed

### 3. Send Notification
Sends a notification to the student or relevant stakeholders.

**Parameters:**
- `message` (string): Notification message content

### 4. Block Enrollment
Prevents a student from enrolling in courses or programs.

**Parameters:**
- `reason` (string): Reason for blocking enrollment

## Conflict Detection

The system automatically detects and prevents conflicting rules:

1. **Exact Duplicates**: Rules with identical conditions on the same field
2. **Overlapping Ranges**: Rules with overlapping conditions (e.g., >= 75 and >= 80)
3. **Ambiguous Conditions**: Rules that could create ambiguity in evaluation

When a conflict is detected, the system will reject the new rule and provide details about the conflicting rule.

## Priority System

Rules are evaluated in order of priority (highest first). Default priority is 100.

- Higher priority: 200, 150, 100
- Lower priority: 50, 25, 10

Use priority to control the order of rule evaluation when multiple rules apply to the same scenario.

## Date-Based Activation

Rules can be scheduled to activate and deactivate automatically:

- `effective_from`: Rule becomes active from this date
- `effective_until`: Rule expires after this date (optional)

If `effective_until` is not specified, the rule remains active indefinitely.

## Database Schema

### academic_rules
Stores rule definitions.

```sql
CREATE TABLE academic_rules (
    rule_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    rule_name VARCHAR(255) NOT NULL,
    rule_type VARCHAR(50) NOT NULL,
    conditions JSONB NOT NULL,
    actions JSONB NOT NULL,
    priority INTEGER DEFAULT 100,
    effective_from TIMESTAMP NOT NULL DEFAULT NOW(),
    effective_until TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_by UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### rule_evaluations
Audit log of rule evaluations.

```sql
CREATE TABLE rule_evaluations (
    evaluation_id UUID PRIMARY KEY,
    rule_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    student_id UUID,
    context JSONB NOT NULL,
    condition_met BOOLEAN NOT NULL,
    action_executed BOOLEAN NOT NULL DEFAULT FALSE,
    action_result JSONB,
    evaluated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### rule_overrides
Manual overrides of rule decisions.

```sql
CREATE TABLE rule_overrides (
    override_id UUID PRIMARY KEY,
    rule_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    student_id UUID NOT NULL,
    reason TEXT NOT NULL,
    requested_by UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending_approval',
    approved_by UUID,
    approval_reason TEXT,
    approved_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## Usage Examples

### Example 1: Attendance Rule
```javascript
const attendanceRule = {
  name: 'Minimum 75% Attendance',
  type: 'attendance_threshold',
  conditions: [
    { field: 'attendance_percentage', operator: '<', value: 75 }
  ],
  actions: [
    { type: 'set_eligibility', eligible: false, reason: 'Low attendance' },
    { type: 'send_notification', message: 'Your attendance is below 75%. Please improve.' }
  ],
  priority: 100
};

const response = await fetch('/api/v1/policies/rules', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(attendanceRule)
});
```

### Example 2: Grace Marks Rule
```javascript
const graceMarksRule = {
  name: 'Grace Marks for Near Pass',
  type: 'grace_marks',
  conditions: [
    { field: 'score', operator: '>=', value: 35 },
    { field: 'score', operator: '<', value: 40 }
  ],
  actions: [
    { type: 'apply_grace_marks', marks: 5, max_marks: 5 }
  ],
  priority: 50
};
```

### Example 3: Multiple Conditions
```javascript
const complexRule = {
  name: 'Honors Eligibility',
  type: 'grade_eligibility',
  conditions: [
    { field: 'grade_average', operator: '>=', value: 3.5 },
    { field: 'attendance_percentage', operator: '>=', value: 90 },
    { field: 'credits_earned', operator: '>=', value: 120 }
  ],
  actions: [
    { type: 'set_eligibility', eligible: true, reason: 'Qualifies for honors' },
    { type: 'send_notification', message: 'Congratulations! You qualify for the honors program.' }
  ],
  priority: 150
};
```

## Best Practices

1. **Use Descriptive Names**: Give rules clear, descriptive names that explain their purpose
2. **Set Appropriate Priorities**: Use priority to control evaluation order
3. **Test Before Deploying**: Use the validate endpoint to check for conflicts
4. **Document Reasons**: Always provide clear reasons for actions
5. **Use Date Ranges**: Set effective dates to automatically activate/deactivate rules
6. **Monitor Evaluations**: Review the rule_evaluations table to understand rule impact
7. **Handle Overrides**: Implement approval workflows for manual overrides

## Security Considerations

- All rules are tenant-isolated using Row-Level Security (RLS)
- Only authorized users can create, update, or delete rules
- Rule evaluations are logged for audit purposes
- Manual overrides require approval workflows

## Future Enhancements

- Real-time rule evaluation engine
- Rule testing with sample data
- Rule analytics and impact reports
- Bulk rule operations
- Rule templates and presets
- Advanced condition logic (AND/OR groups)
- Integration with notification system
- Retroactive rule application with approval
