# Bank Reconciliation Quick Start Guide

## Overview

This guide will help you get started with the Bank Reconciliation feature in 5 minutes.

## Prerequisites

- EduOS Platform installed and running
- Database migration 019 applied
- Finance Manager role access
- Bank statement in CSV format

## Step 1: Run Database Migration

```bash
# Run migration
node database/run_migration_019.js

# Verify tables created
psql -d eduos -c "SELECT tablename FROM pg_tables WHERE tablename LIKE 'bank_%' OR tablename LIKE 'reconciliation_%';"
```

Expected output:
```
bank_accounts
bank_reconciliation_sessions
bank_transactions
reconciliation_matches
reconciliation_discrepancies
```

## Step 2: Prepare Your Bank Statement

### CSV Format

Your bank statement CSV should have these columns (names can vary):

- **Date** (required): Transaction date
- **Reference**: Transaction reference number
- **Description**: Transaction description
- **Debit/Withdrawal**: Debit amount
- **Credit/Deposit**: Credit amount
- **Balance**: Account balance

### Example CSV

```csv
Date,Reference,Description,Debit,Credit,Balance
2026-02-01,TXN001,Payment received,0,5000.00,10000.00
2026-02-01,TXN002,Payment received,0,3000.00,13000.00
2026-02-02,TXN003,Withdrawal,2000.00,0,11000.00
```

## Step 3: Upload Bank Statement

### Using API

```bash
curl -X POST http://localhost:3000/api/v1/finance/reconciliation/upload \
  -H "Content-Type: multipart/form-data" \
  -F "file=@bank_statement.csv" \
  -F "bank_account_id=your-bank-account-uuid" \
  -F "statement_date=2026-02-01" \
  -F "tenant_id=your-tenant-uuid"
```

### Response

```json
{
  "success": true,
  "data": {
    "session": {
      "id": "session-uuid",
      "status": "in_progress",
      "total_bank_transactions": 25
    },
    "transactions_count": 25
  }
}
```

## Step 4: Perform Automatic Reconciliation

```bash
curl -X POST http://localhost:3000/api/v1/finance/reconciliation/session-uuid/reconcile \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": "your-tenant-uuid"}'
```

### Response

```json
{
  "success": true,
  "data": {
    "matched": 20,
    "unmatched_bank": 3,
    "unmatched_system": 1,
    "discrepancies": 1
  }
}
```

## Step 5: Review Results

### Get Session Details

```bash
curl http://localhost:3000/api/v1/finance/reconciliation/session-uuid?tenant_id=your-tenant-uuid
```

### What to Look For

- ✅ **Matched (Green)**: Perfect matches, no action needed
- ⚠️ **Discrepancies (Yellow)**: Amount mismatches, needs investigation
- ❌ **Unmatched Bank (Red)**: Bank transactions with no system payment
- ❌ **Unmatched System (Red)**: System payments with no bank transaction

## Step 6: Manual Matching (If Needed)

For unmatched transactions:

```bash
curl -X POST http://localhost:3000/api/v1/finance/reconciliation/session-uuid/manual-match \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "your-tenant-uuid",
    "bank_transaction_id": "bank-txn-uuid",
    "payment_id": "payment-uuid",
    "notes": "Manual match - reference number mismatch",
    "resolved_by": "user-uuid"
  }'
```

## Step 7: Complete Reconciliation

```bash
curl -X POST http://localhost:3000/api/v1/finance/reconciliation/session-uuid/complete \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "your-tenant-uuid",
    "reconciled_by": "user-uuid"
  }'
```

## Step 8: Export Report

```bash
curl http://localhost:3000/api/v1/finance/reconciliation/session-uuid/export?tenant_id=your-tenant-uuid \
  -o reconciliation_report.html
```

Open `reconciliation_report.html` in your browser or convert to PDF.

## Common Issues

### Issue: "CSV must contain a date column"

**Solution**: Ensure your CSV has a column with "date" in the name.

### Issue: "No matches found"

**Possible causes:**
- Statement date doesn't match payment dates
- Transaction references are different
- Payments not yet processed in system

**Solution**: Check date range and verify payments exist in system.

### Issue: "Too many discrepancies"

**Possible causes:**
- Gateway fees not accounted for
- Currency conversion issues
- Rounding differences

**Solution**: Review gateway fee structure and adjust if needed.

## Testing

### Run Tests

```bash
npm test -- src/routes/reconciliation.test.js
```

All 19 tests should pass.

## Next Steps

1. **Automate**: Set up daily reconciliation jobs
2. **Integrate**: Connect with accounting software
3. **Monitor**: Set up alerts for discrepancies
4. **Train**: Train finance team on manual matching

## Support

For detailed documentation, see [BANK_RECONCILIATION.md](./BANK_RECONCILIATION.md)

For issues:
- Check logs: `tail -f logs/reconciliation.log`
- Review session details via API
- Contact support with session ID

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/finance/reconciliation/upload` | POST | Upload bank statement |
| `/api/v1/finance/reconciliation/:id/reconcile` | POST | Perform reconciliation |
| `/api/v1/finance/reconciliation/:id` | GET | Get session details |
| `/api/v1/finance/reconciliation` | GET | List sessions |
| `/api/v1/finance/reconciliation/:id/manual-match` | POST | Manual match |
| `/api/v1/finance/reconciliation/:id/complete` | POST | Complete session |
| `/api/v1/finance/reconciliation/:id/export` | GET | Export report |

---

**Last Updated**: February 7, 2026  
**Version**: 1.0
