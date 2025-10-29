import { supabase } from '../supabase'

export interface SignUpData {
  email: string
  password: string
  referralCode?: string
}

export interface SignInData {
  email: string
  password: string
}

/**
 * Sign up a new user with email and password
 * Profile will be created automatically by database trigger
 *
 * IMPORTANT: Shares are NOT granted at signup. They are only granted after:
 * 1. User completes KYC verification
 * 2. User completes Stripe payment
 * 3. Onboarding is fully completed
 *
 * @param {SignUpData} data - Email, password, and optional referral code
 * @throws Error if signup fails
 */
export async function signUpWithEmail({ email, password, referralCode }: SignUpData) {
  // Sign up the user
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })

  if (error) throw error

  // If signup succeeded and we have a user ID, store referral code for later
  if (data.user && referralCode && referralCode.trim().length > 0) {
    const userId = data.user.id

    try {
      // Store referral code in profile for later processing (after onboarding complete)
      await supabase
        .from('profiles')
        .update({
          pending_referral_code: referralCode.trim().toUpperCase()
        })
        .eq('id', userId)

      console.log('Referral code stored for later processing:', referralCode)
    } catch (error) {
      console.error('Error storing referral code:', error)
      // Don't throw - signup succeeded, referral can be handled manually if needed
    }
  }

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
