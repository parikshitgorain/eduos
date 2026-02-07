#!/bin/bash

# EduOS Platform - Health Check Script
# Usage: ./health-check.sh [blue|green] [environment]

set -e

COLOR=$1
ENVIRONMENT=$2

if [ -z "$COLOR" ] || [ -z "$ENVIRONMENT" ]; then
    echo "Usage: $0 [blue|green] [environment]"
    exit 1
fi

echo "========================================="
echo "EduOS Health Check"
echo "========================================="
echo "Color: $COLOR"
echo "Environment: $ENVIRONMENT"
echo "========================================="

# Configuration
NAMESPACE="eduos-$ENVIRONMENT"
DEPLOYMENT_NAME="eduos-platform-$COLOR"
MAX_RETRIES=30
RETRY_INTERVAL=10

# Get service endpoint
if [ "$ENVIRONMENT" == "production" ]; then
    ENDPOINT="https://$COLOR.eduos.com"
else
    ENDPOINT="https://$ENVIRONMENT-$COLOR.eduos.com"
fi

echo "Checking health endpoint: $ENDPOINT/health"

# Health check function
check_health() {
    local retry_count=0
    
    while [ $retry_count -lt $MAX_RETRIES ]; do
        echo "Attempt $((retry_count + 1))/$MAX_RETRIES..."
        
        # Check HTTP health endpoint
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$ENDPOINT/health" || echo "000")
        
        if [ "$HTTP_CODE" == "200" ]; then
            echo "✅ Health check passed (HTTP $HTTP_CODE)"
            
            # Verify response body
            RESPONSE=$(curl -s "$ENDPOINT/health")
            STATUS=$(echo $RESPONSE | jq -r '.status')
            
            if [ "$STATUS" == "healthy" ]; then
                echo "✅ Application is healthy"
                return 0
            else
                echo "⚠️  Application status: $STATUS"
            fi
        else
            echo "❌ Health check failed (HTTP $HTTP_CODE)"
        fi
        
        retry_count=$((retry_count + 1))
        
        if [ $retry_count -lt $MAX_RETRIES ]; then
            echo "Waiting $RETRY_INTERVAL seconds before retry..."
            sleep $RETRY_INTERVAL
        fi
    done
    
    echo "❌ Health check failed after $MAX_RETRIES attempts"
    return 1
}

# Check Kubernetes deployment status
echo "Checking Kubernetes deployment status..."
kubectl get deployment $DEPLOYMENT_NAME -n $NAMESPACE

READY_REPLICAS=$(kubectl get deployment $DEPLOYMENT_NAME -n $NAMESPACE -o jsonpath='{.status.readyReplicas}')
DESIRED_REPLICAS=$(kubectl get deployment $DEPLOYMENT_NAME -n $NAMESPACE -o jsonpath='{.spec.replicas}')

echo "Ready replicas: $READY_REPLICAS/$DESIRED_REPLICAS"

if [ "$READY_REPLICAS" != "$DESIRED_REPLICAS" ]; then
    echo "❌ Not all replicas are ready"
    exit 1
fi

# Check pod status
echo "Checking pod status..."
kubectl get pods -n $NAMESPACE -l color=$COLOR

# Run health check
if check_health; then
    echo "========================================="
    echo "✅ All health checks passed"
    echo "========================================="
    exit 0
else
    echo "========================================="
    echo "❌ Health checks failed"
    echo "========================================="
    
    # Print pod logs for debugging
    echo "Recent pod logs:"
    kubectl logs -n $NAMESPACE -l color=$COLOR --tail=50
    
    exit 1
fi
