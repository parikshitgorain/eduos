#!/bin/bash

# EduOS Platform - Blue/Green Deployment Script
# Usage: ./deploy-blue-green.sh [deploy|switch|rollback] [blue|green] [environment]

set -e

ACTION=$1
COLOR=$2
ENVIRONMENT=$3

if [ -z "$ACTION" ] || [ -z "$COLOR" ] || [ -z "$ENVIRONMENT" ]; then
    echo "Usage: $0 [deploy|switch|rollback] [blue|green] [environment]"
    exit 1
fi

echo "========================================="
echo "EduOS Blue/Green Deployment"
echo "========================================="
echo "Action: $ACTION"
echo "Color: $COLOR"
echo "Environment: $ENVIRONMENT"
echo "========================================="

# Configuration
NAMESPACE="eduos-$ENVIRONMENT"
DEPLOYMENT_NAME="eduos-platform-$COLOR"
SERVICE_NAME="eduos-platform"
IMAGE_TAG="${GITHUB_SHA:-latest}"

deploy_environment() {
    echo "Deploying $COLOR environment..."
    
    # Create namespace if it doesn't exist
    kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
    
    # Apply ConfigMap
    kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: eduos-config-$COLOR
  namespace: $NAMESPACE
data:
  NODE_ENV: "$ENVIRONMENT"
  PORT: "3000"
  LOG_LEVEL: "info"
EOF
    
    # Apply Deployment
    kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: $DEPLOYMENT_NAME
  namespace: $NAMESPACE
  labels:
    app: eduos-platform
    color: $COLOR
    environment: $ENVIRONMENT
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: eduos-platform
      color: $COLOR
  template:
    metadata:
      labels:
        app: eduos-platform
        color: $COLOR
        environment: $ENVIRONMENT
    spec:
      containers:
      - name: eduos-platform
        image: ${DOCKER_REGISTRY}/eduos-platform:$IMAGE_TAG
        ports:
        - containerPort: 3000
          name: http
        envFrom:
        - configMapRef:
            name: eduos-config-$COLOR
        - secretRef:
            name: eduos-secrets
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
EOF
    
    # Wait for deployment to be ready
    echo "Waiting for deployment to be ready..."
    kubectl rollout status deployment/$DEPLOYMENT_NAME -n $NAMESPACE --timeout=5m
    
    echo "✅ $COLOR environment deployed successfully"
}

switch_traffic() {
    echo "Switching traffic to $COLOR environment..."
    
    # Update service selector to point to new color
    kubectl patch service $SERVICE_NAME -n $NAMESPACE -p "{\"spec\":{\"selector\":{\"color\":\"$COLOR\"}}}"
    
    echo "✅ Traffic switched to $COLOR environment"
}

rollback_traffic() {
    echo "Rolling back traffic to $COLOR environment..."
    
    # Switch traffic back
    switch_traffic
    
    echo "✅ Rollback completed"
}

case $ACTION in
    deploy)
        deploy_environment
        ;;
    switch)
        switch_traffic
        ;;
    rollback)
        rollback_traffic
        ;;
    *)
        echo "Invalid action: $ACTION"
        echo "Valid actions: deploy, switch, rollback"
        exit 1
        ;;
esac

echo "========================================="
echo "Operation completed successfully"
echo "========================================="
