-- Rollback Migration 025: Academic Rules System
-- Removes all tables and functions created by migration 025

-- Drop triggers
DROP TRIGGER IF EXISTS trigger_update_academic_rules_updated_at ON academic_rules;

-- Drop functions
DROP FUNCTION IF EXISTS update_academic_rules_updated_at();

-- Drop tables (in reverse order of dependencies)
DROP TABLE IF EXISTS retroactive_policy_requests CASCADE;
DROP TABLE IF EXISTS rule_overrides CASCADE;
DROP TABLE IF EXISTS rule_evaluations CASCADE;
DROP TABLE IF EXISTS academic_rules CASCADE;
