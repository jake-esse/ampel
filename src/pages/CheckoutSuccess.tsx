import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

/**
 * Checkout Success Page
 *
 * Displayed after Stripe payment completes. Polls the database to wait for
 * the webhook to finish processing (granting shares and completing onboarding).
 *
 * Flow:
 * 1. User completes payment in embedded checkout
 * 2. Stripe fires `onComplete` callback → Navigate here
 * 3. Show success message immediately (payment confirmed by Stripe)
 * 4. Poll database every 1 second for `onboarding_completed_at`
 * 5. Once webhook sets the flag → Navigate to chat
 * 6. If 30 seconds pass → Navigate anyway (webhook completes async)
 *
 * Why Polling:
 * - Payment completes instantly but webhook may take 1-5 seconds
 * - Webhook is the single source of truth for share granting
 * - Can't trust frontend to know when webhook completes
 * - Polling is simple and works reliably
 *
 * Timeout Strategy:
 * - Normal webhook processing: 1-5 seconds
 * - 30-second timeout gives generous buffer
 * - Even if timeout occurs, webhook completes asynchronously
 * - User gets into app, shares will be there
 *
 * References:
 * - Webhook Handler: /supabase/functions/stripe-webhook/index.ts
 * - Phase 4: /src/pages/Checkout.tsx (navigates here via onComplete)
 */
export default function CheckoutSuccess() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Polling state
  const [isPolling, setIsPolling] = useState(true)
  const [secondsElapsed, setSecondsElapsed] = useState(0)

  // Maximum time to wait for webhook (30 seconds)
  const TIMEOUT_SECONDS = 30
  // Poll interval (1 second)
  const POLL_INTERVAL_MS = 1000

  useEffect(() => {
    if (!user) {
      // User not authenticated - redirect to login
      navigate('/login', { replace: true })
      return
    }

    let pollInterval: NodeJS.Timeout | null = null
    let timeoutTimer: NodeJS.Timeout | null = null
    let isMounted = true

    /**
     * Check if webhook has completed onboarding.
     * Query the profile for `onboarding_completed_at` field.
     * If set, webhook has finished processing and we can redirect.
     */
    async function checkOnboardingComplete() {
      if (!isMounted || !user) return

      try {
        console.log('Polling for onboarding completion...')

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('onboarding_completed_at')
          .eq('id', user.id)
          .single()

        if (error) {
          console.error('Error checking onboarding status:', error)
          return
        }

        // Webhook has completed - onboarding is done
        if (profile?.onboarding_completed_at) {
          console.log('Onboarding completed at:', profile.onboarding_completed_at)
          console.log('Redirecting to chat...')

          // Stop polling
          setIsPolling(false)
          if (pollInterval) clearInterval(pollInterval)
          if (timeoutTimer) clearTimeout(timeoutTimer)

          // Navigate to chat
          // Use replace to prevent back button returning here
          navigate('/chat', { replace: true })
        }
      } catch (err) {
        console.error('Unexpected error during polling:', err)
        // Continue polling despite errors
      }
    }

    /**
     * Handle timeout - redirect even if webhook hasn't completed yet.
     * Webhook will finish asynchronously and user will have shares.
     */
    function handleTimeout() {
      if (!isMounted) return

      console.warn(`Timeout after ${TIMEOUT_SECONDS} seconds - redirecting to chat`)
      console.log('Note: Webhook will complete asynchronously, shares will be granted')

      setIsPolling(false)
      if (pollInterval) clearInterval(pollInterval)

      // Navigate to chat anyway
      navigate('/chat', { replace: true })
    }

    // Check immediately on mount (webhook might have completed already)
    checkOnboardingComplete()

    // Start polling every 1 second
    pollInterval = setInterval(() => {
      if (isMounted) {
        setSecondsElapsed((prev) => prev + 1)
        checkOnboardingComplete()
      }
    }, POLL_INTERVAL_MS)

    // Set timeout to redirect after 30 seconds
    timeoutTimer = setTimeout(handleTimeout, TIMEOUT_SECONDS * 1000)

    // Cleanup on unmount
    return () => {
      isMounted = false
      if (pollInterval) clearInterval(pollInterval)
      if (timeoutTimer) clearTimeout(timeoutTimer)
      console.log('CheckoutSuccess: Cleanup complete')
    }
  }, [user, navigate])

  return (
    <div
      className="min-h-screen bg-[#FDFCFA] flex items-center justify-center px-4"
      style={{
        paddingTop: 'max(2rem, env(safe-area-inset-top))',
        paddingBottom: 'max(2rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="max-w-md w-full text-center">
        {/* Success Icon */}
        <div className="w-24 h-24 bg-green-100 rounded-full mx-auto flex items-center justify-center mb-6">
          <Check className="w-12 h-12 text-green-600" strokeWidth={3} />
        </div>

        {/* Success Heading */}
        <h1 className="text-3xl font-serif font-semibold text-gray-900 mb-3">
          Payment Successful!
        </h1>

        {/* Processing Message */}
        <p className="text-base text-gray-600 mb-8">
          Setting up your account and granting your shares...
        </p>

        {/* Loading Animation */}
        {isPolling && (
          <div className="flex items-center justify-center gap-2 mb-4">
            <svg
              className="animate-spin h-6 w-6 text-[#30302E]"
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
            <span className="text-sm text-gray-500">
              Processing... ({secondsElapsed}s)
            </span>
          </div>
        )}

        {/* Info Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-6">
          <p className="text-sm text-blue-900">
            This usually takes just a few seconds. You'll be redirected to your chat automatically.
          </p>
        </div>

        {/* Timeout Warning (only show after 15 seconds) */}
        {secondsElapsed >= 15 && isPolling && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mt-4">
            <p className="text-sm text-yellow-900">
              Taking longer than expected. Don't worry - we're still processing your payment.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
