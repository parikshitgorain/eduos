# EduOS Platform - Complete API Reference

**Version:** 1.0  
**Last Updated:** 2026-02-08  
**OpenAPI Specification:** 3.0.3

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Base URLs](#base-urls)
4. [Common Headers](#common-headers)
5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)
7. [API Endpoints](#api-endpoints)
   - [Authentication & Authorization](#authentication--authorization)
   - [Tenant Management](#tenant-management)
   - [User Management](#user-management)
   - [Hierarchy Management](#hierarchy-management)
   - [Schema Management](#schema-management)
   - [Student Management](#student-management)
   - [Enrollment Management](#enrollment-management)
   - [Attendance Management](#attendance-management)
   - [Payment Management](#payment-management)
   - [Audit & Compliance](#audit--compliance)
   - [AI Services](#ai-services)
8. [Webhooks](#webhooks)
9. [OpenAPI Specification](#openapi-specification)

---

## Overview

The EduOS Platform API is a RESTful API that provides comprehensive access to all platform features. All API endpoints use JSON for request and response bodies.

### Key Features

- **Multi-Tenant Isolation**: All data is automatically scoped to the authenticated tenant
- **Role-Based Access Control**: Fine-grained permissions at the endpoint and field level
- **Idempotency**: Critical operations support idempotency keys
- **Versioning**: API versioning via URL path (`/api/v1/`)
- **Rate Limiting**: Automatic rate limiting to prevent abuse
- **Audit Logging**: All operations are automatically logged

---

## Authentication

### OAuth 2.0 / OIDC

The platform supports OAuth 2.0 Authorization Code Flow with PKCE and OpenID Connect.

#### Authorization Endpoint

```
GET /api/v1/auth/authorize
```

**Parameters:**
- `client_id` (required): Your application's client ID
- `redirect_uri` (required): Callback URL
- `response_type` (required): `code`
- `scope` (required): Space-separated scopes (e.g., `openid profile email`)
- `state` (required): CSRF protection token
- `code_challenge` (required): PKCE code challenge
- `code_challenge_method` (required): `S256`

#### Token Endpoint

```
POST /api/v1/auth/token
```

**Request Body:**
```json
{
  "grant_type": "authorization_code",
  "code": "AUTH_CODE",
  "redirect_uri": "https://your-app.com/callback",
  "client_id": "your_client_id",
  "code_verifier": "PKCE_VERIFIER"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "id_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "scope": "openid profile email"
}
```

### JWT Bearer Token

All API requests must include a valid JWT token in the Authorization header:

```
Authorization: Bearer <access_token>
```

---

## Base URLs

| Environment | Base URL |
|-------------|----------|
| Production | `https://api.eduos.com` |
| Staging | `https://api-staging.eduos.com` |
| Development | `http://localhost:3000` |

---

## Common Headers

### Required Headers

```
Authorization: Bearer <access_token>
Content-Type: application/json
X-Tenant-ID: <tenant_uuid>
```

### Optional Headers

```
X-Idempotency-Key: <unique_key>        # For idempotent operations
Accept-Timezone: Asia/Kolkata           # For timezone-aware responses
X-Request-ID: <uuid>                    # For request tracing
```

---

## Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ],
    "request_id": "req_abc123",
    "timestamp": "2026-02-08T10:30:00Z"
  }
}
```

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 204 | No Content | Request successful, no content to return |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource conflict (e.g., duplicate) |
| 422 | Unprocessable Entity | Validation failed |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Service temporarily unavailable |

### Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `AUTHENTICATION_ERROR` | Authentication failed |
| `AUTHORIZATION_ERROR` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `CONFLICT` | Resource conflict |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `INTERNAL_ERROR` | Internal server error |
| `SERVICE_UNAVAILABLE` | Service temporarily unavailable |

---

## Rate Limiting

### Rate Limits

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Public API | 100 requests | 15 minutes |
| Authenticated API | 1000 requests | 15 minutes |
| Authentication | 5 attempts | 15 minutes |
| Password Reset | 3 requests | 1 hour |

### Rate Limit Headers

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1644321600
Retry-After: 900
```

---

## API Endpoints

### Authentication & Authorization

#### Login

```
POST /api/v1/auth/login
```

**Request:**
```json
{
  "email": "admin@school.edu",
  "password": "SecurePassword123!",
  "tenant_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 3600,
  "user": {
    "id": "user_123",
    "email": "admin@school.edu",
    "name": "Admin User",
    "role": "InstituteAdmin",
    "tenant_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### Logout

```
POST /api/v1/auth/logout
```

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

#### Get Current User

```
GET /api/v1/auth/me
```

**Response:**
```json
{
  "id": "user_123",
  "email": "admin@school.edu",
  "name": "Admin User",
  "role": "InstituteAdmin",
  "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
  "permissions": [
    "students:read",
    "students:write",
    "attendance:read",
    "attendance:write"
  ]
}
```

#### Get User Permissions

```
GET /api/v1/auth/permissions
```

**Response:**
```json
{
  "role": "InstituteAdmin",
  "permissions": [
    {
      "resource": "students",
      "actions": ["read", "write", "delete"]
    },
    {
      "resource": "attendance",
      "actions": ["read", "write"]
    }
  ],
  "field_permissions": {
    "students": {
      "national_id": {
        "visible": true,
        "editable": true
      },
      "medical_history": {
        "visible": true,
        "editable": false
      }
    }
  }
}
```

---

### Tenant Management

#### Create Tenant

```
POST /api/v1/tenants
```

**Request:**
```json
{
  "name": "Springfield Elementary School",
  "subdomain": "springfield",
  "tier": "Business",
  "admin_email": "admin@springfield.edu",
  "admin_name": "Principal Skinner",
  "settings": {
    "timezone": "Asia/Kolkata",
    "currency": "INR",
    "language": "en"
  }
}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Springfield Elementary School",
  "subdomain": "springfield",
  "tier": "Business",
  "status": "active",
  "quotas": {
    "max_students": 10000,
    "max_storage_gb": 100,
    "max_api_calls_per_day": 100000
  },
  "created_at": "2026-02-08T10:30:00Z",
  "admin": {
    "id": "user_123",
    "email": "admin@springfield.edu",
    "name": "Principal Skinner"
  }
}
```

#### Get Tenant

```
GET /api/v1/tenants/:tenant_id
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Springfield Elementary School",
  "subdomain": "springfield",
  "tier": "Business",
  "status": "active",
  "settings": {
    "timezone": "Asia/Kolkata",
    "currency": "INR",
    "language": "en"
  },
  "quotas": {
    "max_students": 10000,
    "max_storage_gb": 100,
    "max_api_calls_per_day": 100000
  },
  "usage": {
    "students": 2500,
    "storage_gb": 45.2,
    "api_calls_today": 15000
  },
  "created_at": "2026-02-08T10:30:00Z"
}
```

#### Update Tenant

```
PATCH /api/v1/tenants/:tenant_id
```

**Request:**
```json
{
  "name": "Springfield Elementary & Middle School",
  "settings": {
    "timezone": "Asia/Kolkata"
  }
}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Springfield Elementary & Middle School",
  "updated_at": "2026-02-08T11:00:00Z"
}
```

---

### User Management

#### Create User

```
POST /api/v1/users
```

**Request:**
```json
{
  "email": "teacher@school.edu",
  "name": "Jane Smith",
  "role": "Teacher",
  "password": "SecurePassword123!",
  "hierarchy_node_id": "center_123"
}
```

**Response:**
```json
{
  "id": "user_456",
  "email": "teacher@school.edu",
  "name": "Jane Smith",
  "role": "Teacher",
  "status": "active",
  "hierarchy_node_id": "center_123",
  "created_at": "2026-02-08T10:30:00Z"
}
```

#### List Users

```
GET /api/v1/users?role=Teacher&status=active&page=1&limit=20
```

**Response:**
```json
{
  "data": [
    {
      "id": "user_456",
      "email": "teacher@school.edu",
      "name": "Jane Smith",
      "role": "Teacher",
      "status": "active",
      "last_login": "2026-02-08T09:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

---

### Hierarchy Management

#### Create Hierarchy Node

```
POST /api/v1/hierarchy
```

**Request:**
```json
{
  "type": "Center",
  "name": "North Campus",
  "parent_id": "institute_123",
  "metadata": {
    "address": "123 Main St",
    "phone": "+91-9876543210"
  }
}
```

**Response:**
```json
{
  "id": "center_456",
  "type": "Center",
  "name": "North Campus",
  "parent_id": "institute_123",
  "path": "/institute_123/center_456",
  "level": 2,
  "metadata": {
    "address": "123 Main St",
    "phone": "+91-9876543210"
  },
  "created_at": "2026-02-08T10:30:00Z"
}
```

#### Get Hierarchy Tree

```
GET /api/v1/hierarchy/:node_id/tree
```

**Response:**
```json
{
  "id": "institute_123",
  "type": "Institute",
  "name": "Springfield Institute",
  "children": [
    {
      "id": "center_456",
      "type": "Center",
      "name": "North Campus",
      "children": [
        {
          "id": "program_789",
          "type": "Program",
          "name": "Computer Science",
          "children": []
        }
      ]
    }
  ]
}
```

---

### Schema Management

#### Create Schema

```
POST /api/v1/schemas
```

**Request:**
```json
{
  "name": "Student Profile",
  "entity_type": "student",
  "version": "1.0.0",
  "fields": [
    {
      "name": "first_name",
      "type": "text",
      "required": true,
      "visible_to_roles": ["Teacher", "Admin"],
      "editable_by_roles": ["Admin"]
    },
    {
      "name": "date_of_birth",
      "type": "date",
      "required": true,
      "validation": {
        "min": "1990-01-01",
        "max": "2020-12-31"
      }
    }
  ]
}
```

**Response:**
```json
{
  "id": "schema_123",
  "snapshot_id": "snapshot_456",
  "name": "Student Profile",
  "version": "1.0.0",
  "hash": "a1b2c3d4e5f6...",
  "status": "active",
  "created_at": "2026-02-08T10:30:00Z"
}
```

#### Get Schema

```
GET /api/v1/schemas/:schema_id
```

**Response:**
```json
{
  "id": "schema_123",
  "snapshot_id": "snapshot_456",
  "name": "Student Profile",
  "version": "1.0.0",
  "hash": "a1b2c3d4e5f6...",
  "fields": [
    {
      "name": "first_name",
      "type": "text",
      "required": true,
      "visible_to_roles": ["Teacher", "Admin"],
      "editable_by_roles": ["Admin"]
    }
  ],
  "created_at": "2026-02-08T10:30:00Z"
}
```

#### Preview Schema as Role

```
POST /api/v1/schemas/:schema_id/preview
```

**Request:**
```json
{
  "role": "Teacher"
}
```

**Response:**
```json
{
  "schema_id": "schema_123",
  "role": "Teacher",
  "visible_fields": [
    {
      "name": "first_name",
      "type": "text",
      "editable": false
    },
    {
      "name": "date_of_birth",
      "type": "date",
      "editable": false
    }
  ],
  "hidden_fields": ["national_id", "medical_history"]
}
```

---

### Student Management

#### Create Student

```
POST /api/v1/students
```

**Request:**
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "date_of_birth": "2010-05-15",
  "email": "john.doe@student.edu",
  "schema_snapshot_id": "snapshot_456",
  "custom_fields": {
    "parent_name": "Jane Doe",
    "emergency_contact": "+91-9876543210"
  }
}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "first_name": "John",
  "last_name": "Doe",
  "date_of_birth": "2010-05-15",
  "email": "john.doe@student.edu",
  "schema_snapshot_id": "snapshot_456",
  "status": "active",
  "created_at": "2026-02-08T10:30:00Z"
}
```

#### Check for Duplicates

```
POST /api/v1/students/check-duplicates
```

**Request:**
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "date_of_birth": "2010-05-15"
}
```

**Response:**
```json
{
  "has_duplicates": true,
  "candidates": [
    {
      "student_id": "student_789",
      "first_name": "John",
      "last_name": "Doe",
      "date_of_birth": "2010-05-15",
      "likelihood_score": 0.92,
      "deterministic_score": 0.95,
      "ai_similarity_score": 0.88,
      "reason_codes": [
        "EXACT_NAME_MATCH",
        "EXACT_DOB_MATCH",
        "HIGH_SEMANTIC_SIMILARITY"
      ],
      "explainability": {
        "shap_values": {
          "first_name": 0.35,
          "last_name": 0.35,
          "date_of_birth": 0.22
        }
      }
    }
  ]
}
```

---

### Attendance Management

#### Mark Attendance

```
POST /api/v1/attendance
```

**Request:**
```json
{
  "event_id": "event_123",
  "student_id": "student_456",
  "status": "present",
  "timestamp": "2026-02-08T09:00:00Z",
  "device_id": "device_789",
  "idempotency_key": "event_123_device_789_1644321600"
}
```

**Response:**
```json
{
  "id": "attendance_123",
  "event_id": "event_123",
  "student_id": "student_456",
  "status": "present",
  "timestamp": "2026-02-08T09:00:00Z",
  "synced_at": "2026-02-08T09:05:00Z"
}
```

#### Sync Offline Attendance

```
POST /api/v1/attendance/sync
```

**Request:**
```json
{
  "records": [
    {
      "event_id": "event_123",
      "student_id": "student_456",
      "status": "present",
      "client_timestamp": "2026-02-08T09:00:00+05:30",
      "device_id": "device_789",
      "idempotency_key": "event_123_device_789_1644321600"
    }
  ]
}
```

**Response:**
```json
{
  "synced": 1,
  "failed": 0,
  "duplicates": 0,
  "conflicts": 0,
  "results": [
    {
      "idempotency_key": "event_123_device_789_1644321600",
      "status": "synced",
      "attendance_id": "attendance_123"
    }
  ]
}
```

---

### Payment Management

#### Create Payment

```
POST /api/v1/payments
```

**Request:**
```json
{
  "student_id": "student_456",
  "amount": 50000,
  "currency": "INR",
  "payment_method": "razorpay",
  "description": "Tuition Fee - Semester 1",
  "metadata": {
    "semester": "1",
    "academic_year": "2026"
  }
}
```

**Response:**
```json
{
  "id": "payment_123",
  "student_id": "student_456",
  "amount": 50000,
  "currency": "INR",
  "status": "pending",
  "payment_url": "https://razorpay.com/checkout/...",
  "created_at": "2026-02-08T10:30:00Z"
}
```

#### Generate Invoice

```
POST /api/v1/invoices
```

**Request:**
```json
{
  "student_id": "student_456",
  "line_items": [
    {
      "description": "Tuition Fee",
      "amount": 45000,
      "quantity": 1
    },
    {
      "description": "Lab Fee",
      "amount": 5000,
      "quantity": 1
    }
  ],
  "tax_rate": 18,
  "due_date": "2026-03-08"
}
```

**Response:**
```json
{
  "id": "invoice_123",
  "invoice_number": "INV-2026-02-0001",
  "student_id": "student_456",
  "subtotal": 50000,
  "tax": 9000,
  "total": 59000,
  "currency": "INR",
  "status": "pending",
  "due_date": "2026-03-08",
  "pdf_url": "https://storage.eduos.com/invoices/INV-2026-02-0001.pdf",
  "created_at": "2026-02-08T10:30:00Z"
}
```

---

### Audit & Compliance

#### Get Audit Logs

```
GET /api/v1/audit/logs?user_id=user_123&action=login&start_date=2026-02-01&end_date=2026-02-08
```

**Response:**
```json
{
  "data": [
    {
      "id": "audit_123",
      "event_type": "auth.login",
      "user_id": "user_123",
      "user_email": "admin@school.edu",
      "action": "login",
      "resource_type": "session",
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0...",
      "timestamp": "2026-02-08T09:00:00Z",
      "hash": "a1b2c3d4e5f6...",
      "previous_hash": "f6e5d4c3b2a1..."
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1000
  }
}
```

#### Verify Audit Chain

```
POST /api/v1/audit/verify
```

**Response:**
```json
{
  "valid": true,
  "total_entries": 10000,
  "verified_entries": 10000,
  "broken_chains": 0,
  "verification_time_ms": 1250
}
```

---

### AI Services

#### Get Duplicate Candidates

```
POST /api/v1/ai/duplicates/detect
```

**Request:**
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "date_of_birth": "2010-05-15",
  "threshold": 0.75
}
```

**Response:**
```json
{
  "candidates": [
    {
      "student_id": "student_789",
      "likelihood_score": 0.92,
      "confidence": 0.88,
      "explainability": {
        "reason": "High similarity in name and exact DOB match",
        "shap_values": {
          "first_name": 0.35,
          "last_name": 0.35,
          "date_of_birth": 0.22
        }
      }
    }
  ],
  "ai_enabled": true,
  "model_version": "v2.1"
}
```

#### Get AI Kill Switch Status

```
GET /api/v1/ai/kill-switch
```

**Response:**
```json
{
  "enabled": false,
  "activated_at": null,
  "activated_by": null,
  "reason": null
}
```

---

## Webhooks

### Webhook Events

The platform sends webhooks for the following events:

| Event | Description |
|-------|-------------|
| `payment.succeeded` | Payment completed successfully |
| `payment.failed` | Payment failed |
| `invoice.created` | Invoice generated |
| `student.created` | New student created |
| `attendance.synced` | Attendance records synced |

### Webhook Payload

```json
{
  "id": "webhook_123",
  "event": "payment.succeeded",
  "created_at": "2026-02-08T10:30:00Z",
  "data": {
    "payment_id": "payment_123",
    "amount": 50000,
    "currency": "INR",
    "status": "succeeded"
  },
  "signature": "sha256=a1b2c3d4e5f6..."
}
```

### Webhook Signature Verification

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return `sha256=${expectedSignature}` === signature;
}
```

---

## OpenAPI Specification

The complete OpenAPI 3.0 specification is available at:

```
GET /api/v1/openapi.json
```

You can also view the interactive API documentation at:

```
https://api.eduos.com/docs
```

---

## SDK & Client Libraries

### Official SDKs

- **JavaScript/TypeScript**: `npm install @eduos/sdk`
- **Python**: `pip install eduos-sdk`
- **Java**: Maven/Gradle available
- **PHP**: Composer available

### Example Usage (JavaScript)

```javascript
const EduOS = require('@eduos/sdk');

const client = new EduOS({
  apiKey: 'your_api_key',
  tenantId: 'your_tenant_id'
});

// Create a student
const student = await client.students.create({
  first_name: 'John',
  last_name: 'Doe',
  date_of_birth: '2010-05-15'
});

// Mark attendance
await client.attendance.mark({
  student_id: student.id,
  status: 'present'
});
```

---

## Support

For API support:
- **Documentation**: https://docs.eduos.com
- **Email**: api-support@eduos.com
- **Status Page**: https://status.eduos.com

---

**Last Updated:** 2026-02-08  
**API Version:** 1.0  
**OpenAPI Version:** 3.0.3
