import { useState, useEffect } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { signUpWithEmail, signInWithEmail, type SignUpData, type SignInData } from '@/lib/auth/email'
import { signInWithOAuth, type OAuthProvider } from '@/lib/auth/oauth'

interface UseAuthReturn {
  user: User | null
  session: Session | null
  loading: boolean
  signUp: (data: SignUpData) => Promise<void>
  signIn: (data: SignInData) => Promise<void>
  signInWithProvider: (provider: OAuthProvider) => Promise<void>
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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (data: SignUpData) => {
    setLoading(true)
    try {
      await signUpWithEmail(data)
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (data: SignInData) => {
    setLoading(true)
    try {
      await signInWithEmail(data)
    } finally {
      setLoading(false)
    }
  }

  const signInWithProvider = async (provider: OAuthProvider) => {
    setLoading(true)
    try {
      await signInWithOAuth(provider)
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
    signUp,
    signIn,
    signInWithProvider,
    signOut,
  }
}
