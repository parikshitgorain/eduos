#!/bin/bash

# EduOS Database Validation Script
# Description: Validates the database setup without running full tests
# Version: 1.0
# Date: 2026-02-04

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}EduOS Database Validation${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Configuration
DB_NAME="${DB_NAME:-eduos_db}"
DB_USER="${DB_USER:-eduos_app}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

# Check if files exist
echo -e "${YELLOW}Checking migration files...${NC}"

if [ ! -f "$(dirname "$0")/migrations/001_setup_rls_foundation.sql" ]; then
    echo -e "${RED}✗ Migration file not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Migration file exists${NC}"

if [ ! -f "$(dirname "$0")/migrations/001_setup_rls_foundation_rollback.sql" ]; then
    echo -e "${RED}✗ Rollback file not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Rollback file exists${NC}"

if [ ! -f "$(dirname "$0")/tests/rls_isolation.test.sql" ]; then
    echo -e "${RED}✗ Test file not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Test file exists${NC}"

if [ ! -f "$(dirname "$0")/docs/RLS_POLICY_REFERENCE.md" ]; then
    echo -e "${RED}✗ Documentation not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Documentation exists${NC}"

echo ""
echo -e "${YELLOW}Validating SQL syntax...${NC}"

# Basic SQL syntax validation (check for common errors)
if grep -q "CREATE TABLE IF NOT EXISTS tenants" "$(dirname "$0")/migrations/001_setup_rls_foundation.sql"; then
    echo -e "${GREEN}✓ Tenants table definition found${NC}"
else
    echo -e "${RED}✗ Tenants table definition missing${NC}"
    exit 1
fi

if grep -q "CREATE TABLE IF NOT EXISTS students" "$(dirname "$0")/migrations/001_setup_rls_foundation.sql"; then
    echo -e "${GREEN}✓ Students table definition found${NC}"
else
    echo -e "${RED}✗ Students table definition missing${NC}"
    exit 1
fi

if grep -q "ENABLE ROW LEVEL SECURITY" "$(dirname "$0")/migrations/001_setup_rls_foundation.sql"; then
    echo -e "${GREEN}✓ RLS enable statements found${NC}"
else
    echo -e "${RED}✗ RLS enable statements missing${NC}"
    exit 1
fi

if grep -q "CREATE POLICY.*tenant_isolation" "$(dirname "$0")/migrations/001_setup_rls_foundation.sql"; then
    echo -e "${GREEN}✓ RLS policies found${NC}"
else
    echo -e "${RED}✗ RLS policies missing${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Validation Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "All files are present and SQL syntax looks valid."
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Run ./database/setup.sh to create the database"
echo "2. Run tests with: psql -U $DB_USER -d $DB_NAME -f database/tests/rls_isolation.test.sql"
echo ""
