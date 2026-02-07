const { query } = require('../src/config/database');

async function checkSchema() {
  try {
    const tables = ['merge_snapshots', 'duplicate_review_queue'];
    
    for (const table of tables) {
      const result = await query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [table]);
      
      console.log(`\n${table} columns:`);
      result.rows.forEach(row => {
        console.log(`  ${row.column_name}: ${row.data_type}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkSchema();
