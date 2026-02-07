# EduOS Platform - CI/CD Quick Start Guide

## Overview

This guide will help you get started with the EduOS Platform CI/CD pipeline. The pipeline uses GitHub Actions for continuous integration and deployment with a Blue/Green deployment strategy.

---

## Table of Contents

1. [Initial Setup](#initial-setup)
2. [Running CI Pipeline](#running-ci-pipeline)
3. [Deploying to Staging](#deploying-to-staging)
4. [Deploying to Production](#deploying-to-production)
5. [Rolling Back](#rolling-back)
6. [Monitoring Deployments](#monitoring-deployments)

---

## Initial Setup

### 1. Configure GitHub Secrets

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions** and add:

```
# Docker Registry
DOCKER_USERNAME=your-docker-username
DOCKER_PASSWORD=your-docker-token

# AWS Credentials
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1

# Deployment Approvers (comma-separated GitHub usernames)
DEPLOYMENT_APPROVERS=user1,user2,user3

# Notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Security Scanning
SNYK_TOKEN=your-snyk-token

# Testing
E2E_API_KEY=your-e2e-api-key
```

### 2. Set Up Kubernetes Cluster

```bash
# Create namespaces
kubectl create namespace eduos-staging
kubectl create namespace eduos-production

# Create secrets
kubectl create secret generic eduos-secrets \
  --from-literal=DB_HOST=your-db-host \
  --from-literal=DB_NAME=eduos_db \
  --from-literal=DB_USER=eduos_app \
  --from-literal=DB_PASSWORD=your-db-password \
  --from-literal=REDIS_HOST=your-redis-host \
  --from-literal=JWT_SECRET=your-jwt-secret \
  --from-literal=MASTER_ENCRYPTION_KEY=your-encryption-key \
  -n eduos-production

# Apply Kubernetes configurations
kubectl apply -f deployment/kubernetes/service.yaml
kubectl apply -f deployment/kubernetes/ingress.yaml
```

### 3. Make Scripts Executable

```bash
chmod +x deployment/*.sh
```

---

## Running CI Pipeline

The CI pipeline runs automatically on every push and pull request.

### Automatic Triggers

- **Push to any branch** → Runs full CI pipeline
- **Pull request** → Runs full CI pipeline with coverage report

### Manual Trigger

```bash
# Using GitHub CLI
gh workflow run ci.yml

# Or via GitHub UI
# Go to Actions → CI Pipeline → Run workflow
```

### What Gets Tested

1. ✅ **Linting** - ESLint code quality checks
2. ✅ **Security** - npm audit, Snyk, Trivy scans
3. ✅ **Unit Tests** - Jest tests with 80% coverage requirement
4. ✅ **Integration Tests** - API endpoint tests with real database
5. ✅ **Docker Build** - Multi-stage Docker image build
6. ✅ **Image Scanning** - Trivy vulnerability scan on Docker image

### Viewing Results

```bash
# View workflow status
gh run list --workflow=ci.yml

# View specific run
gh run view <run-id>

# Download artifacts
gh run download <run-id>
```

---

## Deploying to Staging

Staging deployments happen automatically when you push to the `main` branch.

### Automatic Deployment

```bash
# Merge your feature branch to main
git checkout main
git merge feature/my-feature
git push origin main

# CI/CD pipeline will automatically:
# 1. Run all tests
# 2. Build Docker image
# 3. Deploy to staging
# 4. Run smoke tests
```

### Manual Deployment

```bash
# Using GitHub CLI
gh workflow run cd.yml \
  --field environment=staging \
  --field deployment_strategy=blue-green

# Or via GitHub UI
# Go to Actions → CD Pipeline → Run workflow
# Select: environment=staging, strategy=blue-green
```

### Verify Staging Deployment

```bash
# Check deployment status
kubectl get deployments -n eduos-staging

# Check pods
kubectl get pods -n eduos-staging

# View logs
kubectl logs -n eduos-staging -l app=eduos-platform --tail=100

# Test staging endpoint
curl https://staging.eduos.com/health
```

---

## Deploying to Production

Production deployments require manual approval and can be triggered by:
1. Pushing a git tag (e.g., `v1.0.0`)
2. Manual workflow dispatch

### Method 1: Git Tag (Recommended)

```bash
# Create and push a version tag
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0

# This will:
# 1. Trigger CD pipeline
# 2. Request approval from DEPLOYMENT_APPROVERS
# 3. Deploy to production after approval
```

### Method 2: Manual Workflow Dispatch

```bash
# Using GitHub CLI
gh workflow run cd.yml \
  --field environment=production \
  --field deployment_strategy=blue-green

# Or via GitHub UI
# Go to Actions → CD Pipeline → Run workflow
# Select: environment=production, strategy=blue-green
```

### Approval Process

1. **Approval Request** - GitHub creates an issue requesting approval
2. **Review** - Approvers review the deployment details
3. **Approve** - At least 2 approvers must approve (configurable)
4. **Deploy** - Deployment proceeds automatically after approval

### Deployment Strategies

#### Blue/Green (Default)

Instant traffic switch after health checks pass.

```bash
gh workflow run cd.yml \
  --field environment=production \
  --field deployment_strategy=blue-green
```

#### Canary

Gradual traffic shift: 10% → 50% → 100%

```bash
gh workflow run cd.yml \
  --field environment=production \
  --field deployment_strategy=canary
```

#### Rolling

Rolling update across pods (no Blue/Green).

```bash
gh workflow run cd.yml \
  --field environment=production \
  --field deployment_strategy=rolling
```

### Monitor Production Deployment

```bash
# Watch deployment progress
kubectl rollout status deployment/eduos-platform-blue -n eduos-production

# Check pods
kubectl get pods -n eduos-production -l color=blue

# View logs
kubectl logs -n eduos-production -l color=blue --tail=100 -f

# Test production endpoint
curl https://eduos.com/health
```

---

## Rolling Back

### When to Rollback

Rollback immediately if you observe:
- ❌ Error rate > 1%
- ❌ P95 latency > 500ms
- ❌ P99 latency > 1000ms
- ❌ Critical functionality broken
- ❌ Data corruption

### Automatic Rollback

The pipeline automatically rolls back if health checks or smoke tests fail.

### Manual Rollback

#### Via GitHub Actions (Recommended)

```bash
# Using GitHub CLI
gh workflow run rollback.yml \
  --field environment=production \
  --field version="" \
  --field reason="High error rate detected"

# Or via GitHub UI
# Go to Actions → Rollback Deployment → Run workflow
# Fill in:
#   - Environment: production
#   - Version: (leave empty for previous version)
#   - Reason: High error rate detected
```

#### Via Command Line (Emergency)

```bash
# Switch traffic back to Green (previous version)
./deployment/traffic-shift.sh green 100

# Verify rollback
./deployment/health-check.sh green production

# Run smoke tests
./deployment/smoke-tests.sh green production
```

### Rollback Window

- **Staging:** 1 hour
- **Production:** 1 hour

After the rollback window, the old environment is automatically cleaned up.

---

## Monitoring Deployments

### Real-Time Monitoring

```bash
# Monitor metrics
./deployment/monitor-metrics.sh production

# Watch pod status
kubectl get pods -n eduos-production -w

# Stream logs
kubectl logs -n eduos-production -l app=eduos-platform -f
```

### Grafana Dashboards

Access Grafana at: `http://localhost:3001` (or your Grafana URL)

**Key Dashboards:**
- **Application Overview** - Request rate, error rate, latency
- **Infrastructure** - CPU, memory, disk usage
- **Database** - Query performance, connection pool
- **Redis** - Cache hit rate, memory usage

### Prometheus Metrics

Access Prometheus at: `http://localhost:9090`

**Key Metrics:**
```promql
# Error rate
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) * 100

# P95 latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) * 1000

# P99 latency
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) * 1000

# CPU usage
rate(container_cpu_usage_seconds_total[5m]) * 100

# Memory usage
container_memory_usage_bytes / container_spec_memory_limit_bytes * 100
```

### Slack Notifications

Deployment notifications are sent to Slack automatically:

- ✅ **Deployment Started** - When deployment begins
- ✅ **Deployment Successful** - When deployment completes
- ❌ **Deployment Failed** - When deployment fails
- 🔄 **Rollback Initiated** - When rollback starts
- ✅ **Rollback Successful** - When rollback completes

---

## Troubleshooting

### CI Pipeline Fails

**Check logs:**
```bash
gh run view <run-id> --log
```

**Common issues:**
- Test failures → Fix tests and push again
- Coverage below 80% → Add more tests
- Security vulnerabilities → Update dependencies

### Deployment Fails

**Check deployment logs:**
```bash
kubectl describe deployment eduos-platform-blue -n eduos-production
kubectl logs -n eduos-production -l color=blue --tail=100
```

**Common issues:**
- Image pull errors → Check Docker credentials
- Health checks fail → Check database/Redis connectivity
- Resource limits → Increase pod resources

### Rollback Fails

**Emergency procedure:**
```bash
# 1. Manually switch traffic
./deployment/traffic-shift.sh green 100

# 2. Scale down Blue environment
kubectl scale deployment eduos-platform-blue -n eduos-production --replicas=0

# 3. Verify Green is serving traffic
curl https://eduos.com/health

# 4. Contact on-call engineer
```

---

## Best Practices

### Before Deploying

1. ✅ Run tests locally: `npm test`
2. ✅ Build Docker image locally: `docker build -t eduos-platform:test .`
3. ✅ Review code changes
4. ✅ Update CHANGELOG.md
5. ✅ Notify team in Slack

### During Deployment

1. ✅ Monitor deployment progress in GitHub Actions
2. ✅ Watch Grafana dashboards
3. ✅ Keep Slack open for notifications
4. ✅ Be ready to rollback

### After Deployment

1. ✅ Monitor for 15 minutes
2. ✅ Check error rates and latency
3. ✅ Verify critical functionality
4. ✅ Update deployment documentation
5. ✅ Notify stakeholders

---

## Quick Reference

### Common Commands

```bash
# Run CI pipeline
gh workflow run ci.yml

# Deploy to staging
gh workflow run cd.yml --field environment=staging

# Deploy to production
git tag -a v1.0.0 -m "Release 1.0.0"
git push origin v1.0.0

# Rollback production
gh workflow run rollback.yml \
  --field environment=production \
  --field reason="Issue description"

# Check deployment status
kubectl get deployments -n eduos-production

# View logs
kubectl logs -n eduos-production -l app=eduos-platform --tail=100

# Monitor metrics
./deployment/monitor-metrics.sh production
```

### Useful Links

- **GitHub Actions:** https://github.com/your-org/eduos-platform/actions
- **Grafana:** http://localhost:3001
- **Prometheus:** http://localhost:9090
- **Kibana:** http://localhost:5601
- **Jaeger:** http://localhost:16686

---

## Support

For help with CI/CD:

- **Slack:** #eduos-deployments
- **Email:** devops@eduos.com
- **Documentation:** `/deployment/README.md`
- **On-Call:** PagerDuty rotation

---

**Last Updated:** 2026-02-08  
**Version:** 1.0.0
