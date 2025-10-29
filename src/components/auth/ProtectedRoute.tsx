import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/database'

interface ProtectedRouteProps {
  children: React.ReactNode
}

/**
 * Wrapper component that protects routes requiring authentication
 * Enforces the onboarding flow sequence:
 *
 * Flow Order:
 * 1. Authentication check (redirect to login if not authenticated)
 * 2. Equity intro & plan selection (redirect to /onboarding/equity if no tier selected)
 * 3. Disclosures acceptance (redirect to /disclosures if not accepted)
 * 4. KYC verification (redirect based on kyc_status)
 * 5. Checkout/payment (redirect to /checkout if KYC approved but onboarding incomplete)
 * 6. Allow access to protected routes
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth()
  const location = useLocation()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)

  // Check if we're navigating from disclosures after acceptance
  const disclosuresJustAccepted = location.state?.disclosuresAccepted === true

  // Check if we're navigating from plan selection after choosing a tier
  const tierJustSelected = location.state?.tierJustSelected === true

  // Check if we're navigating from KYC after approval
  const kycJustApproved = location.state?.kycJustApproved === true

  // Fetch user profile when authenticated
  // ONLY refetch when user ID changes, tier was just selected, disclosures were just accepted, or KYC was just approved
  // Do NOT refetch on every route change to prevent unnecessary loading states
  useEffect(() => {
    async function fetchProfile() {
      if (!user) {
        setProfileLoading(false)
        setProfile(null)
        return
      }

      // Skip immediate fetch if tier was just selected
      // The database needs time to update
      if (tierJustSelected) {
        // Fetch the current profile first
        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (currentProfile) {
          // Set profile with a temporary tier to prevent redirect
          // This ensures we don't get redirected while the real tier update propagates
          setProfile({ ...currentProfile, selected_subscription_tier: currentProfile.selected_subscription_tier || 'pro' as any })
        }

        setProfileLoading(false)

        // Fetch fresh data after a delay to get the actual updated tier
        setTimeout(async () => {
          try {
            const { data, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', user!.id) // We already checked user exists above
              .single()

            if (!error && data) {
              setProfile(data)
            }
          } catch (error) {
            console.error('Error fetching profile after tier selection:', error)
          }
        }, 1500) // Increased delay to ensure database update completes
        return
      }

      // Skip immediate fetch if disclosures were just accepted
      // The delay in Disclosures.tsx ensures the database is updated
      if (disclosuresJustAccepted) {
        // Set a temporary profile with disclosures accepted
        setProfile(prev => prev ? { ...prev, disclosures_accepted_at: new Date().toISOString() } : null)
        setProfileLoading(false)

        // Fetch fresh data after a delay to confirm
        setTimeout(async () => {
          try {
            const { data, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', user!.id) // We already checked user exists above
              .single()

            if (!error && data) {
              setProfile(data)
            }
          } catch (error) {
            console.error('Error fetching profile:', error)
          }
        }, 1000)
        return
      }

      // If KYC was just approved, fetch fresh profile immediately
      // The database has already been updated by Persona's webhook by this point
      if (kycJustApproved) {
        setProfileLoading(true)

        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()

          if (!error && data) {
            console.log('✅ ProtectedRoute: Fetched fresh profile after KYC approval, status:', data.kyc_status)
            setProfile(data)
          } else {
            console.error('❌ ProtectedRoute: Error fetching profile after KYC:', error)
          }
        } catch (error) {
          console.error('❌ ProtectedRoute: Exception fetching profile after KYC:', error)
        } finally {
          setProfileLoading(false)
        }
        return
      }

      // If we already have a profile for this user, don't refetch
      // This prevents unnecessary loading states when navigating between routes
      if (profile && profile.id === user.id) {
        setProfileLoading(false)
        return
      }

      setProfileLoading(true)

      // Try to fetch profile with retry logic for new users
      let retryCount = 0
      const maxRetries = 3
      const retryDelay = 1000 // 1 second

      async function fetchWithRetry() {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user!.id) // We already checked user exists above
            .single()

          if (error) {
            console.error('Error fetching profile:', error)

            // If profile doesn't exist and we haven't exceeded retries, wait and try again
            // This handles the case where the trigger might be slow
            if (error.code === 'PGRST116' && retryCount < maxRetries) {
              retryCount++
              console.log(`Profile not found, retrying in ${retryDelay}ms (attempt ${retryCount}/${maxRetries})`)
              setTimeout(fetchWithRetry, retryDelay)
              return
            }

            // After retries, still no profile - this shouldn't happen
            setProfile(null)
            setProfileLoading(false)
          } else {
            setProfile(data)
            setProfileLoading(false)
          }
        } catch (error) {
          console.error('Error fetching profile:', error)

          if (retryCount < maxRetries) {
            retryCount++
            setTimeout(fetchWithRetry, retryDelay)
          } else {
            setProfile(null)
            setProfileLoading(false)
          }
        }
      }

      fetchWithRetry()
    }

    fetchProfile()
  }, [user?.id, disclosuresJustAccepted, tierJustSelected, kycJustApproved]) // Only depend on user ID and navigation states

  // Show loading spinner while checking auth status or profile
  if (authLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#FDFCFA]">
        <svg
          className="animate-spin h-8 w-8 text-[#30302E]"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      </div>
    )
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/" replace />
  }

  // Wait for profile to load before making routing decisions
  // Don't redirect if profile is still loading or being fetched
  if (!profile) {
    // If we have a user but no profile after loading completes, something went wrong
    // Show a loading state while we figure it out
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#FDFCFA]">
        <svg
          className="animate-spin h-8 w-8 text-[#30302E]"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      </div>
    )
  }

  // SPECIAL CASE: Allow access to checkout for approved users
  // Once a user with approved KYC lands on /checkout, don't redirect them away
  // This prevents race conditions or timing issues from breaking the checkout flow
  if (location.pathname === '/checkout' && profile.kyc_status === 'approved') {
    return <>{children}</>
  }

  // ONBOARDING FLOW ENFORCEMENT
  // Check each step in sequence and redirect if incomplete

  // Step 1: Equity intro & plan selection
  // Users must select a subscription tier before proceeding
  const needsPlanSelection = !profile.selected_subscription_tier
  const isOnOnboardingPages = location.pathname === '/onboarding/equity' || location.pathname === '/onboarding/plans'

  // Don't redirect if tier was just selected and we're navigating to disclosures
  // The profile will update shortly
  if (needsPlanSelection && !isOnOnboardingPages && !tierJustSelected) {
    return <Navigate to="/onboarding/equity" replace />
  }

  // Step 2: Disclosures acceptance
  // Users must accept legal disclosures after selecting a plan
  const needsDisclosures = profile.selected_subscription_tier && !profile.disclosures_accepted_at
  const isOnDisclosuresPage = location.pathname === '/disclosures'

  if (needsDisclosures && !isOnDisclosuresPage) {
    return <Navigate to="/disclosures" replace />
  }

  // Step 3: KYC verification
  // Users must complete identity verification after accepting disclosures
  const hasAcceptedDisclosures = profile.disclosures_accepted_at
  const kycStatus = profile.kyc_status

  if (hasAcceptedDisclosures && kycStatus !== 'approved') {
    // Handle different KYC states
    const isOnKYCPages = location.pathname === '/kyc' || location.pathname === '/kyc-pending' || location.pathname === '/kyc-declined'

    if (!isOnKYCPages) {
      // Redirect to appropriate KYC page based on status
      if (kycStatus === 'pending') {
        return <Navigate to="/kyc-pending" replace />
      } else if (kycStatus === 'declined' || kycStatus === 'needs_review') {
        return <Navigate to="/kyc-declined" replace />
      } else if (kycStatus === 'not_started') {
        return <Navigate to="/kyc" replace />
      }
    }
  }

  // Step 4: Checkout/payment
  // Users must complete payment after KYC approval
  const needsCheckout = kycStatus === 'approved' && !profile.onboarding_completed_at
  const isOnCheckoutPages = location.pathname === '/checkout' || location.pathname === '/checkout-success'

  if (needsCheckout && !isOnCheckoutPages) {
    return <Navigate to="/checkout" replace />
  }

  // All onboarding steps complete - allow access to protected routes
  return <>{children}</>
}
