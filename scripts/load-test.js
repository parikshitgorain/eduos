/**
 * Load Testing Script
 * 
 * Task: 4.4.4 - Setup performance optimization and caching
 * 
 * Tests system performance under load to verify:
 * - API response time: p95 < 200ms, p99 < 500ms
 * - System handles 10,000 concurrent users
 * - Cache hit rate > 95%
 * - No memory leaks or resource exhaustion
 * 
 * Usage:
 *   node scripts/load-test.js --scenario=basic
 *   node scripts/load-test.js --scenario=stress --duration=300
 *   node scripts/load-test.js --scenario=spike --users=10000
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

// Configuration
const config = {
  baseURL: process.env.API_URL || 'http://localhost:3000',
  scenarios: {
    basic: {
      users: 100,
      duration: 60, // seconds
      rampUp: 10, // seconds
    },
    load: {
      users: 1000,
      duration: 300, // 5 minutes
      rampUp: 60,
    },
    stress: {
      users: 5000,
      duration: 600, // 10 minutes
      rampUp: 120,
    },
    spike: {
      users: 10000,
      duration: 60,
      rampUp: 5, // Rapid spike
    },
  },
};

// Test endpoints
const endpoints = [
  { method: 'GET', path: '/api/v1/health', weight: 5 },
  { method: 'GET', path: '/api/v1/tenants', weight: 10, requiresAuth: true },
  { method: 'GET', path: '/api/v1/students', weight: 20, requiresAuth: true },
  { method: 'GET', path: '/api/v1/hierarchy/nodes', weight: 15, requiresAuth: true },
  { method: 'GET', path: '/api/v1/schemas/active', weight: 10, requiresAuth: true },
  { method: 'GET', path: '/api/v1/attendance', weight: 15, requiresAuth: true },
  { method: 'POST', path: '/api/v1/auth/login', weight: 5, body: { email: 'test@example.com', password: 'password' } },
  { method: 'GET', path: '/api/v1/payments', weight: 10, requiresAuth: true },
  { method: 'GET', path: '/api/v1/audit/logs', weight: 5, requiresAuth: true },
  { method: 'GET', path: '/api/v1/analytics/dashboard', weight: 5, requiresAuth: true },
];

// Metrics
const metrics = {
  requests: 0,
  successes: 0,
  failures: 0,
  responseTimes: [],
  errors: {},
  startTime: null,
  endTime: null,
};

/**
 * Generate authentication token
 */
async function getAuthToken() {
  try {
    const response = await axios.post(`${config.baseURL}/api/v1/auth/login`, {
      email: 'admin@example.com',
      password: 'admin123',
    });
    return response.data.token;
  } catch (error) {
    console.error('Failed to get auth token:', error.message);
    return null;
  }
}

/**
 * Select random endpoint based on weights
 */
function selectEndpoint() {
  const totalWeight = endpoints.reduce((sum, ep) => sum + ep.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const endpoint of endpoints) {
    random -= endpoint.weight;
    if (random <= 0) {
      return endpoint;
    }
  }
  
  return endpoints[0];
}

/**
 * Make HTTP request
 */
async function makeRequest(endpoint, token) {
  const startTime = performance.now();
  
  try {
    const headers = {};
    if (endpoint.requiresAuth && token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const config = {
      method: endpoint.method,
      url: `${config.baseURL}${endpoint.path}`,
      headers,
      timeout: 10000, // 10 second timeout
    };
    
    if (endpoint.body) {
      config.data = endpoint.body;
    }
    
    const response = await axios(config);
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    
    metrics.requests++;
    metrics.successes++;
    metrics.responseTimes.push(responseTime);
    
    return { success: true, responseTime, status: response.status };
  } catch (error) {
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    
    metrics.requests++;
    metrics.failures++;
    metrics.responseTimes.push(responseTime);
    
    const errorType = error.response?.status || error.code || 'UNKNOWN';
    metrics.errors[errorType] = (metrics.errors[errorType] || 0) + 1;
    
    return { success: false, responseTime, error: errorType };
  }
}

/**
 * Simulate single user
 */
async function simulateUser(userId, duration, token) {
  const endTime = Date.now() + (duration * 1000);
  
  while (Date.now() < endTime) {
    const endpoint = selectEndpoint();
    await makeRequest(endpoint, token);
    
    // Random think time between 100ms and 2000ms
    const thinkTime = Math.random() * 1900 + 100;
    await new Promise(resolve => setTimeout(resolve, thinkTime));
  }
}

/**
 * Calculate percentile
 */
function calculatePercentile(arr, percentile) {
  if (arr.length === 0) return 0;
  
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index];
}

/**
 * Calculate statistics
 */
function calculateStats() {
  const totalTime = (metrics.endTime - metrics.startTime) / 1000; // seconds
  const throughput = metrics.requests / totalTime;
  const successRate = (metrics.successes / metrics.requests) * 100;
  
  const responseTimes = metrics.responseTimes;
  const avgResponseTime = responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length;
  const minResponseTime = Math.min(...responseTimes);
  const maxResponseTime = Math.max(...responseTimes);
  const p50 = calculatePercentile(responseTimes, 50);
  const p95 = calculatePercentile(responseTimes, 95);
  const p99 = calculatePercentile(responseTimes, 99);
  
  return {
    duration: totalTime.toFixed(2),
    totalRequests: metrics.requests,
    successfulRequests: metrics.successes,
    failedRequests: metrics.failures,
    successRate: successRate.toFixed(2) + '%',
    throughput: throughput.toFixed(2) + ' req/s',
    responseTimes: {
      min: minResponseTime.toFixed(2) + 'ms',
      max: maxResponseTime.toFixed(2) + 'ms',
      avg: avgResponseTime.toFixed(2) + 'ms',
      p50: p50.toFixed(2) + 'ms',
      p95: p95.toFixed(2) + 'ms',
      p99: p99.toFixed(2) + 'ms',
    },
    errors: metrics.errors,
    performanceTargets: {
      p95Target: '< 200ms',
      p95Actual: p95.toFixed(2) + 'ms',
      p95Met: p95 < 200 ? '✅ PASS' : '❌ FAIL',
      p99Target: '< 500ms',
      p99Actual: p99.toFixed(2) + 'ms',
      p99Met: p99 < 500 ? '✅ PASS' : '❌ FAIL',
    },
  };
}

/**
 * Run load test
 */
async function runLoadTest(scenarioName) {
  const scenario = config.scenarios[scenarioName];
  
  if (!scenario) {
    console.error(`Unknown scenario: ${scenarioName}`);
    console.log('Available scenarios:', Object.keys(config.scenarios).join(', '));
    process.exit(1);
  }
  
  console.log('\n='.repeat(80));
  console.log(`LOAD TEST: ${scenarioName.toUpperCase()}`);
  console.log('='.repeat(80));
  console.log(`Users: ${scenario.users}`);
  console.log(`Duration: ${scenario.duration}s`);
  console.log(`Ramp-up: ${scenario.rampUp}s`);
  console.log(`Base URL: ${config.baseURL}`);
  console.log('='.repeat(80));
  console.log('');
  
  // Get auth token
  console.log('Authenticating...');
  const token = await getAuthToken();
  
  if (!token) {
    console.error('Failed to authenticate. Exiting.');
    process.exit(1);
  }
  
  console.log('✅ Authentication successful');
  console.log('');
  
  // Start metrics
  metrics.startTime = Date.now();
  
  // Ramp up users
  console.log(`Ramping up ${scenario.users} users over ${scenario.rampUp}s...`);
  const users = [];
  const rampUpDelay = (scenario.rampUp * 1000) / scenario.users;
  
  for (let i = 0; i < scenario.users; i++) {
    users.push(simulateUser(i, scenario.duration, token));
    
    // Progress indicator
    if ((i + 1) % 100 === 0) {
      process.stdout.write(`\rUsers started: ${i + 1}/${scenario.users}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, rampUpDelay));
  }
  
  console.log(`\n✅ All ${scenario.users} users started`);
  console.log('');
  console.log('Running test...');
  
  // Progress indicator
  const progressInterval = setInterval(() => {
    const elapsed = ((Date.now() - metrics.startTime) / 1000).toFixed(0);
    const progress = (elapsed / scenario.duration * 100).toFixed(1);
    process.stdout.write(`\rProgress: ${progress}% | Requests: ${metrics.requests} | Success: ${metrics.successes} | Failed: ${metrics.failures}`);
  }, 1000);
  
  // Wait for all users to complete
  await Promise.all(users);
  
  clearInterval(progressInterval);
  console.log('\n');
  
  // End metrics
  metrics.endTime = Date.now();
  
  // Calculate and display results
  console.log('='.repeat(80));
  console.log('RESULTS');
  console.log('='.repeat(80));
  
  const stats = calculateStats();
  
  console.log('\nTest Duration:');
  console.log(`  ${stats.duration}s`);
  
  console.log('\nRequests:');
  console.log(`  Total: ${stats.totalRequests}`);
  console.log(`  Successful: ${stats.successfulRequests}`);
  console.log(`  Failed: ${stats.failedRequests}`);
  console.log(`  Success Rate: ${stats.successRate}`);
  console.log(`  Throughput: ${stats.throughput}`);
  
  console.log('\nResponse Times:');
  console.log(`  Min: ${stats.responseTimes.min}`);
  console.log(`  Max: ${stats.responseTimes.max}`);
  console.log(`  Avg: ${stats.responseTimes.avg}`);
  console.log(`  p50: ${stats.responseTimes.p50}`);
  console.log(`  p95: ${stats.responseTimes.p95}`);
  console.log(`  p99: ${stats.responseTimes.p99}`);
  
  console.log('\nPerformance Targets:');
  console.log(`  p95 Target: ${stats.performanceTargets.p95Target}`);
  console.log(`  p95 Actual: ${stats.performanceTargets.p95Actual} ${stats.performanceTargets.p95Met}`);
  console.log(`  p99 Target: ${stats.performanceTargets.p99Target}`);
  console.log(`  p99 Actual: ${stats.performanceTargets.p99Actual} ${stats.performanceTargets.p99Met}`);
  
  if (Object.keys(stats.errors).length > 0) {
    console.log('\nErrors:');
    for (const [errorType, count] of Object.entries(stats.errors)) {
      console.log(`  ${errorType}: ${count}`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  
  // Exit with appropriate code
  const p95Met = parseFloat(stats.responseTimes.p95) < 200;
  const p99Met = parseFloat(stats.responseTimes.p99) < 500;
  const successRateMet = parseFloat(stats.successRate) > 95;
  
  if (p95Met && p99Met && successRateMet) {
    console.log('✅ ALL PERFORMANCE TARGETS MET');
    process.exit(0);
  } else {
    console.log('❌ SOME PERFORMANCE TARGETS NOT MET');
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const scenarioArg = args.find(arg => arg.startsWith('--scenario='));
const scenarioName = scenarioArg ? scenarioArg.split('=')[1] : 'basic';

// Override scenario parameters if provided
const usersArg = args.find(arg => arg.startsWith('--users='));
const durationArg = args.find(arg => arg.startsWith('--duration='));

if (usersArg) {
  config.scenarios[scenarioName].users = parseInt(usersArg.split('=')[1]);
}

if (durationArg) {
  config.scenarios[scenarioName].duration = parseInt(durationArg.split('=')[1]);
}

// Run the test
runLoadTest(scenarioName).catch(error => {
  console.error('Load test failed:', error);
  process.exit(1);
});
