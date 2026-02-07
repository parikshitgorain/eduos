# EduOS Platform - Deployment Guide

## Overview

This directory contains deployment scripts and configurations for the EduOS Platform CI/CD pipeline. The deployment strategy uses **Blue/Green deployment** with automated rollback capabilities.

## Table of Contents

1. [Architecture](#architecture)
2. [Prerequisites](#prerequisites)
3. [CI/CD Pipelines](#cicd-pipelines)
4. [Deployment Strategies](#deployment-strategies)
5. [Rollback Procedures](#rollback-procedures)
6. [Scripts Reference](#scripts-reference)
7. [Troubleshooting](#troubleshooting)

---

## Architecture

### Blue/Green Deployment

The EduOS Platform uses a Blue/Green deployment strategy to achieve zero-downtime deployments:

```
┌─────────────────────────────────────────────────────────────┐
│                      Load Balancer                          │
│                    (Traffic Router)                         │
└────────────────┬────────────────────────────┬───────────────┘
                 │                            │
                 │ 100% Traffic               │ 0% Traffic
                 │                            │
        ┌────────▼────────┐          ┌────────▼────────┐
        │  Blue Environment│          │ Green Environment│
        │  (Current)       │          │  (New Version)   │
        │  v1.0.0          │          │  v1.1.0          │
        └──────────────────┘          └──────────────────┘
```

**Deployment Flow:**

1. **Deploy New Version** → Deploy to Green environment (0% traffic)
2. **Health Checks** → Verify Green environment is healthy
3. **Smoke Tests** → Run automated tests on Green
4. **Traffic Switch** → Gradually shift traffic from Blue to Green
5. **Monitor** → Watch metrics for 5 minutes
6. **Cleanup** → Keep Blue for 1 hour (rollback window), then cleanup

---

## Prerequisites

### Required Tools

- **Docker** (v20.10+)
- **Kubernetes** (v1.24+) with kubectl configured
- **AWS CLI** (v2.0+) for AWS deployments
- **GitHub CLI** (optional, for manual workflow triggers)
- **jq** (for JSON parsing)
- **curl** (for API testing)

### Required Secrets

Configure the following secrets in GitHub repository settings:

#### Docker Registry
- `DOCKER_USERNAME` - Docker Hub username
- `DOCKER_PASSWORD` - Docker Hub password/token

#### AWS Credentials
- `AWS_ACCESS_KEY_ID` - AWS access key
- `AWS_SECRET_ACCESS_KEY` - AWS secret key
- `AWS_REGION` - AWS region (e.g., us-east-1)

#### Deployment Approvers
- `DEPLOYMENT_APPROVERS` - Comma-separated list of GitHub usernames who can approve deployments

#### Notifications
- `SLACK_WEBHOOK_URL` - Slack webhook for deployment notifications

#### Security Scanning
- `SNYK_TOKEN` - Snyk API token for security scanning

#### Testing
- `E2E_API_KEY` - API key for end-to-end tests

---

## CI/CD Pipelines

### 1. CI Pipeline (`.github/workflows/ci.yml`)

**Triggers:**
- Push to `main`, `develop`, or `feature/**` branches
- Pull requests to `main` or `develop`

**Jobs:**

1. **Lint** - Code quality checks with ESLint
2. **Security** - Dependency scanning (npm audit, Snyk, Trivy)
3. **Unit Tests** - Run Jest tests with coverage
4. **Integration Tests** - Test API endpoints with real database
5. **Build** - Build and push Docker image
6. **Quality Report** - Generate comprehensive quality report

**Coverage Requirements:**
- Minimum 80% code coverage
- All tests must pass
- No high-severity security vulnerabilities

### 2. CD Pipeline (`.github/workflows/cd.yml`)

**Triggers:**
- Push to `main` branch (auto-deploy to staging)
- Git tags `v*.*.*` (auto-deploy to production with approval)
- Manual workflow dispatch

**Jobs:**

1. **Pre-Deployment** - Version determination and approval
2. **Deploy Blue** - Deploy new version to Blue environment
3. **Switch Traffic** - Gradually shift traffic to Blue
4. **Post-Deployment** - Validation and monitoring
5. **Cleanup** - Remove old Green environment after rollback window

**Deployment Strategies:**
- **Blue/Green** (default) - Instant traffic switch
- **Canary** - Gradual traffic shift (10% → 50% → 100%)
- **Rolling** - Rolling update across pods

### 3. Rollback Pipeline (`.github/workflows/rollback.yml`)

**Triggers:**
- Manual workflow dispatch only

**Jobs:**

1. **Approval** - Require manual approval for rollback
2. **Determine Target** - Identify rollback target version
3. **Backup** - Create database snapshot before rollback
4. **Rollback** - Switch traffic back to previous version
5. **Validate** - Verify rollback success

---

## Deployment Strategies

### Blue/Green Deployment (Default)

**Advantages:**
- Zero downtime
- Instant rollback
- Full environment testing before traffic switch

**Process:**
```bash
# Deploy to Blue environment
./deployment/deploy-blue-green.sh deploy blue production

# Run health checks
./deployment/health-check.sh blue production

# Run smoke tests
./deployment/smoke-tests.sh blue production

# Switch traffic (instant)
./deployment/traffic-shift.sh blue 100

# Monitor for 5 minutes
./deployment/monitor-metrics.sh production
```

### Canary Deployment

**Advantages:**
- Gradual rollout
- Early detection of issues
- Reduced blast radius

**Process:**
```bash
# Deploy to Blue environment
./deployment/deploy-blue-green.sh deploy blue production

# Shift 10% traffic
./deployment/traffic-shift.sh blue 10
sleep 300  # Monitor for 5 minutes

# Shift 50% traffic
./deployment/traffic-shift.sh blue 50
sleep 300  # Monitor for 5 minutes

# Shift 100% traffic
./deployment/traffic-shift.sh blue 100
```

---

## Rollback Procedures

### Automatic Rollback

Automatic rollback is triggered if:
- Health checks fail after deployment
- Error rate exceeds 1%
- P95 latency exceeds 500ms
- P99 latency exceeds 1000ms

### Manual Rollback

**Via GitHub Actions:**

1. Go to **Actions** → **Rollback Deployment**
2. Click **Run workflow**
3. Select environment (staging/production)
4. Optionally specify target version
5. Provide rollback reason
6. Approve rollback request

**Via Command Line:**

```bash
# Switch traffic back to Green (previous version)
./deployment/traffic-shift.sh green 100

# Verify rollback
./deployment/health-check.sh green production
```

### Rollback Window

- **Staging:** 1 hour
- **Production:** 1 hour

After the rollback window, the old environment is automatically cleaned up.

---

## Scripts Reference

### `deploy-blue-green.sh`

Deploy or switch between Blue/Green environments.

```bash
./deploy-blue-green.sh [deploy|switch|rollback] [blue|green] [environment]
```

**Examples:**
```bash
# Deploy to Blue environment
./deploy-blue-green.sh deploy blue production

# Switch traffic to Blue
./deploy-blue-green.sh switch blue production

# Rollback to Green
./deploy-blue-green.sh rollback green production
```

### `health-check.sh`

Verify environment health.

```bash
./health-check.sh [blue|green] [environment]
```

**Checks:**
- HTTP health endpoint (200 OK)
- Kubernetes deployment status
- Pod readiness
- Application health status

### `smoke-tests.sh`

Run smoke tests on deployed environment.

```bash
./smoke-tests.sh [blue|green] [environment]
```

**Tests:**
- Health endpoint
- Version endpoint
- API root
- Database connectivity
- Redis connectivity
- Response time
- Security headers

### `traffic-shift.sh`

Shift traffic between Blue/Green environments.

```bash
./traffic-shift.sh [blue|green] [percentage]
```

**Examples:**
```bash
# Shift 10% traffic to Blue
./traffic-shift.sh blue 10

# Shift 100% traffic to Blue
./traffic-shift.sh blue 100
```

### `monitor-metrics.sh`

Monitor application metrics.

```bash
./monitor-metrics.sh [environment]
```

**Monitors:**
- Error rate (threshold: 1%)
- P95 latency (threshold: 500ms)
- P99 latency (threshold: 1000ms)
- CPU usage (threshold: 80%)
- Memory usage (threshold: 80%)

### `cleanup.sh`

Clean up old environment.

```bash
./cleanup.sh [blue|green] [environment]
```

### `create-snapshot.sh`

Create database snapshot.

```bash
./create-snapshot.sh [environment] [snapshot-name]
```

### `performance-test.sh`

Run performance tests using k6.

```bash
./performance-test.sh [environment]
```

### `security-scan.sh`

Run security scans on live environment.

```bash
./security-scan.sh [environment]
```

---

## Troubleshooting

### Deployment Fails

**Symptom:** Deployment job fails in CI/CD pipeline

**Solutions:**
1. Check GitHub Actions logs for error details
2. Verify all required secrets are configured
3. Check Kubernetes cluster connectivity
4. Verify Docker image was built successfully

### Health Checks Fail

**Symptom:** Health checks fail after deployment

**Solutions:**
1. Check pod logs: `kubectl logs -n eduos-production -l color=blue`
2. Verify database connectivity
3. Check Redis connectivity
4. Review application configuration

### High Error Rate After Deployment

**Symptom:** Error rate exceeds threshold after traffic switch

**Solutions:**
1. Immediately rollback: Run rollback workflow
2. Check application logs for errors
3. Verify database migrations completed successfully
4. Check for breaking API changes

### Rollback Fails

**Symptom:** Rollback workflow fails

**Solutions:**
1. Manually switch traffic: `./traffic-shift.sh green 100`
2. Verify Green environment is still running
3. Check database snapshot availability
4. Contact on-call engineer if manual intervention needed

### Performance Degradation

**Symptom:** Latency increases after deployment

**Solutions:**
1. Check resource usage (CPU/Memory)
2. Review database query performance
3. Check Redis cache hit rate
4. Consider scaling up pods: `kubectl scale deployment eduos-platform-blue --replicas=5`

---

## Best Practices

### Before Deployment

1. ✅ Run all tests locally
2. ✅ Review code changes
3. ✅ Update CHANGELOG.md
4. ✅ Tag release with semantic version
5. ✅ Notify team in Slack

### During Deployment

1. ✅ Monitor deployment progress
2. ✅ Watch application metrics
3. ✅ Be ready to rollback
4. ✅ Keep communication channels open

### After Deployment

1. ✅ Verify deployment success
2. ✅ Monitor for 15 minutes
3. ✅ Update deployment documentation
4. ✅ Notify stakeholders
5. ✅ Close deployment ticket

---

## Support

For deployment issues or questions:

- **Slack:** #eduos-deployments
- **Email:** devops@eduos.com
- **On-Call:** PagerDuty rotation

---

## Version History

- **v1.0.0** (2026-02-08) - Initial deployment pipeline with Blue/Green strategy
