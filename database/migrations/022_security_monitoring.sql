-- Migration 022: Security Monitoring and Incident Response
-- Task: 4.3.5 - Setup security monitoring and incident response
-- 
-- This migration creates tables and functions for:
-- - Security event tracking
-- - Real-time alerting
-- - Incident management
-- - SIEM integration
-- - Compliance reporting

-- ============================================================================
-- SECURITY EVENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID,
  event_data JSONB NOT NULL DEFAULT '{}',
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  audit_log_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_security_events_tenant ON security_events(tenant_id);
CREATE INDEX idx_security_events_user ON security_events(user_id);
CREATE INDEX idx_security_events_type ON security_events(event_type);
CREATE INDEX idx_security_events_severity ON security_events(severity);
CREATE INDEX idx_security_events_detected_at ON security_events(detected_at DESC);
CREATE INDEX idx_security_events_event_data ON security_events USING gin(event_data);

-- Row-Level Security
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see events for their tenant
CREATE POLICY security_events_tenant_isolation ON security_events
  FOR SELECT
  USING (
    tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID
    OR current_setting('app.current_user_role', TRUE) = 'superadmin'
  );

-- Policy: Only system can insert security events
CREATE POLICY security_events_system_insert ON security_events
  FOR INSERT
  WITH CHECK (TRUE);

COMMENT ON TABLE security_events IS 'Security events detected by the monitoring system';
COMMENT ON COLUMN security_events.event_type IS 'Type of security event (brute_force, privilege_escalation, etc.)';
COMMENT ON COLUMN security_events.severity IS 'Severity level: low, medium, high, critical';
COMMENT ON COLUMN security_events.event_data IS 'Additional event details in JSON format';
COMMENT ON COLUMN security_events.detected_at IS 'When the event was detected';

-- ============================================================================
-- SECURITY ALERTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS security_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  message TEXT NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID,
  context JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'false_positive')),
  resolved_by UUID,
  resolution TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_security_alerts_tenant ON security_alerts(tenant_id);
CREATE INDEX idx_security_alerts_user ON security_alerts(user_id);
CREATE INDEX idx_security_alerts_type ON security_alerts(alert_type);
CREATE INDEX idx_security_alerts_severity ON security_alerts(severity);
CREATE INDEX idx_security_alerts_status ON security_alerts(status);
CREATE INDEX idx_security_alerts_created_at ON security_alerts(created_at DESC);

-- Row-Level Security
ALTER TABLE security_alerts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see alerts for their tenant
CREATE POLICY security_alerts_tenant_isolation ON security_alerts
  FOR SELECT
  USING (
    tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID
    OR current_setting('app.current_user_role', TRUE) = 'superadmin'
  );

-- Policy: Only authorized users can update alerts
CREATE POLICY security_alerts_update ON security_alerts
  FOR UPDATE
  USING (
    tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID
    AND current_setting('app.current_user_role', TRUE) IN ('superadmin', 'admin', 'security_officer')
  );

COMMENT ON TABLE security_alerts IS 'Security alerts requiring human attention';
COMMENT ON COLUMN security_alerts.status IS 'Alert status: open, investigating, resolved, false_positive';
COMMENT ON COLUMN security_alerts.context IS 'Additional context for the alert';

-- ============================================================================
-- INCIDENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS security_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_number VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'contained', 'resolved', 'closed')),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  reported_by UUID NOT NULL,
  assigned_to UUID,
  incident_type VARCHAR(100) NOT NULL,
  affected_systems TEXT[],
  affected_users UUID[],
  root_cause TEXT,
  remediation_steps TEXT,
  lessons_learned TEXT,
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL,
  reported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_security_incidents_tenant ON security_incidents(tenant_id);
CREATE INDEX idx_security_incidents_status ON security_incidents(status);
CREATE INDEX idx_security_incidents_severity ON security_incidents(severity);
CREATE INDEX idx_security_incidents_assigned_to ON security_incidents(assigned_to);
CREATE INDEX idx_security_incidents_detected_at ON security_incidents(detected_at DESC);

-- Row-Level Security
ALTER TABLE security_incidents ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see incidents for their tenant
CREATE POLICY security_incidents_tenant_isolation ON security_incidents
  FOR SELECT
  USING (
    tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID
    OR current_setting('app.current_user_role', TRUE) = 'superadmin'
  );

COMMENT ON TABLE security_incidents IS 'Security incidents requiring investigation and response';
COMMENT ON COLUMN security_incidents.incident_number IS 'Unique incident identifier (e.g., INC-2026-001)';
COMMENT ON COLUMN security_incidents.status IS 'Incident lifecycle status';

-- ============================================================================
-- INCIDENT TIMELINE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS incident_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES security_incidents(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  performed_by UUID NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_incident_timeline_incident ON incident_timeline(incident_id);
CREATE INDEX idx_incident_timeline_created_at ON incident_timeline(created_at DESC);

COMMENT ON TABLE incident_timeline IS 'Timeline of events for each security incident';

-- ============================================================================
-- ALERT RULES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  conditions JSONB NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  notification_channels TEXT[] NOT NULL DEFAULT ARRAY['email'],
  recipients TEXT[] NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_alert_rules_tenant ON alert_rules(tenant_id);
CREATE INDEX idx_alert_rules_event_type ON alert_rules(event_type);
CREATE INDEX idx_alert_rules_enabled ON alert_rules(enabled);

-- Row-Level Security
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see rules for their tenant
CREATE POLICY alert_rules_tenant_isolation ON alert_rules
  FOR SELECT
  USING (
    tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID
    OR current_setting('app.current_user_role', TRUE) = 'superadmin'
  );

COMMENT ON TABLE alert_rules IS 'Configurable rules for security alerting';
COMMENT ON COLUMN alert_rules.conditions IS 'JSON conditions for triggering the alert';
COMMENT ON COLUMN alert_rules.notification_channels IS 'Channels to send notifications (email, sms, slack, etc.)';

-- ============================================================================
-- THREAT INTELLIGENCE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS threat_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  threat_type VARCHAR(100) NOT NULL,
  indicator_type VARCHAR(50) NOT NULL CHECK (indicator_type IN ('ip', 'domain', 'email', 'hash', 'url')),
  indicator_value TEXT NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT,
  source VARCHAR(255),
  first_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  confidence_score INTEGER CHECK (confidence_score BETWEEN 0 AND 100),
  metadata JSONB NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_threat_intelligence_type ON threat_intelligence(threat_type);
CREATE INDEX idx_threat_intelligence_indicator ON threat_intelligence(indicator_type, indicator_value);
CREATE INDEX idx_threat_intelligence_active ON threat_intelligence(active);
CREATE INDEX idx_threat_intelligence_severity ON threat_intelligence(severity);

COMMENT ON TABLE threat_intelligence IS 'Threat intelligence indicators for proactive defense';
COMMENT ON COLUMN threat_intelligence.indicator_type IS 'Type of indicator: ip, domain, email, hash, url';
COMMENT ON COLUMN threat_intelligence.confidence_score IS 'Confidence in the threat (0-100)';

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to generate incident number
CREATE OR REPLACE FUNCTION generate_incident_number()
RETURNS TEXT AS $$
DECLARE
  year TEXT;
  month TEXT;
  sequence INTEGER;
  incident_num TEXT;
BEGIN
  year := TO_CHAR(NOW(), 'YYYY');
  month := TO_CHAR(NOW(), 'MM');
  
  -- Get next sequence number for this month
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(incident_number FROM 'INC-\d{4}-\d{2}-(\d+)') AS INTEGER)
  ), 0) + 1
  INTO sequence
  FROM security_incidents
  WHERE incident_number LIKE 'INC-' || year || '-' || month || '-%';
  
  incident_num := 'INC-' || year || '-' || month || '-' || LPAD(sequence::TEXT, 4, '0');
  
  RETURN incident_num;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_security_alerts_updated_at
  BEFORE UPDATE ON security_alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_security_incidents_updated_at
  BEFORE UPDATE ON security_incidents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alert_rules_updated_at
  BEFORE UPDATE ON alert_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_threat_intelligence_updated_at
  BEFORE UPDATE ON threat_intelligence
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS FOR REPORTING
-- ============================================================================

-- View: Security Dashboard Summary
CREATE OR REPLACE VIEW security_dashboard_summary AS
SELECT
  COUNT(*) FILTER (WHERE detected_at >= NOW() - INTERVAL '24 hours') as events_last_24h,
  COUNT(*) FILTER (WHERE detected_at >= NOW() - INTERVAL '7 days') as events_last_7d,
  COUNT(*) FILTER (WHERE severity = 'critical' AND detected_at >= NOW() - INTERVAL '24 hours') as critical_events_24h,
  COUNT(*) FILTER (WHERE severity = 'high' AND detected_at >= NOW() - INTERVAL '24 hours') as high_events_24h,
  COUNT(DISTINCT event_type) as unique_event_types,
  COUNT(DISTINCT user_id) as affected_users
FROM security_events;

-- View: Open Alerts Summary
CREATE OR REPLACE VIEW open_alerts_summary AS
SELECT
  severity,
  COUNT(*) as count,
  MIN(created_at) as oldest_alert,
  MAX(created_at) as newest_alert
FROM security_alerts
WHERE status = 'open'
GROUP BY severity;

-- View: Incident Response Metrics
CREATE OR REPLACE VIEW incident_response_metrics AS
SELECT
  status,
  severity,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (COALESCE(resolved_at, NOW()) - detected_at))/3600) as avg_resolution_hours,
  MIN(detected_at) as oldest_incident,
  MAX(detected_at) as newest_incident
FROM security_incidents
WHERE detected_at >= NOW() - INTERVAL '30 days'
GROUP BY status, severity;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant permissions to application role
GRANT SELECT, INSERT ON security_events TO eduos_app;
GRANT SELECT, INSERT, UPDATE ON security_alerts TO eduos_app;
GRANT SELECT, INSERT, UPDATE ON security_incidents TO eduos_app;
GRANT SELECT, INSERT ON incident_timeline TO eduos_app;
GRANT SELECT, INSERT, UPDATE ON alert_rules TO eduos_app;
GRANT SELECT ON threat_intelligence TO eduos_app;

GRANT SELECT ON security_dashboard_summary TO eduos_app;
GRANT SELECT ON open_alerts_summary TO eduos_app;
GRANT SELECT ON incident_response_metrics TO eduos_app;

-- ============================================================================
-- SAMPLE DATA (for testing)
-- ============================================================================

-- Insert sample alert rules
INSERT INTO alert_rules (
  name, description, event_type, conditions, severity, 
  notification_channels, recipients, created_by
) VALUES
  (
    'Brute Force Detection',
    'Alert on brute force login attempts',
    'brute_force_attempt',
    '{"threshold": 5, "window_minutes": 15}'::JSONB,
    'high',
    ARRAY['email', 'slack'],
    ARRAY['security@example.com'],
    '00000000-0000-0000-0000-000000000000'
  ),
  (
    'Privilege Escalation',
    'Alert on suspicious privilege escalation',
    'privilege_escalation',
    '{"monitor_self_escalation": true}'::JSONB,
    'critical',
    ARRAY['email', 'sms', 'pagerduty'],
    ARRAY['security@example.com', 'admin@example.com'],
    '00000000-0000-0000-0000-000000000000'
  ),
  (
    'Bulk Data Access',
    'Alert on bulk data access patterns',
    'bulk_data_access',
    '{"threshold": 100, "resource_types": ["student", "payment"]}'::JSONB,
    'medium',
    ARRAY['email'],
    ARRAY['security@example.com'],
    '00000000-0000-0000-0000-000000000000'
  );

COMMENT ON COLUMN alert_rules.name IS 'Human-readable name for the alert rule';
COMMENT ON COLUMN alert_rules.conditions IS 'JSON conditions that trigger the alert';
