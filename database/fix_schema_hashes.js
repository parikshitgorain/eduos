/**
 * Fix Schema Hashes - Regenerate all schema hashes using JavaScript computation
 * 
 * This script regenerates SHA-256 hashes for all existing schema snapshots
 * to ensure consistency between database and JavaScript hash computation.
 */

const { Pool } = require('pg');
const crypto = require('crypto');

// Load environment variables
require('dotenv').config();

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'eduos_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

/**
 * Recursively sort object keys to match PostgreSQL JSONB canonical form
 */
function sortKeysRecursive(obj) {
  if (obj === null || typeof obj !== 'object' || obj instanceof Date) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortKeysRecursive);
  }

  const sorted = {};
  Object.keys(obj)
    .sort()
    .forEach(key => {
      sorted[key] = sortKeysRecursive(obj[key]);
    });

  return sorted;
}

/**
 * Compute SHA-256 hash of schema definition (JavaScript implementation)
 */
function computeSchemaHash(schemaDefinition) {
  // Sort keys recursively to match PostgreSQL JSONB canonical form
  const sortedSchema = sortKeysRecursive(schemaDefinition);
  const schemaString = JSON.stringify(sortedSchema);
  return crypto.createHash('sha256').update(schemaString).digest('hex');
}

async function fixSchemaHashes() {
  const client = await pool.connect();
  
  try {
    console.log('Starting schema hash regeneration...\n');

    // Get all schema snapshots
    const result = await client.query(`
      SELECT snapshot_id, schema_definition, schema_hash as old_hash
      FROM schema_snapshots
      ORDER BY created_at
    `);

    console.log(`Found ${result.rows.length} schema snapshots to process\n`);

    let updated = 0;
    let unchanged = 0;
    let failed = 0;

    for (const snapshot of result.rows) {
      try {
        // Compute new hash using JavaScript
        const newHash = computeSchemaHash(snapshot.schema_definition);

        if (newHash === snapshot.old_hash) {
          unchanged++;
          console.log(`✓ Snapshot ${snapshot.snapshot_id}: Hash already correct`);
        } else {
          // Update the hash
          // Note: We need to temporarily disable the trigger to allow updates
          await client.query('SET session_replication_role = replica;');
          
          await client.query(`
            UPDATE schema_snapshots
            SET schema_hash = $1
            WHERE snapshot_id = $2
          `, [newHash, snapshot.snapshot_id]);

          await client.query('SET session_replication_role = DEFAULT;');

          updated++;
          console.log(`✓ Snapshot ${snapshot.snapshot_id}: Hash updated`);
          console.log(`  Old: ${snapshot.old_hash}`);
          console.log(`  New: ${newHash}`);
        }
      } catch (error) {
        failed++;
        console.error(`✗ Snapshot ${snapshot.snapshot_id}: Failed to update`);
        console.error(`  Error: ${error.message}`);
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Total snapshots: ${result.rows.length}`);
    console.log(`Updated: ${updated}`);
    console.log(`Unchanged: ${unchanged}`);
    console.log(`Failed: ${failed}`);

    if (failed === 0) {
      console.log(`\n✓ All schema hashes regenerated successfully!`);
    } else {
      console.log(`\n⚠ Some snapshots failed to update`);
    }

  } catch (error) {
    console.error('Error fixing schema hashes:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the script
fixSchemaHashes()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nFailed:', error);
    process.exit(1);
  });
