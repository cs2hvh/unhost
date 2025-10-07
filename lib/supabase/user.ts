
import { headers } from 'next/headers'
import { User, UserRole } from './types'
import { SupabaseClient } from '@supabase/supabase-js'

export async function getUserFromHeaders(): Promise<User | null> {
  const headersList = await headers()

  const id = headersList.get('x-user-id')
  const email = headersList.get('x-user-email')
  const username = headersList.get('x-user-username')
  const rolesHeader = headersList.get('x-user-roles')

  if (!id || !email) {
    return null
  }

  // Parse roles from header (comma-separated string)
  let roles: UserRole[] = ['user'] // Default role
  if (rolesHeader) {
    try {
      roles = rolesHeader.split(',').map(r => r.trim() as UserRole)
    } catch {
      roles = ['user']
    }
  }

  return {
    id,
    email,
    username: username || '',
    roles
  }
}

export async function signInOrCreateUser(
  supabase: SupabaseClient<any, "public", "public", any, any>,
  email: string,
  password: string
) {
  // Try sign in first
  let { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // User might not exist
    if (error.message === 'Invalid login credentials') {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      })

      // If user already exists, try signing in again
      if (signUpError?.message === 'User already registered') {
        const { data: signInData, error: signInError } =
          await supabase.auth.signInWithPassword({ email, password })

        if (signInError) throw signInError
        data = signInData
      } else if (signUpError) {
        throw signUpError
      } else {
        data = signUpData
      }
    } else {
      throw error
    }
  }

  return data
}