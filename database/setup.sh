#!/bin/bash

# EduOS Database Setup Script
# Description: Automated setup for PostgreSQL with RLS policies
# Version: 1.0
# Date: 2026-02-04

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DB_NAME="${DB_NAME:-eduos_db}"
DB_USER="${DB_USER:-eduos_app}"
DB_PASSWORD="${DB_PASSWORD:-change_me_in_production}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}EduOS Database Setup${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo -e "${RED}Error: PostgreSQL is not installed${NC}"
    echo "Please install PostgreSQL 14+ before running this script"
    exit 1
fi

# Check PostgreSQL version
PG_VERSION=$(psql --version | grep -oP '\d+' | head -1)
if [ "$PG_VERSION" -lt 14 ]; then
    echo -e "${RED}Error: PostgreSQL version must be 14 or higher${NC}"
    echo "Current version: $PG_VERSION"
    exit 1
fi

echo -e "${GREEN}✓ PostgreSQL $PG_VERSION detected${NC}"
echo ""

# Check if database exists
echo -e "${YELLOW}Checking if database exists...${NC}"
if psql -U "$POSTGRES_USER" -h "$DB_HOST" -p "$DB_PORT" -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    echo -e "${YELLOW}Database '$DB_NAME' already exists${NC}"
    read -p "Do you want to drop and recreate it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Dropping database '$DB_NAME'...${NC}"
        psql -U "$POSTGRES_USER" -h "$DB_HOST" -p "$DB_PORT" -c "DROP DATABASE IF EXISTS $DB_NAME;"
        echo -e "${GREEN}✓ Database dropped${NC}"
    else
        echo -e "${YELLOW}Skipping database creation${NC}"
        DB_EXISTS=true
    fi
fi

# Create database if it doesn't exist
if [ "$DB_EXISTS" != true ]; then
    echo -e "${YELLOW}Creating database '$DB_NAME'...${NC}"
    psql -U "$POSTGRES_USER" -h "$DB_HOST" -p "$DB_PORT" -c "CREATE DATABASE $DB_NAME;"
    echo -e "${GREEN}✓ Database created${NC}"
fi

echo ""

# Apply migration
echo -e "${YELLOW}Applying RLS foundation migration...${NC}"
PGPASSWORD="$DB_PASSWORD" psql -U "$POSTGRES_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -f "$(dirname "$0")/migrations/001_setup_rls_foundation.sql"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Migration applied successfully${NC}"
else
    echo -e "${RED}✗ Migration failed${NC}"
    exit 1
fi

echo ""

# Run tests
echo -e "${YELLOW}Running RLS isolation tests...${NC}"
PGPASSWORD="$DB_PASSWORD" psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -f "$(dirname "$0")/tests/rls_isolation.test.sql"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed${NC}"
else
    echo -e "${RED}✗ Some tests failed${NC}"
    echo -e "${YELLOW}Please review the test output above${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Database: $DB_NAME"
echo "Host: $DB_HOST"
echo "Port: $DB_PORT"
echo "User: $DB_USER"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Update your application configuration with the database credentials"
echo "2. Review the RLS Policy Reference Guide: database/docs/RLS_POLICY_REFERENCE.md"
echo "3. Ensure your application sets tenant context before queries"
echo ""
echo -e "${YELLOW}Security Reminder:${NC}"
echo "⚠️  Change the default password in production!"
echo "⚠️  Use environment variables for sensitive credentials"
echo ""
