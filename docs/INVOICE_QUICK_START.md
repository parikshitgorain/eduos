# Invoice Generation - Quick Start Guide

## 🚀 Quick Setup

### 1. Run Migration

```bash
node database/run_migration_017.js
```

### 2. Verify Tables

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('invoices', 'invoice_sequences');

-- Test invoice number generation
SELECT * FROM generate_invoice_number('your-tenant-id');
```

---

## 📝 Basic Usage

### Generate Your First Invoice

```javascript
const response = await fetch('/api/v1/invoices', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tenant_id: 'your-tenant-uuid',
    student_id: 'student-uuid',
    line_items: [
      {
        description: 'Tuition Fee',
        quantity: 1,
        unit_price: 100000  // ₹1,000.00 (in paise)
      }
    ],
    tax_details: {
      cgst: 9,  // 9% CGST
      sgst: 9   // 9% SGST
    }
  })
});

const { invoice } = await response.json();
console.log(invoice.invoice_number);  // INV-2026-02-0001
```

---

## 💰 Amount Format

**Important**: All amounts are in **paise** (smallest currency unit)

```javascript
₹1.00    = 100 paise
₹10.00   = 1000 paise
₹100.00  = 10000 paise
₹1000.00 = 100000 paise
```

---

## 🧾 Tax Calculation

### Intra-State (CGST + SGST)
```javascript
{
  tax_details: {
    cgst: 9,  // 9%
    sgst: 9   // 9%
  }
}
// Total tax: 18%
```

### Inter-State (IGST)
```javascript
{
  tax_details: {
    igst: 18  // 18%
  }
}
// Total tax: 18%
```

---

## 💸 Discounts

### Percentage Discount
```javascript
{
  discount_details: {
    type: 'percentage',
    value: 10,
    reason: 'Early bird discount'
  }
}
// 10% off subtotal
```

### Fixed Amount Discount
```javascript
{
  discount_details: {
    type: 'fixed',
    value: 5000,  // ₹50.00 in paise
    reason: 'Scholarship'
  }
}
// ₹50.00 off
```

---

## 📊 Common Operations

### Get Invoice by ID
```javascript
const response = await fetch(
  `/api/v1/invoices/${invoiceId}?tenant_id=${tenantId}`
);
const { invoice } = await response.json();
```

### Get Invoice by Number
```javascript
const response = await fetch(
  `/api/v1/invoices/number/INV-2026-02-0001?tenant_id=${tenantId}`
);
const { invoice } = await response.json();
```

### List Student Invoices
```javascript
const response = await fetch(
  `/api/v1/invoices?tenant_id=${tenantId}&student_id=${studentId}`
);
const { invoices } = await response.json();
```

### Update Status
```javascript
await fetch(`/api/v1/invoices/${invoiceId}/status`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tenant_id: tenantId,
    status: 'paid'
  })
});
```

### Download PDF
```javascript
window.open(
  `/api/v1/invoices/${invoiceId}/pdf?tenant_id=${tenantId}`,
  '_blank'
);
```

### Check for Gaps
```javascript
const response = await fetch(
  `/api/v1/invoices/gaps/detect?tenant_id=${tenantId}`
);
const { gaps, has_gaps } = await response.json();

if (has_gaps) {
  console.warn('Invoice sequence has gaps!', gaps);
}
```

---

## 🎯 Invoice Statuses

| Status | Description |
|--------|-------------|
| `draft` | Invoice is being prepared |
| `issued` | Invoice sent to student |
| `paid` | Payment received |
| `cancelled` | Invoice cancelled |
| `refunded` | Payment refunded |

---

## 🔢 Invoice Number Format

```
INV-{YYYY}-{MM}-{NNNN}

Examples:
INV-2026-02-0001  (First invoice in Feb 2026)
INV-2026-02-0002  (Second invoice)
INV-2026-03-0001  (First invoice in Mar 2026)
```

- Sequential per tenant per month
- No gaps allowed
- Thread-safe generation

---

## ⚠️ Common Pitfalls

### ❌ Wrong: Amount in Rupees
```javascript
unit_price: 1000  // This is ₹10.00, not ₹1000.00!
```

### ✅ Correct: Amount in Paise
```javascript
unit_price: 100000  // ₹1000.00
```

### ❌ Wrong: Missing Required Fields
```javascript
{
  tenant_id: 'uuid',
  // Missing student_id and line_items!
}
```

### ✅ Correct: All Required Fields
```javascript
{
  tenant_id: 'uuid',
  student_id: 'uuid',
  line_items: [...]
}
```

### ❌ Wrong: Invalid Line Item
```javascript
{
  description: 'Fee'
  // Missing quantity and unit_price!
}
```

### ✅ Correct: Complete Line Item
```javascript
{
  description: 'Tuition Fee',
  quantity: 1,
  unit_price: 100000
}
```

---

## 🧪 Testing

```bash
# Test invoice service
npm test -- src/services/paymentService.invoice.test.js

# Test invoice routes
npm test -- src/routes/invoices.test.js
```

---

## 📚 Full Documentation

For complete documentation, see:
- [Invoice Generation System](./INVOICE_GENERATION.md)
- [Payment Gateway Integration](./PAYMENT_GATEWAY.md)
- [Task Implementation Summary](./tasks/TASK_4.1.3_IMPLEMENTATION_SUMMARY.md)

---

## 🆘 Troubleshooting

### Issue: "Database client is required"
**Solution**: Pass the database client to service methods
```javascript
const client = await pool.connect();
await paymentService.generateInvoice({...}, client);
client.release();
```

### Issue: "Line items are required"
**Solution**: Provide at least one line item
```javascript
line_items: [
  { description: 'Fee', quantity: 1, unit_price: 100000 }
]
```

### Issue: "Total amount cannot be negative"
**Solution**: Ensure discount doesn't exceed subtotal
```javascript
// If subtotal is ₹100, discount can't be ₹150
```

### Issue: Gaps in sequence
**Solution**: Run gap detection and investigate
```javascript
const { gaps } = await fetch(
  '/api/v1/invoices/gaps/detect?tenant_id=uuid'
).then(r => r.json());
```

---

## 💡 Pro Tips

1. **Always check for gaps** after bulk operations
2. **Set due dates** for better payment tracking
3. **Use meaningful descriptions** in line items
4. **Track status changes** for audit trail
5. **Generate PDFs** immediately after issuing
6. **Test with small amounts** first (e.g., ₹1.00 = 100 paise)

---

## 🎓 Example: Complete Invoice Flow

```javascript
// 1. Generate invoice
const createResponse = await fetch('/api/v1/invoices', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tenant_id: 'tenant-uuid',
    student_id: 'student-uuid',
    line_items: [
      { description: 'Tuition Fee', quantity: 1, unit_price: 100000 },
      { description: 'Lab Fee', quantity: 1, unit_price: 20000 }
    ],
    tax_details: { cgst: 9, sgst: 9 },
    discount_details: { type: 'percentage', value: 10 },
    due_date: '2026-03-07'
  })
});

const { invoice } = await createResponse.json();
console.log(`Created: ${invoice.invoice_number}`);

// 2. Download PDF
window.open(
  `/api/v1/invoices/${invoice.id}/pdf?tenant_id=tenant-uuid`,
  '_blank'
);

// 3. Mark as paid when payment received
await fetch(`/api/v1/invoices/${invoice.id}/status`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tenant_id: 'tenant-uuid',
    status: 'paid'
  })
});

console.log('Invoice marked as paid!');
```

---

**Need Help?** Check the [full documentation](./INVOICE_GENERATION.md) or [implementation summary](./tasks/TASK_4.1.3_IMPLEMENTATION_SUMMARY.md).
