import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import type { UserRole } from '@/lib/role'

const execAsync = promisify(exec)

export async function POST() {
  // Auth check — only developer or super_admin can trigger this
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role as UserRole | null
  if (!role || !['developer', 'super_admin'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden: insufficient role' }, { status: 403 })
  }

  try {
    // Run git pull in the project root directory
    const { stdout, stderr } = await execAsync('git pull origin main', {
      cwd: process.cwd(),
      timeout: 30000, // 30s timeout
    })

    return NextResponse.json({
      output: stdout + (stderr ? '\n[stderr]\n' + stderr : ''),
    })
  } catch (err: unknown) {
    const error = err as { message?: string; stderr?: string }
    return NextResponse.json(
      { error: error.stderr ?? error.message ?? 'git pull failed' },
      { status: 500 }
    )
  }
}
