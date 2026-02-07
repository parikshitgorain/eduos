#!/bin/bash

# EduOS Platform - Cleanup Script
# Usage: ./cleanup.sh [blue|green] [environment]

set -e

COLOR=$1
ENVIRONMENT=$2

if [ -z "$COLOR" ] || [ -z "$ENVIRONMENT" ]; then
    echo "Usage: $0 [blue|green] [environment]"
    exit 1
fi

echo "========================================="
echo "EduOS Environment Cleanup"
echo "========================================="
echo "Color: $COLOR"
echo "Environment: $ENVIRONMENT"
echo "========================================="

NAMESPACE="eduos-$ENVIRONMENT"
DEPLOYMENT_NAME="eduos-platform-$COLOR"

# Scale down deployment to 0
echo "Scaling down $DEPLOYMENT_NAME..."
kubectl scale deployment $DEPLOYMENT_NAME -n $NAMESPACE --replicas=0

# Wait for pods to terminate
echo "Waiting for pods to terminate..."
kubectl wait --for=delete pod -l color=$COLOR -n $NAMESPACE --timeout=120s || true

# Delete deployment
echo "Deleting deployment..."
kubectl delete deployment $DEPLOYMENT_NAME -n $NAMESPACE --ignore-not-found=true

# Delete ConfigMap
echo "Deleting ConfigMap..."
kubectl delete configmap eduos-config-$COLOR -n $NAMESPACE --ignore-not-found=true

# Clean up old Docker images (keep last 5)
echo "Cleaning up old Docker images..."
docker images | grep eduos-platform | tail -n +6 | awk '{print $3}' | xargs -r docker rmi || true

echo "========================================="
echo "✅ Cleanup completed"
echo "========================================="
