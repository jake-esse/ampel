import { supabase } from '../supabase'

export interface SignUpData {
  email: string
  password: string
}

export interface SignInData {
  email: string
  password: string
}

/**
 * Sign up a new user with email and password
 * Profile will be created automatically by database trigger
 */
export async function signUpWithEmail({ email, password }: SignUpData) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })

  if (error) throw error
  return data
}

/**
 * Sign in an existing user with email and password
 */
export async function signInWithEmail({ email, password }: SignInData) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) throw error
  return data
}
