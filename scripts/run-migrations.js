require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  if (!SUPABASE_URL) console.error('  - NEXT_PUBLIC_SUPABASE_URL');
  if (!SUPABASE_SERVICE_ROLE_KEY) console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function executeSql(sql) {
  try {
    // Use fetch to directly call Supabase's REST API to execute raw SQL
    const postgrestUrl = SUPABASE_URL.replace(/\.supabase\.co$/, '.supabase.co');

    // For Supabase, we need to use their database connection string or SQL editor
    // The easiest way is to use a custom RPC function or execute via connection pooler

    // Split SQL into individual statements and execute them
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.toLowerCase().includes('create or replace function') ||
          statement.toLowerCase().includes('create function') ||
          statement.toLowerCase().includes('drop function')) {

        // For functions, we need to execute them as a single statement
        const fullStatement = sql.substring(
          sql.toLowerCase().indexOf(statement.toLowerCase().substring(0, 30)),
          sql.indexOf('$$;') + 3
        );

        console.log('  📝 Executing function creation...');

        // Execute via fetch to Supabase's query endpoint
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
        });

        break; // Functions are in one block
      }
    }

    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
}

async function runMigration(filePath) {
  const fileName = path.basename(filePath);
  console.log(`\n📄 Running migration: ${fileName}`);

  try {
    // Read the SQL file
    const sql = fs.readFileSync(filePath, 'utf-8');

    console.log(`\n⚠️  Please execute this SQL manually in your Supabase SQL Editor:`);
    console.log('─'.repeat(80));
    console.log(sql);
    console.log('─'.repeat(80));
    console.log(`\n💡 Copy the SQL above and run it in: ${SUPABASE_URL.replace('//', '//app.')}/project/_/sql/new`);

  } catch (err) {
    console.error(`❌ Error reading ${fileName}:`, err);
    throw err;
  }
}

async function runAllMigrations() {
  console.log('🚀 Database Migrations Runner\n');

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
  files.forEach((file, index) => {
    console.log(`  ${index + 1}. ${file}`);
  });

  // Display migrations content
  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    await runMigration(filePath);
  }

  console.log('\n' + '='.repeat(80));
  console.log('📋 INSTRUCTIONS:');
  console.log('='.repeat(80));
  console.log('1. Go to your Supabase project SQL Editor');
  console.log(`2. Visit: ${SUPABASE_URL.replace('https://', 'https://app.')}/project/_/sql/new`);
  console.log('3. Copy and paste each SQL block above into the editor');
  console.log('4. Click "Run" to execute each migration');
  console.log('5. Verify the functions were created successfully');
  console.log('='.repeat(80));
}

// Run migrations
runAllMigrations()
  .then(() => {
    console.log('\n✅ Migration files displayed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error:', error);
    process.exit(1);
  });
