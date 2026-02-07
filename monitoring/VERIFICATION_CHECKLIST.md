# Monitoring Stack - Verification Checklist

Use this checklist to verify that the monitoring and observability stack is properly configured and functioning.

## ✅ Pre-Deployment Verification

### Configuration Files
- [ ] `monitoring/prometheus/prometheus.yml` exists and is valid
- [ ] `monitoring/prometheus/alerts/system-alerts.yml` exists
- [ ] `monitoring/prometheus/alerts/application-alerts.yml` exists
- [ ] `monitoring/grafana/provisioning/datasources/prometheus.yml` exists
- [ ] `monitoring/grafana/provisioning/dashboards/dashboard.yml` exists
- [ ] `monitoring/logstash/pipeline/logstash.conf` exists
- [ ] `monitoring/jaeger/jaeger-config.yml` exists
- [ ] `monitoring/alertmanager/alertmanager.yml` exists

### Dependencies
- [ ] `prom-client` installed (`npm list prom-client`)
- [ ] `winston` installed (`npm list winston`)
- [ ] `winston-logstash` installed (`npm list winston-logstash`)
- [ ] `jaeger-client` installed (`npm list jaeger-client`)

### Environment Configuration
- [ ] `.env` file created from `.env.example`
- [ ] `SERVICE_NAME` configured
- [ ] `METRICS_ENABLED=true`
- [ ] `JAEGER_AGENT_HOST` configured
- [ ] `LOGSTASH_ENABLED=true`

## ✅ Deployment Verification

### Docker Services
Run: `docker-compose ps`

- [ ] `eduos_prometheus` is running
- [ ] `eduos_grafana` is running
- [ ] `eduos_alertmanager` is running
- [ ] `eduos_node_exporter` is running
- [ ] `eduos_postgres_exporter` is running
- [ ] `eduos_redis_exporter` is running
- [ ] `eduos_elasticsearch` is running
- [ ] `eduos_logstash` is running
- [ ] `eduos_kibana` is running
- [ ] `eduos_jaeger` is running

### Service Health Checks

#### Prometheus (Port 9090)
```bash
curl -f http://localhost:9090/-/healthy
```
- [ ] Returns 200 OK
- [ ] Web UI accessible at http://localhost:9090
- [ ] Targets page shows all exporters as "UP"

#### Grafana (Port 3001)
```bash
curl -f http://localhost:3001/api/health
```
- [ ] Returns 200 OK
- [ ] Login page accessible at http://localhost:3001
- [ ] Can login with admin/admin
- [ ] Prometheus datasource configured
- [ ] Dashboards visible in UI

#### Alertmanager (Port 9093)
```bash
curl -f http://localhost:9093/-/healthy
```
- [ ] Returns 200 OK
- [ ] Web UI accessible at http://localhost:9093
- [ ] Alert routing rules loaded

#### Elasticsearch (Port 9200)
```bash
curl -f http://localhost:9200/_cluster/health
```
- [ ] Returns 200 OK
- [ ] Cluster status is "green" or "yellow"
- [ ] Indices created

#### Logstash (Port 5000)
```bash
curl -f http://localhost:9600
```
- [ ] Returns 200 OK
- [ ] Pipeline loaded successfully
- [ ] No errors in logs

#### Kibana (Port 5601)
```bash
curl -f http://localhost:5601/api/status
```
- [ ] Returns 200 OK
- [ ] Web UI accessible at http://localhost:5601
- [ ] Elasticsearch connection successful

#### Jaeger (Port 16686)
```bash
curl -f http://localhost:16686
```
- [ ] Returns 200 OK
- [ ] Web UI accessible at http://localhost:16686
- [ ] Can search for traces

### Exporter Health Checks

#### Node Exporter (Port 9100)
```bash
curl -f http://localhost:9100/metrics | grep "node_cpu"
```
- [ ] Returns CPU metrics

#### Postgres Exporter (Port 9187)
```bash
curl -f http://localhost:9187/metrics | grep "pg_stat"
```
- [ ] Returns PostgreSQL metrics

#### Redis Exporter (Port 9121)
```bash
curl -f http://localhost:9121/metrics | grep "redis_"
```
- [ ] Returns Redis metrics

## ✅ Application Integration Verification

### Metrics Endpoint
```bash
curl http://localhost:3000/metrics
```
- [ ] Returns Prometheus-formatted metrics
- [ ] Contains `http_requests_total`
- [ ] Contains `http_request_duration_seconds`
- [ ] Contains `eduos_process_cpu_user_seconds_total`
- [ ] Contains custom business metrics

### Middleware Integration
Check `src/server.js`:
- [ ] `metricsMiddleware` imported
- [ ] `tracingMiddleware` imported
- [ ] `loggingMiddleware` imported
- [ ] Middleware applied in correct order
- [ ] `/metrics` endpoint exposed
- [ ] Jaeger tracer initialized

### Test Suite
```bash
npm test -- src/middleware/metricsMiddleware.test.js --runInBand
```
- [ ] All 14 tests passing
- [ ] No errors or warnings

## ✅ Functional Verification

### Metrics Collection
1. Make a few API requests:
```bash
curl http://localhost:3000/api/v1/health
curl http://localhost:3000/api/v1/health
curl http://localhost:3000/api/v1/health
```

2. Check metrics:
```bash
curl http://localhost:3000/metrics | grep "http_requests_total"
```
- [ ] Request counter incremented
- [ ] Metrics include method, route, status labels

### Prometheus Scraping
1. Wait 15 seconds for scrape interval
2. Check Prometheus targets:
   - Go to http://localhost:9090/targets
   - [ ] `eduos-api` target is UP
   - [ ] Last scrape successful
   - [ ] Metrics being collected

### Grafana Dashboards
1. Login to Grafana (http://localhost:3001)
2. Navigate to Dashboards
   - [ ] "EduOS - System Health" dashboard exists
   - [ ] "EduOS - API Performance" dashboard exists
   - [ ] Dashboards show data
   - [ ] Panels rendering correctly

### Distributed Tracing
1. Make an API request
2. Open Jaeger UI (http://localhost:16686)
3. Select "eduos-api" service
4. Click "Find Traces"
   - [ ] Traces appear in list
   - [ ] Can view trace details
   - [ ] Spans show timing information

### Log Aggregation
1. Make some API requests (including errors)
2. Wait 30 seconds for log processing
3. Open Kibana (http://localhost:5601)
4. Create index pattern if needed:
   - Management → Index Patterns
   - Pattern: `eduos-logs-*`
   - Time field: `@timestamp`
5. Go to Discover
   - [ ] Logs appearing in Kibana
   - [ ] Can filter by service
   - [ ] Can filter by level
   - [ ] Error logs in separate index

### Alerting
1. Check Prometheus alerts:
   - Go to http://localhost:9090/alerts
   - [ ] Alert rules loaded
   - [ ] No firing alerts (in healthy state)

2. Check Alertmanager:
   - Go to http://localhost:9093
   - [ ] Alert routing configured
   - [ ] Receivers configured

## ✅ Performance Verification

### Metrics Overhead
1. Run performance test:
```bash
npm test -- src/middleware/metricsMiddleware.test.js --runInBand --testNamePattern="Performance"
```
- [ ] 100 requests complete in < 5 seconds
- [ ] Concurrent requests handled correctly

### Resource Usage
Check Docker stats:
```bash
docker stats --no-stream
```
- [ ] Prometheus memory < 500MB
- [ ] Grafana memory < 300MB
- [ ] Elasticsearch memory < 1GB
- [ ] Total CPU usage reasonable

## ✅ Security Verification

### Access Control
- [ ] Grafana requires authentication
- [ ] Default admin password changed (production)
- [ ] Sensitive data sanitized in logs
- [ ] Metrics endpoint accessible only internally (production)

### Network Security
- [ ] Monitoring ports not exposed externally (production)
- [ ] TLS enabled for external access (production)
- [ ] Firewall rules configured (production)

## ✅ Documentation Verification

### Documentation Files
- [ ] `monitoring/README.md` exists and is complete
- [ ] `monitoring/QUICK_REFERENCE.md` exists
- [ ] `docs/MONITORING_SETUP_SUMMARY.md` exists
- [ ] Setup scripts documented

### Code Documentation
- [ ] Middleware files have JSDoc comments
- [ ] Configuration files have inline comments
- [ ] Alert rules have descriptions

## ✅ Backup and Recovery

### Configuration Backup
- [ ] Prometheus data backed up
- [ ] Grafana dashboards exported
- [ ] Alert rules version controlled
- [ ] Configuration files in git

### Recovery Testing
- [ ] Can restore Prometheus data
- [ ] Can restore Grafana dashboards
- [ ] Can recreate monitoring stack from scratch

## 🎯 Production Readiness Checklist

### Before Production Deployment
- [ ] All verification steps above completed
- [ ] Alert notification channels configured (Email, Slack, PagerDuty)
- [ ] Alert notification channels tested
- [ ] On-call rotation configured
- [ ] Runbooks created for common alerts
- [ ] Data retention policies configured
- [ ] Backup procedures documented
- [ ] Disaster recovery plan tested
- [ ] Security hardening completed
- [ ] Performance tuning completed
- [ ] Team trained on monitoring tools

### Production Monitoring
- [ ] SLO/SLA targets defined
- [ ] Critical alerts configured
- [ ] Dashboard for business metrics
- [ ] Capacity planning metrics tracked
- [ ] Cost monitoring enabled

## 📊 Success Criteria

The monitoring stack is considered fully operational when:

1. ✅ All services are running and healthy
2. ✅ Metrics are being collected from all sources
3. ✅ Dashboards display real-time data
4. ✅ Alerts are configured and tested
5. ✅ Distributed tracing captures request flows
6. ✅ Logs are aggregated and searchable
7. ✅ Performance overhead is acceptable (< 5ms per request)
8. ✅ All tests passing (14/14)
9. ✅ Documentation is complete and accurate
10. ✅ Team is trained and ready to use the tools

## 🔧 Troubleshooting

If any verification step fails, refer to:
- `monitoring/README.md` - Troubleshooting section
- `monitoring/QUICK_REFERENCE.md` - Common commands
- Docker logs: `docker-compose logs <service>`
- Service-specific documentation

## 📝 Sign-Off

Once all verification steps are complete, document the results:

**Verified By:** ___________________  
**Date:** ___________________  
**Environment:** [ ] Development [ ] Staging [ ] Production  
**Status:** [ ] Pass [ ] Fail  
**Notes:** ___________________

---

**Last Updated:** 2026-02-07  
**Version:** 1.0
