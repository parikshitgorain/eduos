/**
 * Fix merge snapshot functions - correct the delimiter issue
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'eduos',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function fixFunctions() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Fixing merge snapshot functions...\n');
    
    // Drop existing functions
    console.log('Dropping existing functions...');
    await client.query(`
      DROP FUNCTION IF EXISTS create_merge_snapshot(UUID, UUID, UUID[], UUID);
      DROP FUNCTION IF EXISTS compute_snapshot_hash(JSONB, JSONB);
      DROP FUNCTION IF EXISTS verify_snapshot_integrity(UUID);
    `);
    console.log('✅ Dropped old functions\n');
    
    // Recreate compute_snapshot_hash
    console.log('Creating compute_snapshot_hash function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION compute_snapshot_hash(
          p_primary_record JSONB,
          p_secondary_records JSONB
      ) RETURNS VARCHAR(64) AS $$
      DECLARE
          v_concatenated TEXT;
      BEGIN
          v_concatenated := p_primary_record::TEXT || p_secondary_records::TEXT;
          RETURN encode(digest(v_concatenated, 'sha256'), 'hex');
      END;
      $$ LANGUAGE plpgsql IMMUTABLE;
    `);
    console.log('✅ Created compute_snapshot_hash\n');
    
    // Recreate create_merge_snapshot
    console.log('Creating create_merge_snapshot function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION create_merge_snapshot(
          p_tenant_id UUID,
          p_primary_student_id UUID,
          p_secondary_student_ids UUID[],
          p_created_by UUID
      ) RETURNS UUID AS $$
      DECLARE
          v_snapshot_id UUID;
          v_primary_record JSONB;
          v_secondary_records JSONB;
          v_snapshot_hash VARCHAR(64);
      BEGIN
          SELECT row_to_json(s.*)::JSONB INTO v_primary_record
          FROM students s
          WHERE s.student_id = p_primary_student_id
            AND s.tenant_id = p_tenant_id;
          
          IF v_primary_record IS NULL THEN
              RAISE EXCEPTION 'Primary student record not found: %', p_primary_student_id;
          END IF;
          
          SELECT jsonb_agg(row_to_json(s.*)::JSONB) INTO v_secondary_records
          FROM students s
          WHERE s.student_id = ANY(p_secondary_student_ids)
            AND s.tenant_id = p_tenant_id;
          
          IF v_secondary_records IS NULL OR jsonb_array_length(v_secondary_records) = 0 THEN
              RAISE EXCEPTION 'No secondary student records found';
          END IF;
          
          v_snapshot_hash := compute_snapshot_hash(v_primary_record, v_secondary_records);
          
          INSERT INTO merge_snapshots (
              tenant_id,
              primary_record,
              secondary_records,
              snapshot_hash,
              created_by
          ) VALUES (
              p_tenant_id,
              v_primary_record,
              v_secondary_records,
              v_snapshot_hash,
              p_created_by
          ) RETURNING merge_snapshot_id INTO v_snapshot_id;
          
          RETURN v_snapshot_id;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ Created create_merge_snapshot\n');
    
    // Recreate verify_snapshot_integrity
    console.log('Creating verify_snapshot_integrity function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION verify_snapshot_integrity(
          p_merge_snapshot_id UUID
      ) RETURNS BOOLEAN AS $$
      DECLARE
          v_snapshot RECORD;
          v_computed_hash VARCHAR(64);
      BEGIN
          SELECT primary_record, secondary_records, snapshot_hash
          INTO v_snapshot
          FROM merge_snapshots
          WHERE merge_snapshot_id = p_merge_snapshot_id;
          
          IF NOT FOUND THEN
              RAISE EXCEPTION 'Snapshot not found: %', p_merge_snapshot_id;
          END IF;
          
          v_computed_hash := compute_snapshot_hash(
              v_snapshot.primary_record,
              v_snapshot.secondary_records
          );
          
          RETURN v_computed_hash = v_snapshot.snapshot_hash;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ Created verify_snapshot_integrity\n');
    
    console.log('✅ All functions fixed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing functions:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

fixFunctions();
