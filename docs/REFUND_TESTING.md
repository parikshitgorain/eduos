# Refund Workflow Testing Guide

## Quick Start

Run all refund tests:
```bash
npm test -- --testPathPattern="refunds"
```

## Test Suites

### 1. Route Tests
Test the API endpoints for refund workflow.

**File**: `src/routes/refunds.test.js`

**Run**:
```bash
npm test -- src/routes/refunds.test.js
```

**Coverage**: 18 tests covering:
- POST /api/v1/refunds (create refund request)
- GET /api/v1/refunds/:id (get refund by ID)
- GET /api/v1/refunds (list refunds with filtering)
- POST /api/v1/refunds/:id/approve (approval chain)
- POST /api/v1/refunds/:id/reject (rejection)
- POST /api/v1/refunds/:id/process (process refund)
- GET /api/v1/refunds/:id/history (approval history)

### 2. Service Tests
Test the payment service refund methods.

**File**: `src/services/paymentService.refund.test.js`

**Run**:
```bash
npm test -- src/services/paymentService.refund.test.js
```

**Coverage**: 18 tests covering:
- createRefundRequest()
- getRefundRequest()
- listRefundRequests()
- approveRefundRequest() (all approval chain scenarios)
- rejectRefundRequest()
- processRefund()
- getRefundApprovalHistory()
- formatRefundRequest()

## Test Results

### Current Status: ✅ All Tests Passing

```
Test Suites: 2 passed, 2 total
Tests:       36 passed, 36 total
Snapshots:   0 total
Time:        ~2.8s
```

### Coverage Metrics

**Routes (refunds.js)**:
- Statements: 77.98%
- Branches: 62%
- Functions: 100%
- Lines: 77.98%

**Service (paymentService.js)**:
- Statements: 41.59% (includes all payment methods, not just refunds)
- Branches: 32.58%
- Functions: 31.11%
- Lines: 41.61%

## Running Tests with Coverage

### Full Coverage Report
```bash
npm test -- src/routes/refunds.test.js src/services/paymentService.refund.test.js
```

### Without Coverage (Faster)
```bash
npm test -- src/routes/refunds.test.js src/services/paymentService.refund.test.js --no-coverage
```

## Test Scenarios

### Approval Chain Tests

#### 1. Teacher Approval
```javascript
// Test: Teacher approves refund request
POST /api/v1/refunds/:id/approve
{
  "approver_role": "teacher",
  "approver_id": "teacher-uuid",
  "comments": "Approved"
}
// Expected: teacher_approved_by set, status remains 'pending'
```

#### 2. Admin Approval (After Teacher)
```javascript
// Test: Admin approves after teacher
POST /api/v1/refunds/:id/approve
{
  "approver_role": "admin",
  "approver_id": "admin-uuid"
}
// Expected: admin_approved_by set, status remains 'pending'
```

#### 3. Finance Manager Approval (Final)
```javascript
// Test: Finance manager approves (final step)
POST /api/v1/refunds/:id/approve
{
  "approver_role": "finance_manager",
  "approver_id": "finance-uuid"
}
// Expected: finance_approved_by set, status changes to 'approved'
```

#### 4. Approval Chain Validation
```javascript
// Test: Admin tries to approve without teacher approval
// Expected: Error "Teacher approval required first"

// Test: Finance tries to approve without teacher and admin
// Expected: Error "Teacher and Admin approval required first"
```

### Rejection Tests

```javascript
// Test: Teacher rejects refund
POST /api/v1/refunds/:id/reject
{
  "approver_role": "teacher",
  "approver_id": "teacher-uuid",
  "rejection_reason": "Insufficient documentation"
}
// Expected: status changes to 'rejected', rejection_reason stored
```

### Processing Tests

```javascript
// Test: Process approved refund
POST /api/v1/refunds/:id/process
{
  "processed_by": "finance-uuid"
}
// Expected: 
// - Refund executed with gateway
// - Status changes to 'processed'
// - gateway_refund_id stored
// - Credit note generated (if invoice exists)
```

### Validation Tests

```javascript
// Test: Create refund without payment_id or invoice_id
// Expected: 400 Bad Request

// Test: Create refund with invalid refund_type
// Expected: 400 Bad Request

// Test: Create refund with negative amount
// Expected: 400 Bad Request

// Test: Reject without rejection_reason
// Expected: 400 Bad Request
```

## Debugging Tests

### View Test Output
```bash
npm test -- src/routes/refunds.test.js --verbose
```

### Run Single Test
```bash
npm test -- src/routes/refunds.test.js -t "should create a refund request successfully"
```

### Watch Mode (Auto-rerun on changes)
```bash
npm test -- src/routes/refunds.test.js --watch
```

## Mock Data

### Sample Refund Request
```javascript
{
  id: '550e8400-e29b-41d4-a716-446655440000',
  tenant_id: 'test-tenant-id',
  payment_id: '550e8400-e29b-41d4-a716-446655440001',
  invoice_id: null,
  refund_amount: 50000, // ₹500.00 in paise
  currency: 'INR',
  refund_type: 'partial',
  reason: 'Customer requested partial refund',
  supporting_documents: ['doc1.pdf'],
  status: 'pending',
  requested_by: '550e8400-e29b-41d4-a716-446655440002',
  created_at: '2026-02-07T10:00:00Z'
}
```

### Sample Approval History
```javascript
[
  {
    id: 'history-1',
    approver_role: 'teacher',
    approver_id: 'teacher-uuid',
    action: 'approved',
    comments: 'Looks good',
    created_at: '2026-02-07T10:05:00Z'
  },
  {
    id: 'history-2',
    approver_role: 'admin',
    approver_id: 'admin-uuid',
    action: 'approved',
    comments: null,
    created_at: '2026-02-07T10:15:00Z'
  },
  {
    id: 'history-3',
    approver_role: 'finance_manager',
    approver_id: 'finance-uuid',
    action: 'approved',
    comments: 'Final approval',
    created_at: '2026-02-07T10:25:00Z'
  }
]
```

## Continuous Integration

### GitHub Actions Example
```yaml
name: Refund Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm test -- --testPathPattern="refunds"
```

## Troubleshooting

### Tests Failing?

1. **Check Node Version**: Requires Node.js 16+
   ```bash
   node --version
   ```

2. **Clear Jest Cache**:
   ```bash
   npm test -- --clearCache
   ```

3. **Reinstall Dependencies**:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

4. **Check Mock Setup**: Ensure payment service is properly mocked
   ```javascript
   jest.mock('../services/paymentService');
   ```

### Common Issues

**Issue**: "Cannot find module"
**Solution**: Check import paths are correct

**Issue**: "Timeout exceeded"
**Solution**: Increase Jest timeout in jest.config.js

**Issue**: "Database client is required"
**Solution**: Ensure mockDb is properly set up in beforeEach

## Best Practices

1. **Always run tests before committing**:
   ```bash
   npm test -- --testPathPattern="refunds"
   ```

2. **Write tests for new features**: Follow existing test patterns

3. **Keep tests isolated**: Each test should be independent

4. **Use descriptive test names**: Clearly state what is being tested

5. **Mock external dependencies**: Don't make real API calls in tests

6. **Test error cases**: Not just happy paths

7. **Maintain test data**: Keep mock data realistic and consistent

## Next Steps

1. Add integration tests with real database
2. Add end-to-end tests with Cypress/Playwright
3. Add performance tests for bulk operations
4. Add security tests for authorization
5. Add load tests for concurrent refund processing

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Testing Best Practices](https://testingjavascript.com/)
- [EduOS Refund Workflow Documentation](./REFUND_WORKFLOW.md)

---

**Last Updated**: 2026-02-07  
**Test Score**: 100% (36/36 tests passing)
