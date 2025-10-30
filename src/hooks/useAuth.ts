import { useState, useEffect } from 'react'
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { signInWithOAuth, type OAuthProvider } from '@/lib/auth/oauth'
import { applyReferralCode } from '@/lib/database/subscriptions'

interface UseAuthReturn {
  user: User | null
  session: Session | null
  loading: boolean
  signInWithProvider: (provider: OAuthProvider, referralCode?: string) => Promise<void>
  signOut: () => Promise<void>
}

/**
 * Hook for managing authentication state
 * Listens to Supabase auth state changes and provides auth methods
 */
export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  /**
   * Process referral code after OAuth sign-in
   * Retrieves code from localStorage and applies it if user hasn't used one yet
   */
  const processReferralCode = async (userId: string) => {
    try {
      // Check if there's a referral code in localStorage
      const referralCode = localStorage.getItem('ampel_referral_code')
      if (!referralCode || !referralCode.trim()) {
        return
      }

      // Fetch user's profile to check if they already have a referral code
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('referral_code_used')
        .eq('id', userId)
        .single()

      if (profileError) {
        console.error('Error fetching profile for referral code processing:', profileError)
        // Clean up localStorage even on error
        localStorage.removeItem('ampel_referral_code')
        return
      }

      // If user already has a referral code, don't apply another one
      if (profile?.referral_code_used) {
        console.log('User already has a referral code, skipping')
        localStorage.removeItem('ampel_referral_code')
        return
      }

      // Apply the referral code
      await applyReferralCode(userId, referralCode)
      console.log('Referral code applied successfully:', referralCode)

      // Clean up localStorage after successful application
      localStorage.removeItem('ampel_referral_code')
    } catch (error) {
      // Silent failure - referral codes are a bonus feature
      // Don't block the user's auth flow if something goes wrong
      console.error('Error processing referral code:', error)

      // Clean up localStorage even on error to prevent retry loops
      try {
        localStorage.removeItem('ampel_referral_code')
      } catch {
        // Ignore localStorage cleanup errors
      }
    }
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)

      // Process referral code after successful sign-in (Phase 3)
      if (event === 'SIGNED_IN' && session?.user) {
        await processReferralCode(session.user.id)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signInWithProvider = async (provider: OAuthProvider, referralCode?: string) => {
    setLoading(true)
    try {
      await signInWithOAuth(provider, referralCode)
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    setLoading(true)
    try {
      await supabase.auth.signOut()
    } finally {
      setLoading(false)
    }
  }

  return {
    user,
    session,
    loading,
    signInWithProvider,
    signOut,
  }
}
