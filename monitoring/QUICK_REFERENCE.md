# Monitoring Stack - Quick Reference Card

## 🚀 Quick Start

```bash
# Start monitoring stack
docker-compose up -d prometheus grafana alertmanager elasticsearch logstash kibana jaeger

# Install dependencies
npm install

# Start your application
npm start
```

## 📊 Access URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **Prometheus** | http://localhost:9090 | Metrics & Alerts |
| **Grafana** | http://localhost:3001 | Dashboards (admin/admin) |
| **Jaeger** | http://localhost:16686 | Distributed Tracing |
| **Kibana** | http://localhost:5601 | Log Analysis |
| **Alertmanager** | http://localhost:9093 | Alert Management |
| **Metrics API** | http://localhost:3000/metrics | Prometheus Metrics |

## 🔧 Common Commands

### Docker Management
```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f prometheus grafana

# Restart a service
docker-compose restart prometheus
```

### Health Checks
```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Check metrics endpoint
curl http://localhost:3000/metrics

# Check Elasticsearch health
curl http://localhost:9200/_cluster/health
```

## 📈 Recording Custom Metrics

```javascript
const { 
  recordStudentEnrollment, 
  recordPayment,
  recordAttendance 
} = require('./middleware/metricsMiddleware');

// Record business events
recordStudentEnrollment('tenant-123', 'Computer Science');
recordPayment('tenant-456', 'success', 'stripe');
recordAttendance('tenant-789', 'present');
```

## 🔍 Distributed Tracing

```javascript
const { traceDbQuery, traceHttpCall } = require('./middleware/tracingMiddleware');

// Trace a database query
const result = await traceDbQuery(
  req.span,
  'SELECT * FROM students WHERE tenant_id = $1',
  [tenantId],
  async () => db.query(...)
);

// Trace an HTTP call
const response = await traceHttpCall(
  req.span,
  'POST',
  'http://ai-service:8000/inference',
  async (headers) => axios.post(url, data, { headers })
);
```

## 📝 Structured Logging

```javascript
const { logInfo, logError, logAudit } = require('./middleware/loggingMiddleware');

// Log info
logInfo('Student enrolled', { tenantId, studentId, program });

// Log error
logError('Payment failed', error, { tenantId, transactionId });

// Log audit event
logAudit('user.login', { userId, tenantId, ip });
```

## 🚨 Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| CPU Usage | > 80% | > 95% |
| Memory Usage | > 90% | > 95% |
| Disk Usage | > 85% | N/A |
| Error Rate | > 1% | > 5% |
| API Latency (P95) | > 500ms | > 2s |
| Cache Hit Rate | < 95% | N/A |

## 🔎 Useful Prometheus Queries

```promql
# Request rate by service
sum(rate(http_requests_total[5m])) by (service)

# Error rate percentage
(sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))) * 100

# P95 latency
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, service))

# Cache hit rate
(sum(rate(cache_hits_total[5m])) / (sum(rate(cache_hits_total[5m])) + sum(rate(cache_misses_total[5m])))) * 100
```

## 🔍 Kibana Search Queries

```
# Find errors in last hour
level:ERROR AND @timestamp:[now-1h TO now]

# Search by tenant
tenant_id:"tenant-123"

# Security events
tags:security

# Audit logs
tags:audit AND action:"user.login"
```

## 🛠️ Troubleshooting

### Prometheus Not Scraping
```bash
# Check targets
curl http://localhost:9090/api/v1/targets

# Verify metrics endpoint
curl http://localhost:3000/metrics

# Check Prometheus logs
docker-compose logs prometheus
```

### Grafana Dashboards Not Loading
```bash
# Test Prometheus connection
curl http://localhost:9090/api/v1/query?query=up

# Check Grafana logs
docker-compose logs grafana

# Restart Grafana
docker-compose restart grafana
```

### Logs Not in Kibana
```bash
# Check Logstash
docker-compose logs logstash

# Check Elasticsearch indices
curl http://localhost:9200/_cat/indices?v

# Create index pattern in Kibana
# Go to Management → Index Patterns → Create
# Pattern: eduos-logs-*
```

### Jaeger Not Showing Traces
```bash
# Check Jaeger agent
telnet localhost 6831

# Verify environment variables
echo $JAEGER_AGENT_HOST
echo $JAEGER_AGENT_PORT

# Check Jaeger logs
docker-compose logs jaeger
```

## 📚 Documentation

- Full Guide: `monitoring/README.md`
- Setup Summary: `docs/MONITORING_SETUP_SUMMARY.md`
- Prometheus: https://prometheus.io/docs/
- Grafana: https://grafana.com/docs/
- Jaeger: https://www.jaegertracing.io/docs/
- ELK Stack: https://www.elastic.co/guide/

## 🆘 Support

For issues or questions:
- Check logs: `docker-compose logs <service>`
- Review documentation: `monitoring/README.md`
- Contact: ops-team@eduos.platform

---

**Quick Tip:** Bookmark this page for easy reference! 🔖
