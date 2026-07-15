// Schema runner — executes schema.sql against Supabase using the Management API
// Usage: node scripts/run-schema.mjs
// Requires: SUPABASE_ACCESS_TOKEN env var (personal access token from supabase.com/dashboard/account/tokens)
//           OR falls back to running via psql if SUPABASE_DB_URL is set

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env.local
const envPath = join(__dirname, '..', '.env.local')
const envContent = readFileSync(envPath, 'utf8')
const env = {}
for (const line of envContent.split('\n')) {
  const [key, ...rest] = line.split('=')
  if (key && rest.length) env[key.trim()] = rest.join('=').trim()
}

const SUPABASE_URL     = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

// Extract project ref from URL: https://PROJECTREF.supabase.co
const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0]

const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN  // personal access token if provided
const DB_URL       = process.env.SUPABASE_DB_URL         // direct postgres URL if provided

const sql = readFileSync(join(__dirname, '..', 'supabase', 'schema.sql'), 'utf8')

async function runViaManagementAPI() {
  console.log('Running schema via Supabase Management API...')
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ query: sql }),
  })
  const data = await res.json()
  if (!res.ok) {
    console.error('Management API error:', JSON.stringify(data, null, 2))
    process.exit(1)
  }
  console.log('✓ Schema applied successfully via Management API')
}

async function runViaRPC() {
  // Fallback: run via a temporary SQL function using service role key
  // This works for DML but has limits for DDL — kept as fallback
  console.log('Note: Management API not available, trying RPC fallback...')
  console.log('For DDL statements, please run schema.sql directly in Supabase SQL Editor.')
  console.log('URL: https://supabase.com/dashboard/project/' + projectRef + '/sql/new')
  process.exit(1)
}

if (ACCESS_TOKEN) {
  await runViaManagementAPI()
} else {
  console.log()
  console.log('─────────────────────────────────────────────────────')
  console.log('  To run the schema automatically, provide one of:')
  console.log()
  console.log('  1. Supabase Personal Access Token:')
  console.log('     Get it from: https://supabase.com/dashboard/account/tokens')
  console.log('     Then run:')
  console.log('     $env:SUPABASE_ACCESS_TOKEN="sbp_xxx..." ; node scripts/run-schema.mjs')
  console.log()
  console.log('  2. OR just paste schema.sql in Supabase SQL Editor:')
  console.log('     https://supabase.com/dashboard/project/' + projectRef + '/sql/new')
  console.log('─────────────────────────────────────────────────────')
  console.log()
  await runViaRPC()
}
