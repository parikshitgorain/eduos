#!/bin/bash

# EduOS Platform - Database Snapshot Script
# Usage: ./create-snapshot.sh [environment] [snapshot-name]

set -e

ENVIRONMENT=$1
SNAPSHOT_NAME=$2

if [ -z "$ENVIRONMENT" ] || [ -z "$SNAPSHOT_NAME" ]; then
    echo "Usage: $0 [environment] [snapshot-name]"
    exit 1
fi

echo "========================================="
echo "EduOS Database Snapshot"
echo "========================================="
echo "Environment: $ENVIRONMENT"
echo "Snapshot Name: $SNAPSHOT_NAME"
echo "========================================="

# Get database credentials from Kubernetes secrets
DB_HOST=$(kubectl get secret eduos-secrets -n eduos-$ENVIRONMENT -o jsonpath='{.data.DB_HOST}' | base64 -d)
DB_NAME=$(kubectl get secret eduos-secrets -n eduos-$ENVIRONMENT -o jsonpath='{.data.DB_NAME}' | base64 -d)
DB_USER=$(kubectl get secret eduos-secrets -n eduos-$ENVIRONMENT -o jsonpath='{.data.DB_USER}' | base64 -d)
DB_PASSWORD=$(kubectl get secret eduos-secrets -n eduos-$ENVIRONMENT -o jsonpath='{.data.DB_PASSWORD}' | base64 -d)

# Create snapshot using AWS RDS
if [ -n "$AWS_RDS_INSTANCE" ]; then
    echo "Creating RDS snapshot..."
    aws rds create-db-snapshot \
        --db-instance-identifier $AWS_RDS_INSTANCE \
        --db-snapshot-identifier $SNAPSHOT_NAME \
        --tags Key=Environment,Value=$ENVIRONMENT Key=Type,Value=pre-deployment
    
    echo "Waiting for snapshot to complete..."
    aws rds wait db-snapshot-completed --db-snapshot-identifier $SNAPSHOT_NAME
    
    echo "✅ RDS snapshot created: $SNAPSHOT_NAME"
else
    # Fallback to pg_dump
    echo "Creating PostgreSQL dump..."
    PGPASSWORD=$DB_PASSWORD pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME -F c -f "/tmp/$SNAPSHOT_NAME.dump"
    
    # Upload to S3
    aws s3 cp "/tmp/$SNAPSHOT_NAME.dump" "s3://eduos-backups/$ENVIRONMENT/$SNAPSHOT_NAME.dump"
    
    # Clean up local file
    rm "/tmp/$SNAPSHOT_NAME.dump"
    
    echo "✅ Database dump created and uploaded: $SNAPSHOT_NAME"
fi

echo "========================================="
echo "Snapshot creation completed"
echo "========================================="
