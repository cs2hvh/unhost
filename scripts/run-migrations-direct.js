require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Load environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

async function executeMigrations() {
  console.log('🚀 Executing database migrations...\n');

  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('⚠️  No migration files found');
    return;
  }

  console.log(`Found ${files.length} migration file(s)\n`);

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    console.log(`\n${'─'.repeat(80)}`);
    console.log(`📄 Executing: ${file}`);
    console.log('─'.repeat(80));

    try {
      // Execute using Supabase REST API for raw SQL
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

      if (!response.ok) {
        // Try alternative: Execute via pg wire protocol
        // Supabase doesn't expose this directly via REST API
        // Let's use their connection pooler

        console.log('   ℹ️  Trying alternative execution method...');

        // Execute SQL using Supabase's connection string
        // Format: postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
        const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

        if (!projectRef) {
          throw new Error('Could not extract project reference from URL');
        }

        // Use pg library
        const { Client } = require('pg');

        // Supabase connection pooler URL
        const connectionString = `postgresql://postgres.${projectRef}:${SUPABASE_SERVICE_ROLE_KEY}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

        const client = new Client({ connectionString });

        await client.connect();
        await client.query(sql);
        await client.end();

        console.log(`   ✅ Successfully executed: ${file}`);
      } else {
        console.log(`   ✅ Successfully executed: ${file}`);
      }

    } catch (error) {
      console.error(`   ❌ Error:`, error.message);
      console.log('\n   Trying with pg client...\n');

      try {
        const { Client } = require('pg');
        const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

        const connectionString = `postgresql://postgres.${projectRef}:${SUPABASE_SERVICE_ROLE_KEY}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

        const client = new Client({ connectionString });
        await client.connect();
        await client.query(sql);
        await client.end();

        console.log(`   ✅ Successfully executed: ${file}`);
      } catch (pgError) {
        console.error(`   ❌ pg client error:`, pgError.message);
        throw pgError;
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✨ All migrations completed successfully!');
  console.log('='.repeat(80) + '\n');
}

executeMigrations()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed:', error.message);
    process.exit(1);
  });
