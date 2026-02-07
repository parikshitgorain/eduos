# EduOS Platform - GitHub Actions Workflows

This directory contains the CI/CD workflows for the EduOS Platform.

## Workflows

### 1. CI Pipeline (`ci.yml`)

**Purpose:** Continuous Integration - Run tests, security scans, and build Docker images

**Triggers:**
- Push to `main`, `develop`, or `feature/**` branches
- Pull requests to `main` or `develop`

**Jobs:**
1. **Lint** - ESLint code quality checks
2. **Security** - npm audit, Snyk, Trivy scans
3. **Unit Tests** - Jest tests with 80% coverage requirement
4. **Integration Tests** - API tests with PostgreSQL and Redis
5. **Build** - Docker image build and push
6. **Quality Report** - Generate comprehensive quality report

**Duration:** ~10-15 minutes

### 2. CD Pipeline (`cd.yml`)

**Purpose:** Continuous Deployment - Deploy to staging/production with Blue/Green strategy

**Triggers:**
- Push to `main` → Auto-deploy to staging
- Git tags `v*.*.*` → Deploy to production (requires approval)
- Manual workflow dispatch

**Jobs:**
1. **Pre-Deployment** - Version determination and approval
2. **Deploy Blue** - Deploy new version to Blue environment
3. **Switch Traffic** - Shift traffic from Green to Blue
4. **Post-Deployment** - E2E tests, performance tests, security scans
5. **Cleanup** - Remove old Green environment

**Duration:** ~20-30 minutes

**Deployment Strategies:**
- `blue-green` (default) - Instant traffic switch
- `canary` - Gradual rollout (10% → 50% → 100%)
- `rolling` - Rolling update

### 3. Rollback Pipeline (`rollback.yml`)

**Purpose:** Rollback to previous version with one click

**Triggers:**
- Manual workflow dispatch only

**Jobs:**
1. **Approval** - Manual approval required
2. **Determine Target** - Identify rollback version
3. **Backup** - Create database snapshot
4. **Rollback** - Switch traffic to previous version
5. **Validate** - Verify rollback success

**Duration:** ~5-10 minutes

## Required Secrets

Configure these secrets in **Settings → Secrets and variables → Actions**:

### Docker Registry
```
DOCKER_USERNAME=your-docker-username
DOCKER_PASSWORD=your-docker-token
```

### AWS Credentials
```
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
```

### Deployment
```
DEPLOYMENT_APPROVERS=user1,user2,user3
```

### Notifications
```
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### Security
```
SNYK_TOKEN=your-snyk-token
```

### Testing
```
E2E_API_KEY=your-e2e-api-key
```

## Quick Start

### Run CI Pipeline
```bash
# Automatic on push
git push origin feature/my-feature

# Or manual trigger
gh workflow run ci.yml
```

### Deploy to Staging
```bash
# Automatic on push to main
git push origin main

# Or manual trigger
gh workflow run cd.yml --field environment=staging
```

### Deploy to Production
```bash
# Create and push tag (requires approval)
git tag -a v1.0.0 -m "Release 1.0.0"
git push origin v1.0.0

# Or manual trigger
gh workflow run cd.yml --field environment=production
```

### Rollback
```bash
gh workflow run rollback.yml \
  --field environment=production \
  --field version="" \
  --field reason="High error rate detected"
```

## Monitoring

### View Workflow Runs
```bash
# List all runs
gh run list

# View specific run
gh run view <run-id>

# Watch run in real-time
gh run watch <run-id>
```

### Download Artifacts
```bash
# Download all artifacts
gh run download <run-id>

# Download specific artifact
gh run download <run-id> --name test-results
```

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
- Docker build fails → Check Dockerfile syntax

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
- Approval timeout → Check approvers list

### Rollback Fails

**Emergency rollback:**
```bash
# Switch traffic manually
./deployment/traffic-shift.sh green 100

# Verify
./deployment/health-check.sh green production
```

## Best Practices

### Before Pushing
1. ✅ Run tests locally: `npm test`
2. ✅ Run linter: `npm run lint`
3. ✅ Build Docker image: `docker build -t eduos-platform:test .`
4. ✅ Review changes

### During Deployment
1. ✅ Monitor GitHub Actions
2. ✅ Watch Grafana dashboards
3. ✅ Keep Slack open
4. ✅ Be ready to rollback

### After Deployment
1. ✅ Monitor for 15 minutes
2. ✅ Check error rates
3. ✅ Verify functionality
4. ✅ Update documentation

## Support

- **Documentation:** `/deployment/README.md`
- **Quick Start:** `/docs/CI_CD_QUICK_START.md`
- **Slack:** #eduos-deployments
- **Email:** devops@eduos.com

---

**Last Updated:** 2026-02-08  
**Version:** 1.0.0
