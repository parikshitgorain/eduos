# Task 12.2 - Contact Information Display Examples

## Overview
This document provides examples of how the contact information display logic works in different scenarios.

## Scenario 1: No Tenant Selected

**User Action**: User opens the login page without selecting an institution

**Contact Modal Display**:
```
┌─────────────────────────────────────────┐
│ Contact Support                      ✕  │
├─────────────────────────────────────────┤
│                                         │
│ For assistance with EduOS, please      │
│ contact our support team:              │
│                                         │
│ ┌─────────────────────────────────┐   │
│ │ 📧 Email                        │   │
│ │    support@eduos.com            │   │
│ │                                 │   │
│ │ 📞 Phone                        │   │
│ │    1-800-EDUOS-HELP             │   │
│ └─────────────────────────────────┘   │
│                                         │
│ Our support team is available to help  │
│ with technical issues and account      │
│ questions.                              │
│                                         │
│                          [Close]        │
└─────────────────────────────────────────┘
```

## Scenario 2: Tenant Selected with Full Contact Info

**User Action**: User selects "University of Example" which has contact info

**Backend Response**:
```json
{
  "id": "tenant-123",
  "name": "University of Example",
  "location": "Example City, EX",
  "contactInfo": {
    "email": "support@university.edu",
    "phone": "555-123-4567"
  }
}
```

**Contact Modal Display**:
```
┌─────────────────────────────────────────┐
│ Contact Support                      ✕  │
├─────────────────────────────────────────┤
│                                         │
│ For assistance with your University    │
│ of Example account, please contact     │
│ your institution's support team:       │
│                                         │
│ ┌─────────────────────────────────┐   │
│ │ 📧 Email                        │   │
│ │    support@university.edu       │   │
│ │                                 │   │
│ │ 📞 Phone                        │   │
│ │    555-123-4567                 │   │
│ └─────────────────────────────────┘   │
│                                         │
│ Your institution administrator can help │
│ with account access, password resets,   │
│ and other login issues.                 │
│                                         │
│                          [Close]        │
└─────────────────────────────────────────┘
```

## Scenario 3: Tenant Selected with Email Only

**User Action**: User selects "College of Testing" which only has email

**Backend Response**:
```json
{
  "id": "tenant-456",
  "name": "College of Testing",
  "location": "Test City, TC",
  "contactInfo": {
    "email": "help@college.edu"
  }
}
```

**Contact Modal Display**:
```
┌─────────────────────────────────────────┐
│ Contact Support                      ✕  │
├─────────────────────────────────────────┤
│                                         │
│ For assistance with your College of    │
│ Testing account, please contact your   │
│ institution's support team:            │
│                                         │
│ ┌─────────────────────────────────┐   │
│ │ 📧 Email                        │   │
│ │    help@college.edu             │   │
│ └─────────────────────────────────┘   │
│                                         │
│ Your institution administrator can help │
│ with account access, password resets,   │
│ and other login issues.                 │
│                                         │
│                          [Close]        │
└─────────────────────────────────────────┘
```

## Scenario 4: Tenant Selected without Contact Info (Fallback)

**User Action**: User selects "Institute Without Contact" which has no contact info

**Backend Response**:
```json
{
  "id": "tenant-789",
  "name": "Institute Without Contact",
  "location": "No Contact City, NC"
}
```

**Contact Modal Display**:
```
┌─────────────────────────────────────────┐
│ Contact Support                      ✕  │
├─────────────────────────────────────────┤
│                                         │
│ For assistance with EduOS, please      │
│ contact our support team:              │
│                                         │
│ ┌─────────────────────────────────┐   │
│ │ 📧 Email                        │   │
│ │    support@eduos.com            │   │
│ │                                 │   │
│ │ 📞 Phone                        │   │
│ │    1-800-EDUOS-HELP             │   │
│ └─────────────────────────────────┘   │
│                                         │
│ Our support team is available to help  │
│ with technical issues and account      │
│ questions.                              │
│                                         │
│                          [Close]        │
└─────────────────────────────────────────┘
```

## Data Flow

```
┌──────────────┐
│ User searches│
│ for tenant   │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│ TenantSelector       │
│ - Calls API          │
│ - Gets tenant list   │
│   with contactInfo   │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ User selects tenant  │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────────────┐
│ TenantSelector.onChange()    │
│ - Passes tenantId            │
│ - Passes tenantName          │
│ - Passes contactInfo         │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│ LoginForm                    │
│ - Stores tenantId            │
│ - Stores tenantName          │
│ - Stores contactInfo         │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│ ContactAdminLink             │
│ - Receives props             │
│ - Determines display logic:  │
│   • Has tenantId + contact?  │
│     → Show tenant info       │
│   • Has tenantId, no contact?│
│     → Show default info      │
│   • No tenantId?             │
│     → Show default info      │
└──────────────────────────────┘
```

## Backend API Expectations

The backend should return contact information in the tenant search response:

**Endpoint**: `GET /api/v1/tenants/search?q={query}`

**Response Format**:
```json
{
  "tenants": [
    {
      "id": "string",
      "name": "string",
      "location": "string",
      "logoUrl": "string (optional)",
      "contactInfo": {
        "email": "string (optional)",
        "phone": "string (optional)"
      }
    }
  ]
}
```

**Notes**:
- `contactInfo` is optional - if not provided, system falls back to default
- `email` and `phone` within `contactInfo` are both optional
- At least one contact method should be provided if `contactInfo` is included
