/**
 * Run Migration 022: Security Monitoring and Incident Response
 * 
 * Task: 4.3.5 - Setup security monitoring and incident response
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'eduos',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('Starting Migration 022: Security Monitoring and Incident Response...\n');
    
    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', '022_security_monitoring.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Begin transaction
    await client.query('BEGIN');
    
    console.log('Executing migration...');
    
    // Execute migration
    await client.query(migrationSQL);
    
    console.log('✓ Migration executed successfully');
    
    // Verify tables created
    console.log('\nVerifying tables...');
    
    const tables = [
      'security_events',
      'security_alerts',
      'security_incidents',
      'incident_timeline',
      'alert_rules',
      'threat_intelligence'
    ];
    
    for (const table of tables) {
      const result = await client.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )`,
        [table]
      );
      
      if (result.rows[0].exists) {
        console.log(`✓ Table ${table} created`);
      } else {
        throw new Error(`Table ${table} not found`);
      }
    }
    
    // Verify views created
    console.log('\nVerifying views...');
    
    const views = [
      'security_dashboard_summary',
      'open_alerts_summary',
      'incident_response_metrics'
    ];
    
    for (const view of views) {
      const result = await client.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.views 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )`,
        [view]
      );
      
      if (result.rows[0].exists) {
        console.log(`✓ View ${view} created`);
      } else {
        throw new Error(`View ${view} not found`);
      }
    }
    
    // Verify functions created
    console.log('\nVerifying functions...');
    
    const functions = [
      'generate_incident_number',
      'update_updated_at_column'
    ];
    
    for (const func of functions) {
      const result = await client.query(
        `SELECT EXISTS (
          SELECT FROM pg_proc 
          WHERE proname = $1
        )`,
        [func]
      );
      
      if (result.rows[0].exists) {
        console.log(`✓ Function ${func} created`);
      } else {
        throw new Error(`Function ${func} not found`);
      }
    }
    
    // Verify sample alert rules
    console.log('\nVerifying sample alert rules...');
    
    const alertRulesResult = await client.query(
      'SELECT COUNT(*) as count FROM alert_rules'
    );
    
    console.log(`✓ ${alertRulesResult.rows[0].count} alert rules created`);
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('\n✅ Migration 022 completed successfully!\n');
    
    // Display summary
    console.log('Summary:');
    console.log('--------');
    console.log('Tables created: 6');
    console.log('Views created: 3');
    console.log('Functions created: 2');
    console.log(`Alert rules: ${alertRulesResult.rows[0].count}`);
    console.log('\nNext steps:');
    console.log('1. Review alert rules and customize as needed');
    console.log('2. Configure notification channels');
    console.log('3. Enable security monitoring in application');
    console.log('4. Review incident response playbook');
    console.log('\nDocumentation:');
    console.log('- docs/SECURITY_MONITORING_QUICK_START.md');
    console.log('- docs/INCIDENT_RESPONSE_PLAYBOOK.md');
    console.log('- docs/SOC2_AUDIT_PREPARATION.md');
    console.log('- docs/SECURITY_TRAINING_PROGRAM.md');
    
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
runMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
