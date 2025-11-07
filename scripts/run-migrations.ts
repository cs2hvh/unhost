import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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

async function runMigration(filePath: string): Promise<void> {
  const fileName = path.basename(filePath);
  console.log(`\n📄 Running migration: ${fileName}`);

  try {
    // Read the SQL file
    const sql = fs.readFileSync(filePath, 'utf-8');

    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql }).single();

    if (error) {
      // If exec_sql doesn't exist, try direct execution via REST API
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({ query: sql }),
      });

      if (!response.ok) {
        // Fall back to using pg connection via Supabase's database API
        // We'll execute raw SQL using the PostgREST API
        const { error: execError } = await supabase.rpc('exec', { sql });

        if (execError) {
          throw new Error(`Failed to execute SQL: ${execError.message}`);
        }
      }
    }

    console.log(`✅ Successfully executed: ${fileName}`);
  } catch (err) {
    console.error(`❌ Error executing ${fileName}:`, err);
    throw err;
  }
}

async function runAllMigrations(): Promise<void> {
  console.log('🚀 Starting database migrations...\n');

  const migrationsDir = path.join(process.cwd(), 'migrations');

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

  // Run migrations sequentially
  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    await runMigration(filePath);
  }

  console.log('\n✨ All migrations completed successfully!');
}

// Run migrations
runAllMigrations()
  .then(() => {
    console.log('\n🎉 Migration process finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration process failed:', error);
    process.exit(1);
  });
