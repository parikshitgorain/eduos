-- Rollback Migration 022: Security Monitoring and Incident Response
-- Task: 4.3.5 - Setup security monitoring and incident response

-- Drop views
DROP VIEW IF EXISTS incident_response_metrics;
DROP VIEW IF EXISTS open_alerts_summary;
DROP VIEW IF EXISTS security_dashboard_summary;

-- Drop triggers
DROP TRIGGER IF EXISTS update_threat_intelligence_updated_at ON threat_intelligence;
DROP TRIGGER IF EXISTS update_alert_rules_updated_at ON alert_rules;
DROP TRIGGER IF EXISTS update_security_incidents_updated_at ON security_incidents;
DROP TRIGGER IF EXISTS update_security_alerts_updated_at ON security_alerts;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS generate_incident_number();

-- Drop tables (in reverse order of dependencies)
DROP TABLE IF EXISTS threat_intelligence;
DROP TABLE IF EXISTS alert_rules;
DROP TABLE IF EXISTS incident_timeline;
DROP TABLE IF EXISTS security_incidents;
DROP TABLE IF EXISTS security_alerts;
DROP TABLE IF EXISTS security_events;
