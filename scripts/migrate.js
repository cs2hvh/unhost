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
  console.error('\n💡 Make sure your .env file is configured correctly');
  process.exit(1);
}

// Extract project ref from Supabase URL
const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

if (!projectRef) {
  console.error('❌ Invalid Supabase URL format');
  process.exit(1);
}

async function runMigration(filePath) {
  const fileName = path.basename(filePath);
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`📄 Migration: ${fileName}`);
  console.log('─'.repeat(80));

  try {
    // Read the SQL file
    const sql = fs.readFileSync(filePath, 'utf-8');
    console.log(sql);
    console.log('─'.repeat(80));

  } catch (err) {
    console.error(`❌ Error reading ${fileName}:`, err);
    throw err;
  }
}

async function main() {
  console.log('\n🗄️  Supabase Migration Tool\n');
  console.log(`📍 Project: ${projectRef}`);
  console.log(`🔗 URL: ${SUPABASE_URL}\n`);

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
    console.log('⚠️  No migration files found in migrations/');
    return;
  }

  console.log(`✅ Found ${files.length} migration file(s):\n`);
  files.forEach((file, index) => {
    console.log(`   ${index + 1}. ${file}`);
  });
  console.log();

  // Display migrations content
  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    await runMigration(filePath);
  }

  console.log('\n' + '='.repeat(80));
  console.log('📋 HOW TO EXECUTE THESE MIGRATIONS:');
  console.log('='.repeat(80));
  console.log('\n✨ Option 1: Supabase Dashboard (Recommended)\n');
  console.log(`   1. Open: https://supabase.com/dashboard/project/${projectRef}/sql/new`);
  console.log('   2. Copy each SQL block from above');
  console.log('   3. Paste into the SQL Editor');
  console.log('   4. Click "Run" to execute');
  console.log('   5. Repeat for each migration file\n');
  console.log('✨ Option 2: Supabase CLI\n');
  console.log('   1. Install: npm install -g supabase');
  console.log('   2. Login: supabase login');
  console.log('   3. Link: supabase link --project-ref ' + projectRef);
  console.log('   4. Run: supabase db push\n');
  console.log('✨ Option 3: Direct Database Connection\n');
  console.log('   1. Get your connection string from Supabase dashboard');
  console.log('   2. Use psql or any PostgreSQL client');
  console.log('   3. Execute: psql "your-connection-string" -f migrations/001_create_crypto_payment_function.sql\n');
  console.log('='.repeat(80));
  console.log('\n💡 After running migrations, verify the functions exist:');
  console.log('   Run this query in Supabase SQL Editor:\n');
  console.log('   SELECT routine_name FROM information_schema.routines');
  console.log('   WHERE routine_schema = \'public\'');
  console.log('   AND routine_name IN (\'crypto_create_payment\', \'crypto_callback\');\n');
  console.log('='.repeat(80) + '\n');
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error:', error.message);
    process.exit(1);
  });
