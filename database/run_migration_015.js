/**
 * Run Migration 015: AI Approval Queue System
 * 
 * This script applies the AI approval queue migration to the database.
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

async function runMigration() {
    const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'eduos_db',
        user: process.env.DB_USER || 'eduos_app',
        password: process.env.DB_PASSWORD,
    });

    let client;

    try {
        client = await pool.connect();
        console.log('✅ Connected to database');

        // Read migration file
        const migrationPath = path.join(__dirname, 'migrations', '015_approval_queue.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        console.log('📄 Running migration 015: AI Approval Queue System...');

        // Execute migration
        await client.query(migrationSQL);

        console.log('✅ Migration 015 applied successfully!');

        // Verify tables were created
        const verifyQuery = `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('ai_recommendations', 'ai_approval_audit_log')
            ORDER BY table_name;
        `;

        const result = await client.query(verifyQuery);
        console.log('\n📊 Created tables:');
        result.rows.forEach(row => {
            console.log(`   - ${row.table_name}`);
        });

        // Check RLS policies
        const rlsQuery = `
            SELECT schemaname, tablename, policyname
            FROM pg_policies
            WHERE tablename IN ('ai_recommendations', 'ai_approval_audit_log')
            ORDER BY tablename, policyname;
        `;

        const rlsResult = await client.query(rlsQuery);
        console.log('\n🔒 RLS Policies:');
        rlsResult.rows.forEach(row => {
            console.log(`   - ${row.tablename}: ${row.policyname}`);
        });

        // Check functions
        const functionsQuery = `
            SELECT routine_name
            FROM information_schema.routines
            WHERE routine_schema = 'public'
            AND routine_name IN ('get_pending_recommendations_count', 'expire_old_recommendations')
            ORDER BY routine_name;
        `;

        const functionsResult = await client.query(functionsQuery);
        console.log('\n⚙️  Functions:');
        functionsResult.rows.forEach(row => {
            console.log(`   - ${row.routine_name}()`);
        });

        console.log('\n✅ Migration 015 verification complete!');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        if (client) {
            client.release();
        }
        await pool.end();
    }
}

// Run migration
runMigration();
