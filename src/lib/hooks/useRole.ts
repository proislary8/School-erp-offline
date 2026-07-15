'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/lib/role'

interface UserProfile {
  id: string
  full_name: string
  role: UserRole
  is_active: boolean
}

let cachedProfile: UserProfile | null = null

/**
 * Client-side hook to get the current user's profile (role + full name).
 * Caches the result in module scope to avoid repeated DB calls.
 */
export function useRole(): { profile: UserProfile | null; role: UserRole | null; loading: boolean } {
  const [profile, setProfile] = useState<UserProfile | null>(cachedProfile)
  const [loading, setLoading] = useState(!cachedProfile)

  useEffect(() => {
    if (cachedProfile) {
      setProfile(cachedProfile)
      setLoading(false)
      return
    }

    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      supabase
        .from('user_profiles')
        .select('id, full_name, role, is_active')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            cachedProfile = data as UserProfile
            setProfile(data as UserProfile)
          }
          setLoading(false)
        })
    })
  }, [])

  return { profile, role: profile?.role ?? null, loading }
}
