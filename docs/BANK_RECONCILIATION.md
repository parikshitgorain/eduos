# Bank Reconciliation System

## Overview

The Bank Reconciliation System provides automated and manual tools for matching bank statement transactions with system payment records. This ensures financial accuracy and helps detect discrepancies quickly.

## Features

- ✅ **CSV Upload**: Upload bank statements in CSV format
- ✅ **Automatic Matching**: Intelligent algorithm matches bank transactions with system payments
- ✅ **Manual Matching**: Manually match unmatched transactions
- ✅ **Discrepancy Detection**: Automatically identifies amount mismatches
- ✅ **Reconciliation Reports**: Export detailed reconciliation reports as PDF/HTML
- ✅ **Multi-Tenant Support**: Full tenant isolation with RLS policies

## Architecture

### Database Tables

1. **bank_accounts**: Stores bank account information
2. **bank_reconciliation_sessions**: Tracks reconciliation sessions
3. **bank_transactions**: Parsed bank statement transactions
4. **reconciliation_matches**: Matches between bank and system transactions
5. **reconciliation_discrepancies**: Tracks discrepancies found

### Matching Algorithm

The system uses a scoring algorithm to match transactions:

1. **Reference Matching** (50 points): Exact match on transaction reference
2. **Amount Matching** (40 points): Exact or close amount match
3. **Date Matching** (10 points): Same or nearby date

**Match Threshold**: 70+ points = Good match

### Match Types

- **matched**: Perfect match (amount difference < ₹0.01)
- **discrepancy**: Good match but amount mismatch
- **unmatched_bank**: Bank transaction with no system payment
- **unmatched_system**: System payment with no bank transaction
- **manual_match**: Manually matched by user

## API Endpoints

### 1. Upload Bank Statement

```http
POST /api/v1/finance/reconciliation/upload
Content-Type: multipart/form-data

Parameters:
- file: CSV file (required)
- bank_account_id: UUID (required)
- statement_date: Date (required)
- tenant_id: UUID (required)
- uploaded_by: UUID (optional)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "session-uuid",
      "tenant_id": "tenant-uuid",
      "bank_account_id": "bank-uuid",
      "statement_date": "2026-02-01",
      "total_bank_transactions": 25,
      "status": "in_progress"
    },
    "transactions_count": 25
  }
}
```

### 2. Perform Automatic Reconciliation

```http
POST /api/v1/finance/reconciliation/:sessionId/reconcile

Body:
{
  "tenant_id": "tenant-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "matched": 20,
    "unmatched_bank": 3,
    "unmatched_system": 1,
    "discrepancies": 1,
    "details": {
      "matched": [...],
      "unmatched_bank": [...],
      "unmatched_system": [...],
      "discrepancies": [...]
    }
  }
}
```

### 3. Get Reconciliation Session

```http
GET /api/v1/finance/reconciliation/:sessionId?tenant_id=tenant-uuid
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "session-uuid",
    "status": "completed",
    "matched_count": 20,
    "unmatched_bank_count": 3,
    "unmatched_system_count": 1,
    "discrepancy_count": 1,
    "matches": [...]
  }
}
```

### 4. List Reconciliation Sessions

```http
GET /api/v1/finance/reconciliation?tenant_id=tenant-uuid&status=completed&limit=50&offset=0
```

### 5. Manual Match

```http
POST /api/v1/finance/reconciliation/:sessionId/manual-match

Body:
{
  "tenant_id": "tenant-uuid",
  "bank_transaction_id": "bank-txn-uuid",
  "payment_id": "payment-uuid",
  "notes": "Manual match due to reference mismatch",
  "resolved_by": "user-uuid"
}
```

### 6. Complete Reconciliation

```http
POST /api/v1/finance/reconciliation/:sessionId/complete

Body:
{
  "tenant_id": "tenant-uuid",
  "reconciled_by": "user-uuid"
}
```

### 7. Export Reconciliation Report

```http
GET /api/v1/finance/reconciliation/:sessionId/export?tenant_id=tenant-uuid
```

Returns HTML report that can be converted to PDF.

## CSV Format

### Required Columns

The CSV must contain a **Date** column. Other columns are optional but recommended:

- **Date**: Transaction date (required)
- **Reference/Txn Ref**: Transaction reference number
- **Description/Narration**: Transaction description
- **Debit/Withdrawal**: Debit amount
- **Credit/Deposit**: Credit amount
- **Balance/Closing Balance**: Account balance after transaction

### Example CSV

```csv
Date,Reference,Description,Debit,Credit,Balance
2026-02-01,TXN001,Payment received,0,5000.00,10000.00
2026-02-01,TXN002,Payment received,0,3000.00,13000.00
2026-02-02,TXN003,Withdrawal,2000.00,0,11000.00
```

### Supported Formats

- **Date formats**: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY
- **Amount formats**: 1000.00, 1,000.00, 1000
- **Currency**: INR (Indian Rupee)

## Workflow

### Step 1: Upload Bank Statement

1. Navigate to Finance → Bank Reconciliation
2. Click "Upload Statement"
3. Select bank account
4. Choose statement date
5. Upload CSV file
6. System parses and creates reconciliation session

### Step 2: Automatic Reconciliation

1. Click "Reconcile" on the session
2. System automatically matches transactions
3. Review results:
   - ✅ Matched transactions (green)
   - ⚠️ Discrepancies (yellow)
   - ❌ Unmatched transactions (red)

### Step 3: Manual Resolution

For unmatched transactions:

1. Click on unmatched transaction
2. Search for corresponding payment
3. Click "Match" to create manual match
4. Add notes explaining the match

For discrepancies:

1. Review amount difference
2. Investigate cause (fees, rounding, etc.)
3. Either:
   - Accept discrepancy with notes
   - Correct system payment
   - Contact bank for clarification

### Step 4: Complete Reconciliation

1. Ensure all transactions are resolved
2. Click "Complete Reconciliation"
3. Export report for records

## Discrepancy Alerts

The system automatically sends alerts for discrepancies based on tenant tier:

- **Basic**: 15 minutes
- **Business**: 5 minutes
- **Enterprise**: 1 minute

Alert severity levels:

- **Low**: Difference < ₹10
- **Medium**: Difference ₹10-₹1000
- **High**: Difference > ₹1000
- **Critical**: Missing payments or duplicate entries

## Best Practices

### 1. Regular Reconciliation

- Reconcile daily for high-volume accounts
- Reconcile weekly for low-volume accounts
- Never let reconciliation lag more than 30 days

### 2. CSV Preparation

- Ensure CSV has clear column headers
- Remove any summary rows or totals
- Verify date format consistency
- Check for duplicate transactions

### 3. Manual Matching

- Always add detailed notes
- Document reason for manual match
- Include supporting evidence (email, receipt)
- Get approval for large amounts

### 4. Discrepancy Resolution

- Investigate immediately
- Document resolution steps
- Update system records if needed
- Maintain audit trail

### 5. Report Retention

- Export and save reconciliation reports
- Store for minimum 7 years (Basic) to 99 years (Enterprise)
- Include in monthly financial close process

## Troubleshooting

### Issue: CSV Upload Fails

**Causes:**
- Invalid CSV format
- Missing date column
- File too large (>10MB)
- Unsupported file type

**Solutions:**
- Verify CSV format
- Ensure date column exists
- Split large files
- Convert Excel to CSV

### Issue: No Matches Found

**Causes:**
- Date mismatch
- Reference format different
- Amount in different currency
- Transactions not yet in system

**Solutions:**
- Check statement date range
- Verify transaction references
- Confirm currency (INR)
- Wait for payment processing

### Issue: Too Many Discrepancies

**Causes:**
- Gateway fees not accounted
- Currency conversion
- Rounding differences
- Incorrect payment amounts

**Solutions:**
- Review gateway fee structure
- Check currency settings
- Adjust rounding rules
- Correct payment records

## Security

### Access Control

- Only Finance Manager role can access reconciliation
- Admin can view but not modify
- All actions logged in audit trail
- Tenant isolation enforced via RLS

### Data Protection

- Bank statements encrypted at rest
- Secure file upload (HTTPS only)
- Automatic file deletion after 90 days
- PII redacted in logs

### Audit Trail

Every action is logged:
- Who uploaded statement
- When reconciliation performed
- Manual matches made
- Discrepancies resolved
- Reports exported

## Performance

### Optimization

- Batch processing for large statements
- Indexed database queries
- Cached matching results
- Async report generation

### Limits

- Max file size: 10MB
- Max transactions per session: 10,000
- Concurrent sessions per tenant: 5
- Report generation timeout: 30 seconds

## Integration

### Payment Gateway Integration

The reconciliation system integrates with:

- **Razorpay**: Automatic reference matching
- **Stripe**: Payment intent ID matching
- **Manual Payments**: Custom reference matching

### Accounting Software

Export formats compatible with:

- Tally
- QuickBooks
- Zoho Books
- Custom ERP systems

## Migration

### Database Migration

```bash
# Run migration
node database/run_migration_019.js

# Verify tables
psql -d eduos -c "\dt bank_*"
psql -d eduos -c "\dt reconciliation_*"
```

### Rollback

```bash
# Rollback migration
psql -d eduos -f database/migrations/019_bank_reconciliation_rollback.sql
```

## Support

For issues or questions:

1. Check troubleshooting section
2. Review API documentation
3. Contact support team
4. Submit bug report with:
   - Session ID
   - Error message
   - CSV sample (anonymized)
   - Steps to reproduce

## Roadmap

### Planned Features

- [ ] Excel file support
- [ ] Multi-currency reconciliation
- [ ] AI-powered matching suggestions
- [ ] Automated discrepancy resolution
- [ ] Real-time bank feed integration
- [ ] Mobile app support
- [ ] Bulk reconciliation
- [ ] Advanced analytics dashboard

## Changelog

### Version 1.0 (2026-02-07)

- Initial release
- CSV upload support
- Automatic matching algorithm
- Manual matching
- Discrepancy detection
- HTML report export
- Multi-tenant support
- RLS policies
- Audit logging

---

**Last Updated**: February 7, 2026  
**Version**: 1.0  
**Status**: Production Ready
