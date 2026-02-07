/**
 * Bank Reconciliation Routes
 * 
 * Handles bank statement upload, automatic matching, and manual reconciliation
 */

const express = require('express');
const multer = require('multer');
const router = express.Router();
const paymentService = require('../services/paymentService');
const { Pool } = require('pg');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept CSV and Excel files
    if (file.mimetype === 'text/csv' || 
        file.mimetype === 'application/vnd.ms-excel' ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed'));
    }
  }
});

// Database pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'eduos',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

/**
 * POST /api/v1/finance/reconciliation/upload
 * Upload bank statement and create reconciliation session
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const { bank_account_id, statement_date, tenant_id, uploaded_by } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    if (!bank_account_id || !statement_date || !tenant_id) {
      return res.status(400).json({
        success: false,
        error: 'bank_account_id, statement_date, and tenant_id are required'
      });
    }

    // Parse CSV file
    const csvContent = req.file.buffer.toString('utf8');
    let transactions;

    try {
      transactions = paymentService.parseBankStatementCSV(csvContent);
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        error: `Failed to parse CSV: ${parseError.message}`
      });
    }

    if (transactions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No transactions found in the uploaded file'
      });
    }

    // Create reconciliation session
    const session = await paymentService.uploadBankStatement({
      tenantId: tenant_id,
      bankAccountId: bank_account_id,
      statementDate: new Date(statement_date),
      fileName: req.file.originalname,
      fileUrl: null, // Could be S3 URL if we upload to storage
      transactions: transactions,
      uploadedBy: uploaded_by || null
    }, pool);

    res.status(201).json({
      success: true,
      data: {
        session: session,
        transactions_count: transactions.length
      }
    });
  } catch (error) {
    console.error('Upload bank statement error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/v1/finance/reconciliation/:sessionId/reconcile
 * Perform automatic reconciliation
 */
router.post('/:sessionId/reconcile', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { tenant_id } = req.body;

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        error: 'tenant_id is required'
      });
    }

    // Perform reconciliation
    const results = await paymentService.performReconciliation(sessionId, tenant_id, pool);

    res.json({
      success: true,
      data: {
        matched: results.matched.length,
        unmatched_bank: results.unmatched_bank.length,
        unmatched_system: results.unmatched_system.length,
        discrepancies: results.discrepancies.length,
        details: results
      }
    });
  } catch (error) {
    console.error('Reconciliation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/finance/reconciliation/:sessionId
 * Get reconciliation session details
 */
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { tenant_id } = req.query;

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        error: 'tenant_id is required'
      });
    }

    const session = await paymentService.getReconciliationSession(sessionId, tenant_id, pool);

    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error('Get reconciliation session error:', error);
    
    if (error.message === 'Reconciliation session not found') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/finance/reconciliation
 * List reconciliation sessions
 */
router.get('/', async (req, res) => {
  try {
    const { tenant_id, status, bank_account_id, limit, offset } = req.query;

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        error: 'tenant_id is required'
      });
    }

    const sessions = await paymentService.listReconciliationSessions(tenant_id, pool, {
      status,
      bankAccountId: bank_account_id,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0
    });

    res.json({
      success: true,
      data: sessions,
      count: sessions.length
    });
  } catch (error) {
    console.error('List reconciliation sessions error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/v1/finance/reconciliation/:sessionId/manual-match
 * Manually match a bank transaction with a payment
 */
router.post('/:sessionId/manual-match', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { tenant_id, bank_transaction_id, payment_id, notes, resolved_by } = req.body;

    if (!tenant_id || !bank_transaction_id || !payment_id) {
      return res.status(400).json({
        success: false,
        error: 'tenant_id, bank_transaction_id, and payment_id are required'
      });
    }

    const match = await paymentService.manuallyMatchTransaction({
      sessionId,
      bankTransactionId: bank_transaction_id,
      paymentId: payment_id,
      notes: notes || null,
      resolvedBy: resolved_by || null,
      tenantId: tenant_id
    }, pool);

    res.json({
      success: true,
      data: match
    });
  } catch (error) {
    console.error('Manual match error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/v1/finance/reconciliation/:sessionId/complete
 * Complete reconciliation session
 */
router.post('/:sessionId/complete', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { tenant_id, reconciled_by } = req.body;

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        error: 'tenant_id is required'
      });
    }

    const session = await paymentService.completeReconciliation(
      sessionId,
      tenant_id,
      reconciled_by || null,
      pool
    );

    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error('Complete reconciliation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/finance/reconciliation/:sessionId/export
 * Export reconciliation report as PDF
 */
router.get('/:sessionId/export', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { tenant_id } = req.query;

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        error: 'tenant_id is required'
      });
    }

    // Get session details
    const session = await paymentService.getReconciliationSession(sessionId, tenant_id, pool);

    // Generate PDF report (simplified HTML for now)
    const html = generateReconciliationReportHTML(session);

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="reconciliation-${sessionId}.html"`);
    res.send(html);
  } catch (error) {
    console.error('Export reconciliation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Generate reconciliation report HTML
 */
function generateReconciliationReportHTML(session) {
  const formatCurrency = (amount) => {
    return `₹${parseFloat(amount).toFixed(2)}`;
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const matchedRows = session.matches
    .filter(m => m.match_type === 'matched')
    .map(m => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${formatDate(m.bank_transaction?.date)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${m.bank_transaction?.reference || 'N/A'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${formatCurrency(m.bank_transaction?.credit_amount || 0)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${m.payment?.gateway_transaction_id || 'N/A'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${formatCurrency((m.payment?.amount || 0) / 100)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;"><span style="color: green;">✓</span></td>
      </tr>
    `).join('');

  const unmatchedBankRows = session.matches
    .filter(m => m.match_type === 'unmatched_bank')
    .map(m => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${formatDate(m.bank_transaction?.date)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${m.bank_transaction?.reference || 'N/A'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${m.bank_transaction?.description || 'N/A'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${formatCurrency(m.bank_transaction?.credit_amount || 0)}</td>
      </tr>
    `).join('');

  const unmatchedSystemRows = session.matches
    .filter(m => m.match_type === 'unmatched_system')
    .map(m => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${m.payment?.gateway_transaction_id || 'N/A'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${formatCurrency((m.payment?.amount || 0) / 100)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${m.payment?.status || 'N/A'}</td>
      </tr>
    `).join('');

  const discrepancyRows = session.matches
    .filter(m => m.match_type === 'discrepancy')
    .map(m => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${m.bank_transaction?.reference || 'N/A'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${formatCurrency(m.bank_transaction?.credit_amount || 0)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${m.payment?.gateway_transaction_id || 'N/A'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${formatCurrency((m.payment?.amount || 0) / 100)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right; color: red;">${formatCurrency(m.amount_difference || 0)}</td>
      </tr>
    `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Bank Reconciliation Report</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 20px;
      color: #333;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 20px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      margin-bottom: 30px;
    }
    .summary-card {
      border: 1px solid #ddd;
      padding: 15px;
      border-radius: 8px;
      text-align: center;
    }
    .summary-card h3 {
      margin: 0 0 10px 0;
      font-size: 14px;
      color: #666;
    }
    .summary-card .value {
      font-size: 24px;
      font-weight: bold;
      color: #2563eb;
    }
    .section {
      margin-bottom: 40px;
    }
    .section h2 {
      color: #2563eb;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th {
      background-color: #f3f4f6;
      padding: 10px;
      text-align: left;
      border-bottom: 2px solid #ddd;
      font-weight: bold;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      text-align: center;
      color: #666;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Bank Reconciliation Report</h1>
    <p><strong>Session ID:</strong> ${session.id}</p>
    <p><strong>Statement Date:</strong> ${formatDate(session.statement_date)}</p>
    <p><strong>Status:</strong> ${session.status.toUpperCase()}</p>
  </div>

  <div class="summary">
    <div class="summary-card">
      <h3>Total Transactions</h3>
      <div class="value">${session.total_bank_transactions || 0}</div>
    </div>
    <div class="summary-card">
      <h3>Matched</h3>
      <div class="value" style="color: green;">${session.matched_count || 0}</div>
    </div>
    <div class="summary-card">
      <h3>Unmatched</h3>
      <div class="value" style="color: orange;">${(session.unmatched_bank_count || 0) + (session.unmatched_system_count || 0)}</div>
    </div>
    <div class="summary-card">
      <h3>Discrepancies</h3>
      <div class="value" style="color: red;">${session.discrepancy_count || 0}</div>
    </div>
  </div>

  <div class="section">
    <h2>Matched Transactions (${session.matched_count || 0})</h2>
    ${matchedRows ? `
    <table>
      <thead>
        <tr>
          <th>Bank Date</th>
          <th>Bank Reference</th>
          <th style="text-align: right;">Bank Amount</th>
          <th>System Transaction</th>
          <th style="text-align: right;">System Amount</th>
          <th style="text-align: center;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${matchedRows}
      </tbody>
    </table>
    ` : '<p>No matched transactions</p>'}
  </div>

  <div class="section">
    <h2>Unmatched Bank Transactions (${session.unmatched_bank_count || 0})</h2>
    ${unmatchedBankRows ? `
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Reference</th>
          <th>Description</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${unmatchedBankRows}
      </tbody>
    </table>
    ` : '<p>No unmatched bank transactions</p>'}
  </div>

  <div class="section">
    <h2>Unmatched System Payments (${session.unmatched_system_count || 0})</h2>
    ${unmatchedSystemRows ? `
    <table>
      <thead>
        <tr>
          <th>Transaction ID</th>
          <th style="text-align: right;">Amount</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${unmatchedSystemRows}
      </tbody>
    </table>
    ` : '<p>No unmatched system payments</p>'}
  </div>

  <div class="section">
    <h2>Discrepancies (${session.discrepancy_count || 0})</h2>
    ${discrepancyRows ? `
    <table>
      <thead>
        <tr>
          <th>Bank Reference</th>
          <th style="text-align: right;">Bank Amount</th>
          <th>System Transaction</th>
          <th style="text-align: right;">System Amount</th>
          <th style="text-align: right;">Difference</th>
        </tr>
      </thead>
      <tbody>
        ${discrepancyRows}
      </tbody>
    </table>
    ` : '<p>No discrepancies found</p>'}
  </div>

  <div class="footer">
    <p>Generated on ${formatDate(new Date())}</p>
    <p>This is a system-generated report</p>
  </div>
</body>
</html>
  `.trim();
}

module.exports = router;
