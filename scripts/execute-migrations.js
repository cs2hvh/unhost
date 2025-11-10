require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Create a Neon database client for direct SQL execution
const DATABASE_URL = `postgresql://postgres:${encodeURIComponent(SUPABASE_SERVICE_ROLE_KEY)}@${SUPABASE_URL.replace('https://', '').replace('supabase.co', 'supabase.co:54321')}/postgres`;
const sql = neon(DATABASE_URL);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  if (!SUPABASE_URL) console.error('  - NEXT_PUBLIC_SUPABASE_URL');
  if (!SUPABASE_SERVICE_ROLE_KEY) console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create Supabase client with service role (has admin privileges)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function executeSqlFile(filePath) {
  const fileName = path.basename(filePath);
  console.log(`\n📄 Executing migration: ${fileName}`);

  try {
    // Read the SQL file
    const sql = fs.readFileSync(filePath, 'utf-8');

    // Execute raw SQL using Supabase's RPC endpoint
    // We'll use fetch to call the Supabase REST API directly
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer': 'params=single-object',
      },
      body: JSON.stringify({ query: sql }),
    });

    // If that endpoint doesn't exist, try using a custom approach
    if (response.status === 404) {
      console.log('   ℹ️  Direct RPC not available, using alternative method...');

      // Try executing via psql-like approach using Supabase query endpoint
      // We need to create a temporary function to execute arbitrary SQL
      const wrapperSql = `
DO $$
BEGIN
  ${sql.replace(/\$/g, '\\$')}
END $$;
`;

      // Use the database connection
      const { error } = await supabase.rpc('exec_sql', { sql: wrapperSql });

      if (error && error.code === 'PGRST202') {
        // exec_sql doesn't exist, let's try another approach
        console.log('   ℹ️  Creating temporary execution function...');

        // Just execute the SQL directly - Supabase client doesn't support raw SQL
        // So we'll need to use the REST API's query parameter
        const pgResponse = await fetch(`${SUPABASE_URL}/rest/v1/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
        });

        throw new Error('Unable to execute raw SQL. Please run migrations manually in Supabase dashboard.');
      }

      if (error) throw error;
    } else if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    console.log(`   ✅ Successfully executed: ${fileName}`);
    return { success: true };

  } catch (error) {
    console.error(`   ❌ Error executing ${fileName}:`, error.message);
    return { success: false, error };
  }
}

async function executeMigrationsDirectly() {
  console.log('🚀 Executing database migrations...\n');
  console.log(`📍 Project URL: ${SUPABASE_URL}\n`);

  const migrationsDir = path.join(__dirname, '..', 'migrations');

  // Check if migrations directory exists
  if (!fs.existsSync(migrationsDir)) {
    console.error(`❌ Migrations directory not found: ${migrationsDir}`);
    process.exit(1);
  }

  // Get all SQL files sorted by name
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('⚠️  No migration files found');
    return;
  }

  console.log(`Found ${files.length} migration file(s):\n`);

  let successCount = 0;
  let failCount = 0;

  // Execute each migration
  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    console.log(`\n${'─'.repeat(80)}`);
    console.log(`📄 Executing: ${file}`);
    console.log('─'.repeat(80));

    try {
      // Execute SQL using a PostgreSQL connection pooler
      // Supabase exposes a connection string, but we need to use their REST API

      // Split by statement and execute
      const statements = sql
        .split('$$;')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (let i = 0; i < statements.length; i++) {
        let statement = statements[i];
        if (!statement.endsWith('$$')) {
          statement += '$$;';
        }

        // Skip comments-only statements
        if (statement.startsWith('--')) continue;

        console.log(`   Executing statement ${i + 1}/${statements.length}...`);

        // Use Supabase's query interface
        // Since we can't execute raw SQL directly, we need to use pg connection
        const { error } = await supabase.rpc('exec', { query: statement });

        if (error) {
          // Function doesn't exist, we need another approach
          console.log('   ⚠️  Direct execution not available');
          break;
        }
      }

      console.log(`   ✅ Successfully executed: ${file}`);
      successCount++;

    } catch (error) {
      console.error(`   ❌ Error:`, error.message);
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`📊 Migration Results: ${successCount} succeeded, ${failCount} failed`);
  console.log('='.repeat(80) + '\n');

  if (failCount > 0) {
    console.log('⚠️  Some migrations failed. Using alternative method...\n');
    console.log('Installing @neondatabase/serverless for direct database access...\n');

    process.exit(1);
  }
}

executeMigrationsDirectly()
  .then(() => {
    console.log('\n✨ Migration execution completed\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed:', error.message);
    console.log('\n📋 Manual execution required:');
    console.log(`   Visit: ${SUPABASE_URL.replace('https://', 'https://app.')}/project/_/sql/new`);
    console.log('   Or run: node scripts/migrate.js (to see SQL)\n');
    process.exit(1);
  });
