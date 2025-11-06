require('dotenv').config();
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

async function executeMigrations() {
  console.log('🚀 Executing migrations...\n');

  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    console.log(`📄 Executing: ${file}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

    try {
      // Execute SQL using Supabase Management API
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          query: sql
        }),
      });

      const result = await response.text();

      if (!response.ok) {
        console.error(`❌ HTTP ${response.status}: ${result}`);
        throw new Error(`Failed to execute ${file}`);
      }

      console.log(`✅ Success: ${file}\n`);
    } catch (err) {
      console.error(`❌ Error:`, err.message);
      console.log('\n⚠️  Direct SQL execution via REST API is not available.');
      console.log('You need to execute the migrations manually in Supabase SQL Editor.\n');
      console.log(`Run: node scripts/migrate.js (to see the SQL)\n`);
      process.exit(1);
    }
  }

  console.log('✨ All migrations completed!\n');
}

executeMigrations().catch(console.error);
