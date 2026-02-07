# Invoice Generation System

## Overview

The Invoice Generation System provides comprehensive invoice management with sequential numbering, gap detection, and PDF generation capabilities. This system ensures compliance with financial regulations by maintaining strict sequential numbering per tenant.

## Features

### 1. Sequential Invoice Numbering

- **Format**: `INV-{YYYY}-{MM}-{NNNN}` (e.g., `INV-2026-02-0001`)
- **Scope**: Sequential per tenant per month
- **Thread-Safe**: Uses database-level locking to prevent duplicate numbers
- **No Gaps**: Ensures continuous sequence with gap detection

### 2. Invoice Components

Each invoice includes:
- **Line Items**: Itemized list of charges with quantity and unit price
- **Tax Details**: Support for Indian GST (CGST, SGST, IGST)
- **Discounts**: Percentage or fixed amount discounts
- **Metadata**: Additional information and notes
- **Status Tracking**: Draft, Issued, Paid, Cancelled, Refunded

### 3. Gap Detection

The system can detect missing invoice numbers in the sequence, alerting administrators to potential issues:
- Detects gaps in any month/year
- Provides detailed list of missing sequence numbers
- Helps maintain audit compliance

### 4. PDF Generation

Generates branded invoice PDFs with:
- Tenant branding
- Student information
- Itemized charges
- Tax breakdown
- Payment terms

## Database Schema

### Invoices Table

```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  student_id UUID NOT NULL,
  payment_id UUID,
  
  -- Sequential numbering
  invoice_number VARCHAR(50) NOT NULL,
  invoice_year INTEGER NOT NULL,
  invoice_month INTEGER NOT NULL,
  invoice_sequence INTEGER NOT NULL,
  
  -- Invoice details
  issue_date DATE NOT NULL,
  due_date DATE,
  status VARCHAR(50) NOT NULL,
  
  -- Financial information
  subtotal INTEGER NOT NULL,
  tax_amount INTEGER NOT NULL,
  discount_amount INTEGER NOT NULL,
  total_amount INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  
  -- Line items and details
  line_items JSONB NOT NULL,
  tax_details JSONB,
  discount_details JSONB,
  notes TEXT,
  
  -- PDF generation
  pdf_url TEXT,
  pdf_generated_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  UNIQUE (tenant_id, invoice_number)
);
```

### Invoice Sequences Table

```sql
CREATE TABLE invoice_sequences (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  invoice_year INTEGER NOT NULL,
  invoice_month INTEGER NOT NULL,
  next_sequence INTEGER NOT NULL DEFAULT 1,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  UNIQUE (tenant_id, invoice_year, invoice_month)
);
```

## API Endpoints

### 1. Generate Invoice

**POST** `/api/v1/invoices`

Creates a new invoice with automatic sequential numbering.

**Request Body:**
```json
{
  "tenant_id": "uuid",
  "student_id": "uuid",
  "payment_id": "uuid",
  "line_items": [
    {
      "description": "Tuition Fee",
      "quantity": 1,
      "unit_price": 50000
    },
    {
      "description": "Lab Fee",
      "quantity": 1,
      "unit_price": 10000
    }
  ],
  "tax_details": {
    "cgst": 9,
    "sgst": 9
  },
  "discount_details": {
    "type": "percentage",
    "value": 10,
    "reason": "Early bird discount"
  },
  "notes": "Payment due within 30 days",
  "due_date": "2026-03-07"
}
```

**Response:**
```json
{
  "success": true,
  "invoice": {
    "id": "uuid",
    "invoice_number": "INV-2026-02-0001",
    "status": "issued",
    "subtotal": 60000,
    "tax_amount": 10800,
    "discount_amount": 6000,
    "total_amount": 64800,
    "currency": "INR",
    "created_at": "2026-02-07T10:00:00Z"
  }
}
```

### 2. Get Invoice by ID

**GET** `/api/v1/invoices/:id?tenant_id=uuid`

Retrieves a specific invoice by ID.

**Response:**
```json
{
  "success": true,
  "invoice": {
    "id": "uuid",
    "invoice_number": "INV-2026-02-0001",
    "student_id": "uuid",
    "status": "issued",
    "total_amount": 64800,
    "line_items": [...],
    "created_at": "2026-02-07T10:00:00Z"
  }
}
```

### 3. Get Invoice by Number

**GET** `/api/v1/invoices/number/:invoice_number?tenant_id=uuid`

Retrieves an invoice by its invoice number.

**Example:** `/api/v1/invoices/number/INV-2026-02-0001?tenant_id=uuid`

### 4. List Invoices

**GET** `/api/v1/invoices?tenant_id=uuid&student_id=uuid&status=issued&limit=50&offset=0`

Lists invoices with optional filtering.

**Query Parameters:**
- `tenant_id` (required): Tenant UUID
- `student_id` (optional): Filter by student
- `status` (optional): Filter by status (draft, issued, paid, cancelled, refunded)
- `limit` (optional): Number of results (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "invoices": [...],
  "count": 10
}
```

### 5. Update Invoice Status

**PATCH** `/api/v1/invoices/:id/status`

Updates the status of an invoice.

**Request Body:**
```json
{
  "tenant_id": "uuid",
  "status": "paid"
}
```

**Valid Statuses:**
- `draft`: Invoice is being prepared
- `issued`: Invoice has been sent to student
- `paid`: Payment has been received
- `cancelled`: Invoice has been cancelled
- `refunded`: Payment has been refunded

### 6. Generate Invoice PDF

**GET** `/api/v1/invoices/:id/pdf?tenant_id=uuid`

Generates and downloads an invoice as a PDF.

**Response:** PDF file with filename `{invoice_number}.pdf`

### 7. Detect Invoice Gaps

**GET** `/api/v1/invoices/gaps/detect?tenant_id=uuid&year=2026&month=2`

Detects gaps in invoice sequence numbering.

**Query Parameters:**
- `tenant_id` (required): Tenant UUID
- `year` (optional): Year to check (default: current year)
- `month` (optional): Month to check (default: current month)

**Response:**
```json
{
  "success": true,
  "gaps": [
    {
      "year": 2026,
      "month": 2,
      "missing_sequence": 3
    },
    {
      "year": 2026,
      "month": 2,
      "missing_sequence": 5
    }
  ],
  "has_gaps": true,
  "count": 2
}
```

## Usage Examples

### Example 1: Generate Simple Invoice

```javascript
const response = await fetch('/api/v1/invoices', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tenant_id: 'tenant-uuid',
    student_id: 'student-uuid',
    line_items: [
      {
        description: 'Monthly Tuition Fee',
        quantity: 1,
        unit_price: 100000 // ₹1,000.00 in paise
      }
    ],
    tax_details: {
      cgst: 9,
      sgst: 9
    }
  })
});

const { invoice } = await response.json();
console.log(`Invoice generated: ${invoice.invoice_number}`);
```

### Example 2: Apply Discount

```javascript
const response = await fetch('/api/v1/invoices', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tenant_id: 'tenant-uuid',
    student_id: 'student-uuid',
    line_items: [
      {
        description: 'Annual Tuition Fee',
        quantity: 1,
        unit_price: 1000000 // ₹10,000.00
      }
    ],
    tax_details: {
      cgst: 9,
      sgst: 9
    },
    discount_details: {
      type: 'percentage',
      value: 15,
      reason: 'Sibling discount'
    }
  })
});
```

### Example 3: Check for Gaps

```javascript
const response = await fetch(
  '/api/v1/invoices/gaps/detect?tenant_id=tenant-uuid&year=2026&month=2'
);

const { gaps, has_gaps } = await response.json();

if (has_gaps) {
  console.log('Warning: Invoice sequence has gaps!');
  gaps.forEach(gap => {
    console.log(`Missing: INV-${gap.year}-${gap.month}-${gap.missing_sequence}`);
  });
}
```

## Tax Calculation

The system supports Indian GST tax structure:

### Intra-State Transactions (CGST + SGST)
```json
{
  "tax_details": {
    "cgst": 9,
    "sgst": 9
  }
}
```
Total tax rate: 18% (9% CGST + 9% SGST)

### Inter-State Transactions (IGST)
```json
{
  "tax_details": {
    "igst": 18
  }
}
```
Total tax rate: 18% IGST

## Discount Types

### Percentage Discount
```json
{
  "discount_details": {
    "type": "percentage",
    "value": 10,
    "reason": "Early payment discount"
  }
}
```
Discount = Subtotal × (value / 100)

### Fixed Amount Discount
```json
{
  "discount_details": {
    "type": "fixed",
    "value": 5000,
    "reason": "Scholarship"
  }
}
```
Discount = value (in paise)

## Amount Calculation

The total amount is calculated as:

```
Subtotal = Sum of (quantity × unit_price) for all line items
Tax Amount = Subtotal × (tax_rate / 100)
Discount Amount = Calculated based on discount type
Total Amount = Subtotal + Tax Amount - Discount Amount
```

**Note:** All amounts are stored in paise (smallest currency unit):
- ₹1.00 = 100 paise
- ₹10.00 = 1000 paise
- ₹100.00 = 10000 paise

## Sequential Numbering

### How It Works

1. **Invoice Number Generation**: When creating an invoice, the system calls the `generate_invoice_number()` database function
2. **Thread-Safe Locking**: The function uses `SELECT FOR UPDATE` to lock the sequence row
3. **Increment**: The sequence is incremented atomically
4. **Format**: The invoice number is formatted as `INV-{YYYY}-{MM}-{NNNN}`

### Example Sequence

```
INV-2026-02-0001  (First invoice in February 2026)
INV-2026-02-0002  (Second invoice)
INV-2026-02-0003  (Third invoice)
...
INV-2026-03-0001  (First invoice in March 2026 - sequence resets)
```

### Gap Detection

The `detect_invoice_gaps()` function identifies missing sequence numbers:

```sql
SELECT * FROM detect_invoice_gaps('tenant-uuid', 2026, 2);
```

Returns:
```
 year | month | missing_sequence
------+-------+-----------------
 2026 |     2 |               3
 2026 |     2 |               5
```

This indicates that invoices `INV-2026-02-0003` and `INV-2026-02-0005` are missing.

## Security

### Row-Level Security (RLS)

All invoice tables have RLS enabled to ensure tenant isolation:

```sql
CREATE POLICY invoices_tenant_isolation ON invoices
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);
```

### Access Control

- Invoices can only be accessed by users within the same tenant
- The `tenant_id` must be provided in all API requests
- Database queries automatically filter by tenant context

## Migration

To apply the invoice generation migration:

```bash
node database/run_migration_017.js
```

To rollback:

```bash
psql -U postgres -d eduos -f database/migrations/017_invoice_generation_rollback.sql
```

## Testing

Run the invoice tests:

```bash
# Test invoice service
npm test -- src/services/paymentService.invoice.test.js

# Test invoice routes
npm test -- src/routes/invoices.test.js
```

## Best Practices

1. **Always Check for Gaps**: Regularly run gap detection to ensure sequence integrity
2. **Use Transactions**: Wrap invoice creation in database transactions for consistency
3. **Validate Line Items**: Ensure all line items have valid descriptions, quantities, and prices
4. **Set Due Dates**: Always specify a due date for issued invoices
5. **Track Status**: Update invoice status as payments are received
6. **Generate PDFs**: Generate and store PDFs for issued invoices for record-keeping
7. **Audit Trail**: Maintain complete audit logs of all invoice operations

## Troubleshooting

### Issue: Duplicate Invoice Numbers

**Cause**: Concurrent requests creating invoices simultaneously

**Solution**: The system uses database-level locking to prevent this. If it occurs, check for:
- Database connection pool exhaustion
- Transaction isolation level issues

### Issue: Gaps in Sequence

**Cause**: Failed transactions or cancelled invoices

**Solution**: 
1. Run gap detection: `GET /api/v1/invoices/gaps/detect`
2. Investigate missing invoices in audit logs
3. If legitimate gaps exist, document the reason

### Issue: Incorrect Tax Calculation

**Cause**: Wrong tax details provided

**Solution**:
- For intra-state: Use CGST + SGST (e.g., 9% + 9% = 18%)
- For inter-state: Use IGST (e.g., 18%)
- Ensure tax rates are current and compliant

## Future Enhancements

1. **Recurring Invoices**: Automatic generation of recurring invoices
2. **Payment Plans**: Support for installment-based payments
3. **Multi-Currency**: Support for currencies beyond INR
4. **Email Delivery**: Automatic email delivery of invoices
5. **Reminders**: Automated payment reminders for overdue invoices
6. **Credit Notes**: Support for credit notes and adjustments
7. **Bulk Generation**: Batch invoice generation for multiple students

## Related Documentation

- [Payment Gateway Integration](./PAYMENT_GATEWAY.md)
- [Webhook Retry System](./WEBHOOK_RETRY_SYSTEM.md)
- [Payment Quick Start](./PAYMENT_QUICK_START.md)
