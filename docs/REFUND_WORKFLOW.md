# Refund Workflow with Approval Chain

## Overview

The EduOS Platform implements a comprehensive refund workflow with a three-tier approval chain to ensure proper oversight and control over refund operations. This document describes the refund workflow, approval chain, and API endpoints.

## Features

- **Approval Chain**: Teacher → Admin → Finance Manager
- **Partial Refunds**: Support for both full and partial refunds
- **Status Tracking**: Complete lifecycle tracking (pending, approved, rejected, processed, cancelled)
- **Audit Trail**: Complete history of all approval actions
- **Credit Notes**: Automatic credit note generation for approved refunds
- **Gateway Integration**: Automatic refund processing with Stripe/Razorpay
- **Email Notifications**: Automatic notifications to students/guardians on refund completion

## Approval Chain

The refund workflow follows a strict three-tier approval chain:

### 1. Teacher Approval (First Level)
- **Role**: `teacher`
- **Responsibility**: Initial review of refund request
- **Actions**: Approve or Reject
- **Required**: Yes (must be completed before Admin can approve)

### 2. Admin Approval (Second Level)
- **Role**: `admin`
- **Responsibility**: Administrative review and validation
- **Actions**: Approve or Reject
- **Required**: Yes (requires Teacher approval first)

### 3. Finance Manager Approval (Third Level)
- **Role**: `finance_manager`
- **Responsibility**: Final financial approval
- **Actions**: Approve or Reject
- **Required**: Yes (requires both Teacher and Admin approval first)
- **Effect**: Changes status to `approved` when completed

## Refund Status Lifecycle

```
pending → approved → processed
   ↓
rejected
   ↓
cancelled
```

### Status Definitions

- **pending**: Refund request created, awaiting approval
- **approved**: All three approvals completed, ready for processing
- **rejected**: Rejected by any approver in the chain
- **processed**: Refund executed with payment gateway
- **cancelled**: Refund request cancelled by requester

## Database Schema

### refund_requests Table

Stores refund requests with approval chain tracking.

```sql
CREATE TABLE refund_requests (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  payment_id UUID REFERENCES payments(id),
  invoice_id UUID REFERENCES invoices(id),
  
  -- Refund Details
  refund_amount INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'INR',
  refund_type VARCHAR(20) NOT NULL, -- 'full' or 'partial'
  reason TEXT NOT NULL,
  supporting_documents JSONB DEFAULT '[]',
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending',
  
  -- Approval Chain
  requested_by UUID NOT NULL,
  teacher_approved_by UUID,
  teacher_approved_at TIMESTAMP,
  teacher_rejection_reason TEXT,
  admin_approved_by UUID,
  admin_approved_at TIMESTAMP,
  admin_rejection_reason TEXT,
  finance_approved_by UUID,
  finance_approved_at TIMESTAMP,
  finance_rejection_reason TEXT,
  
  -- Processing
  processed_by UUID,
  processed_at TIMESTAMP,
  gateway_refund_id VARCHAR(255),
  gateway_status VARCHAR(50),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### refund_approval_history Table

Stores complete audit trail of approval actions.

```sql
CREATE TABLE refund_approval_history (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  refund_request_id UUID NOT NULL,
  approver_role VARCHAR(50) NOT NULL, -- 'teacher', 'admin', 'finance_manager'
  approver_id UUID NOT NULL,
  action VARCHAR(20) NOT NULL, -- 'approved', 'rejected', 'requested_info'
  comments TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### credit_notes Table

Stores credit notes generated for approved refunds.

```sql
CREATE TABLE credit_notes (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  invoice_id UUID NOT NULL,
  refund_request_id UUID NOT NULL,
  
  -- Credit Note Number (Format: CN-YYYY-MM-NNNN)
  credit_note_number VARCHAR(50) NOT NULL,
  credit_note_year INTEGER NOT NULL,
  credit_note_month INTEGER NOT NULL,
  credit_note_sequence INTEGER NOT NULL,
  
  -- Details
  issue_date DATE DEFAULT CURRENT_DATE,
  credit_amount INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'INR',
  reason TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'issued',
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## API Endpoints

### 1. Create Refund Request

Create a new refund request.

**Endpoint**: `POST /api/v1/refunds`

**Request Body**:
```json
{
  "payment_id": "uuid", // Optional (either payment_id or invoice_id required)
  "invoice_id": "uuid", // Optional (either payment_id or invoice_id required)
  "refund_amount": 50000, // Amount in paise (₹500.00)
  "refund_type": "partial", // 'full' or 'partial'
  "reason": "Customer requested partial refund",
  "supporting_documents": ["https://example.com/doc1.pdf"],
  "requested_by": "user-uuid"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "refund-uuid",
    "tenant_id": "tenant-uuid",
    "payment_id": "payment-uuid",
    "refund_amount": 50000,
    "currency": "INR",
    "refund_type": "partial",
    "reason": "Customer requested partial refund",
    "status": "pending",
    "requested_by": "user-uuid",
    "created_at": "2026-02-07T10:00:00Z"
  }
}
```

### 2. Get Refund Request

Retrieve a specific refund request by ID.

**Endpoint**: `GET /api/v1/refunds/:id`

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "refund-uuid",
    "status": "pending",
    "teacher_approved_by": null,
    "admin_approved_by": null,
    "finance_approved_by": null,
    ...
  }
}
```

### 3. List Refund Requests

List refund requests with optional filtering.

**Endpoint**: `GET /api/v1/refunds`

**Query Parameters**:
- `limit` (optional): Number of results (1-100, default: 50)
- `offset` (optional): Pagination offset (default: 0)
- `status` (optional): Filter by status
- `payment_id` (optional): Filter by payment ID
- `invoice_id` (optional): Filter by invoice ID

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "refund-1",
      "status": "pending",
      ...
    },
    {
      "id": "refund-2",
      "status": "approved",
      ...
    }
  ],
  "count": 2
}
```

### 4. Approve Refund Request

Approve a refund request (approval chain step).

**Endpoint**: `POST /api/v1/refunds/:id/approve`

**Request Body**:
```json
{
  "approver_role": "teacher", // 'teacher', 'admin', or 'finance_manager'
  "approver_id": "user-uuid",
  "comments": "Approved - documentation verified" // Optional
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "refund-uuid",
    "status": "pending", // Changes to 'approved' after finance_manager approval
    "teacher_approved_by": "teacher-uuid",
    "teacher_approved_at": "2026-02-07T10:05:00Z",
    ...
  },
  "message": "Refund request approved by teacher"
}
```

### 5. Reject Refund Request

Reject a refund request.

**Endpoint**: `POST /api/v1/refunds/:id/reject`

**Request Body**:
```json
{
  "approver_role": "teacher",
  "approver_id": "user-uuid",
  "rejection_reason": "Insufficient documentation provided"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "refund-uuid",
    "status": "rejected",
    "teacher_approved_by": "teacher-uuid",
    "teacher_rejection_reason": "Insufficient documentation provided",
    ...
  },
  "message": "Refund request rejected by teacher"
}
```

### 6. Process Refund

Execute the refund with the payment gateway (after approval).

**Endpoint**: `POST /api/v1/refunds/:id/process`

**Request Body**:
```json
{
  "processed_by": "finance-user-uuid"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "refund-uuid",
    "status": "processed",
    "processed_by": "finance-uuid",
    "processed_at": "2026-02-07T10:30:00Z",
    "gateway_refund_id": "rfnd_razorpay123",
    "gateway_status": "processed",
    ...
  },
  "message": "Refund processed successfully"
}
```

### 7. Get Approval History

Retrieve the complete approval history for a refund request.

**Endpoint**: `GET /api/v1/refunds/:id/history`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "history-1",
      "refund_request_id": "refund-uuid",
      "approver_role": "teacher",
      "approver_id": "teacher-uuid",
      "action": "approved",
      "comments": "Looks good",
      "created_at": "2026-02-07T10:05:00Z"
    },
    {
      "id": "history-2",
      "refund_request_id": "refund-uuid",
      "approver_role": "admin",
      "approver_id": "admin-uuid",
      "action": "approved",
      "comments": null,
      "created_at": "2026-02-07T10:15:00Z"
    },
    {
      "id": "history-3",
      "refund_request_id": "refund-uuid",
      "approver_role": "finance_manager",
      "approver_id": "finance-uuid",
      "action": "approved",
      "comments": "Final approval granted",
      "created_at": "2026-02-07T10:25:00Z"
    }
  ]
}
```

## Workflow Examples

### Example 1: Full Refund Workflow

```javascript
// 1. Create refund request
POST /api/v1/refunds
{
  "payment_id": "pay-123",
  "refund_amount": 100000,
  "refund_type": "full",
  "reason": "Course cancelled",
  "requested_by": "user-123"
}

// 2. Teacher approves
POST /api/v1/refunds/refund-123/approve
{
  "approver_role": "teacher",
  "approver_id": "teacher-123",
  "comments": "Course was indeed cancelled"
}

// 3. Admin approves
POST /api/v1/refunds/refund-123/approve
{
  "approver_role": "admin",
  "approver_id": "admin-123"
}

// 4. Finance Manager approves (status changes to 'approved')
POST /api/v1/refunds/refund-123/approve
{
  "approver_role": "finance_manager",
  "approver_id": "finance-123"
}

// 5. Process refund
POST /api/v1/refunds/refund-123/process
{
  "processed_by": "finance-123"
}
```

### Example 2: Rejected Refund

```javascript
// 1. Create refund request
POST /api/v1/refunds
{
  "invoice_id": "inv-123",
  "refund_amount": 50000,
  "refund_type": "partial",
  "reason": "Unsatisfied with service",
  "requested_by": "user-123"
}

// 2. Teacher rejects
POST /api/v1/refunds/refund-123/reject
{
  "approver_role": "teacher",
  "approver_id": "teacher-123",
  "rejection_reason": "No valid reason provided for partial refund"
}
// Status is now 'rejected' - workflow ends
```

## Credit Notes

When a refund is processed for an invoice, a credit note is automatically generated.

### Credit Note Number Format

Credit notes follow the format: `CN-YYYY-MM-NNNN`

Example: `CN-2026-02-0001`

- `CN`: Credit Note prefix
- `YYYY`: Year (4 digits)
- `MM`: Month (2 digits)
- `NNNN`: Sequential number (4 digits, resets monthly)

### Credit Note Generation

Credit notes are automatically created when:
1. A refund request is processed
2. The refund request is linked to an invoice

The credit note includes:
- Reference to original invoice
- Reference to refund request
- Credit amount
- Reason for credit
- Issue date

## Validation Rules

### Refund Amount Validation

The system automatically validates that:
1. Refund amount is positive
2. Refund amount does not exceed the original payment/invoice amount
3. Total refunds (including previous refunds) do not exceed the original amount

This validation is enforced at the database level via a trigger function.

### Approval Chain Validation

The system enforces the approval chain order:
1. Teacher must approve before Admin can approve
2. Both Teacher and Admin must approve before Finance Manager can approve
3. Only Finance Manager approval changes status to 'approved'

## Email Notifications

Email notifications are sent automatically at key stages:

1. **Refund Request Created**: Notify Teacher
2. **Teacher Approved**: Notify Admin
3. **Admin Approved**: Notify Finance Manager
4. **Finance Manager Approved**: Notify Requester
5. **Refund Processed**: Notify Student/Guardian
6. **Refund Rejected**: Notify Requester with reason

## Error Handling

### Common Errors

**400 Bad Request**:
- Missing required fields
- Invalid refund type
- Neither payment_id nor invoice_id provided
- Approval chain order violated

**404 Not Found**:
- Refund request not found
- Payment/Invoice not found

**500 Internal Server Error**:
- Database errors
- Payment gateway errors

### Gateway Failures

If the payment gateway fails during processing:
1. The refund status is still set to 'processed'
2. The `gateway_status` is set to 'manual_processing_required'
3. Finance team is notified to process manually
4. The refund can be retried or processed manually

## Security Considerations

1. **Row-Level Security**: All tables have RLS enabled for tenant isolation
2. **Approval Validation**: Strict enforcement of approval chain order
3. **Audit Trail**: Complete history of all actions
4. **Amount Validation**: Database-level validation prevents over-refunding
5. **Role-Based Access**: Only authorized roles can approve at each level

## Testing

Run the test suite:

```bash
# Run all refund tests
npm test -- refunds

# Run route tests
npm test -- src/routes/refunds.test.js

# Run service tests
npm test -- src/services/paymentService.refund.test.js
```

## Migration

Run the migration to create refund tables:

```bash
node database/run_migration_018.js
```

Rollback if needed:

```bash
psql -U postgres -d eduos -f database/migrations/018_refund_workflow_rollback.sql
```

## Next Steps

1. Implement email notification service integration
2. Add webhook support for gateway refund status updates
3. Implement refund analytics dashboard
4. Add bulk refund processing capability
5. Implement refund report generation

## Support

For questions or issues with the refund workflow, contact the development team or refer to the main documentation at `docs/README.md`.
