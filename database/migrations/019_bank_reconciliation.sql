-- Migration 019: Bank Reconciliation System
-- Description: Implements bank reconciliation functionality for matching bank statements with system payments
-- Version: 1.0
-- Date: 2026-02-07

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- BANK RECONCILIATION TABLES
-- ============================================================================

-- Bank accounts table
CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_name VARCHAR(255) NOT NULL,
  account_number VARCHAR(100) NOT NULL,
  bank_name VARCHAR(255) NOT NULL,
  branch VARCHAR(255),
  ifsc_code VARCHAR(20),
  currency CHAR(3) DEFAULT 'INR',
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, account_number)
);

-- Bank reconciliation sessions table
CREATE TABLE IF NOT EXISTS bank_reconciliation_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  statement_date DATE NOT NULL,
  statement_file_name VARCHAR(500),
  statement_file_url TEXT,
  status VARCHAR(50) DEFAULT 'in_progress', -- in_progress, completed, cancelled
  total_bank_transactions INTEGER DEFAULT 0,
  matched_count INTEGER DEFAULT 0,
  unmatched_bank_count INTEGER DEFAULT 0,
  unmatched_system_count INTEGER DEFAULT 0,
  discrepancy_count INTEGER DEFAULT 0,
  reconciled_by UUID,
  reconciled_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bank transactions table (parsed from uploaded statements)
CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reconciliation_session_id UUID NOT NULL REFERENCES bank_reconciliation_sessions(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  transaction_reference VARCHAR(255),
  description TEXT,
  debit_amount DECIMAL(15, 2) DEFAULT 0,
  credit_amount DECIMAL(15, 2) DEFAULT 0,
  balance DECIMAL(15, 2),
  currency CHAR(3) DEFAULT 'INR',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reconciliation matches table
CREATE TABLE IF NOT EXISTS reconciliation_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reconciliation_session_id UUID NOT NULL REFERENCES bank_reconciliation_sessions(id) ON DELETE CASCADE,
  bank_transaction_id UUID NOT NULL REFERENCES bank_transactions(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
  match_type VARCHAR(50) NOT NULL, -- matched, discrepancy, unmatched_bank, unmatched_system, manual_match
  match_confidence DECIMAL(5, 2), -- 0.00 to 100.00
  amount_difference DECIMAL(15, 2) DEFAULT 0,
  resolution_status VARCHAR(50) DEFAULT 'pending', -- pending, resolved, ignored
  resolution_notes TEXT,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reconciliation discrepancies table
CREATE TABLE IF NOT EXISTS reconciliation_discrepancies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reconciliation_session_id UUID NOT NULL REFERENCES bank_reconciliation_sessions(id) ON DELETE CASCADE,
  reconciliation_match_id UUID NOT NULL REFERENCES reconciliation_matches(id) ON DELETE CASCADE,
  discrepancy_type VARCHAR(100) NOT NULL, -- amount_mismatch, date_mismatch, missing_payment, duplicate_entry
  bank_amount DECIMAL(15, 2),
  system_amount DECIMAL(15, 2),
  difference DECIMAL(15, 2),
  severity VARCHAR(20) DEFAULT 'medium', -- low, medium, high, critical
  alert_sent BOOLEAN DEFAULT false,
  alert_sent_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_bank_accounts_tenant ON bank_accounts(tenant_id);
CREATE INDEX idx_bank_accounts_active ON bank_accounts(tenant_id, is_active);

CREATE INDEX idx_reconciliation_sessions_tenant ON bank_reconciliation_sessions(tenant_id);
CREATE INDEX idx_reconciliation_sessions_bank_account ON bank_reconciliation_sessions(bank_account_id);
CREATE INDEX idx_reconciliation_sessions_status ON bank_reconciliation_sessions(tenant_id, status);
CREATE INDEX idx_reconciliation_sessions_date ON bank_reconciliation_sessions(statement_date);

CREATE INDEX idx_bank_transactions_tenant ON bank_transactions(tenant_id);
CREATE INDEX idx_bank_transactions_session ON bank_transactions(reconciliation_session_id);
CREATE INDEX idx_bank_transactions_reference ON bank_transactions(transaction_reference);
CREATE INDEX idx_bank_transactions_date ON bank_transactions(transaction_date);

CREATE INDEX idx_reconciliation_matches_tenant ON reconciliation_matches(tenant_id);
CREATE INDEX idx_reconciliation_matches_session ON reconciliation_matches(reconciliation_session_id);
CREATE INDEX idx_reconciliation_matches_bank_txn ON reconciliation_matches(bank_transaction_id);
CREATE INDEX idx_reconciliation_matches_payment ON reconciliation_matches(payment_id);
CREATE INDEX idx_reconciliation_matches_type ON reconciliation_matches(match_type);
CREATE INDEX idx_reconciliation_matches_resolution ON reconciliation_matches(resolution_status);

CREATE INDEX idx_reconciliation_discrepancies_tenant ON reconciliation_discrepancies(tenant_id);
CREATE INDEX idx_reconciliation_discrepancies_session ON reconciliation_discrepancies(reconciliation_session_id);
CREATE INDEX idx_reconciliation_discrepancies_severity ON reconciliation_discrepancies(severity);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_reconciliation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_discrepancies ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bank_accounts
CREATE POLICY bank_accounts_tenant_isolation ON bank_accounts
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- RLS Policies for bank_reconciliation_sessions
CREATE POLICY bank_reconciliation_sessions_tenant_isolation ON bank_reconciliation_sessions
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- RLS Policies for bank_transactions
CREATE POLICY bank_transactions_tenant_isolation ON bank_transactions
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- RLS Policies for reconciliation_matches
CREATE POLICY reconciliation_matches_tenant_isolation ON reconciliation_matches
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- RLS Policies for reconciliation_discrepancies
CREATE POLICY reconciliation_discrepancies_tenant_isolation ON reconciliation_discrepancies
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_reconciliation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_bank_accounts_updated_at
  BEFORE UPDATE ON bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_reconciliation_updated_at();

CREATE TRIGGER update_bank_reconciliation_sessions_updated_at
  BEFORE UPDATE ON bank_reconciliation_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_reconciliation_updated_at();

CREATE TRIGGER update_reconciliation_matches_updated_at
  BEFORE UPDATE ON reconciliation_matches
  FOR EACH ROW
  EXECUTE FUNCTION update_reconciliation_updated_at();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update reconciliation session statistics
CREATE OR REPLACE FUNCTION update_reconciliation_session_stats(session_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE bank_reconciliation_sessions
  SET
    matched_count = (
      SELECT COUNT(*) FROM reconciliation_matches
      WHERE reconciliation_session_id = session_id AND match_type = 'matched'
    ),
    unmatched_bank_count = (
      SELECT COUNT(*) FROM reconciliation_matches
      WHERE reconciliation_session_id = session_id AND match_type = 'unmatched_bank'
    ),
    unmatched_system_count = (
      SELECT COUNT(*) FROM reconciliation_matches
      WHERE reconciliation_session_id = session_id AND match_type = 'unmatched_system'
    ),
    discrepancy_count = (
      SELECT COUNT(*) FROM reconciliation_matches
      WHERE reconciliation_session_id = session_id AND match_type = 'discrepancy'
    ),
    updated_at = NOW()
  WHERE id = session_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE bank_accounts IS 'Stores bank account information for each tenant';
COMMENT ON TABLE bank_reconciliation_sessions IS 'Tracks bank reconciliation sessions and their overall status';
COMMENT ON TABLE bank_transactions IS 'Stores parsed bank statement transactions';
COMMENT ON TABLE reconciliation_matches IS 'Stores matches between bank transactions and system payments';
COMMENT ON TABLE reconciliation_discrepancies IS 'Tracks discrepancies found during reconciliation';

COMMENT ON COLUMN reconciliation_matches.match_type IS 'Type of match: matched (perfect match), discrepancy (amount mismatch), unmatched_bank (no system payment), unmatched_system (no bank transaction), manual_match (manually matched by user)';
COMMENT ON COLUMN reconciliation_matches.match_confidence IS 'Confidence score for automatic matches (0-100)';
COMMENT ON COLUMN reconciliation_discrepancies.severity IS 'Severity level: low (minor differences), medium (moderate issues), high (significant problems), critical (requires immediate attention)';
