import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, AlertCircle } from 'lucide-react'
import { loadStripe, Stripe } from '@stripe/stripe-js'
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { getTierPrice } from '@/lib/database/subscriptions'
import { calculateSubscriptionShares } from '@/lib/database/equity'

/**
 * Checkout Page
 *
 * Integrates Stripe embedded checkout for subscription payment.
 *
 * Flow:
 * 1. Load user's selected plan from database
 * 2. Initialize Stripe.js with publishable key
 * 3. Call edge function to create checkout session
 * 4. Render Stripe's embedded checkout component
 * 5. On payment success, navigate to success page
 *
 * Security:
 * - Frontend NEVER grants shares or completes onboarding
 * - Only the webhook handler grants shares after payment verification
 * - Edge function validates KYC status and tier selection
 *
 * References:
 * - Stripe Embedded Checkout: https://docs.stripe.com/payments/checkout/embedded
 * - Edge Function: /supabase/functions/create-checkout-session/index.ts
 * - Webhook Handler: /supabase/functions/stripe-webhook/index.ts
 */
export default function Checkout() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Plan details loaded from database
  const [planDetails, setPlanDetails] = useState<{
    tier: string
    name: string
    price: number
    shares: number
  } | null>(null)

  // Stripe instance and checkout session
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)

  // Loading states
  const [loadingSession, setLoadingSession] = useState(false)

  // Error state
  const [error, setError] = useState<string | null>(null)

  // Initialize Stripe.js on component mount
  useEffect(() => {
    const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY

    if (!publishableKey) {
      console.error('Missing VITE_STRIPE_PUBLISHABLE_KEY')
      setError('Payment system not configured')
      return
    }

    // Load Stripe.js once
    const stripe = loadStripe(publishableKey)
    setStripePromise(stripe)
  }, [])

  // Load user's selected plan from database
  useEffect(() => {
    async function loadPlan() {
      if (!user) return

      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('selected_subscription_tier')
          .eq('id', user.id)
          .single()

        if (profileError || !profile?.selected_subscription_tier) {
          console.error('Error loading plan:', profileError)
          navigate('/onboarding/plans', { replace: true })
          return
        }

        const tier = profile.selected_subscription_tier
        const tierNames: Record<string, string> = {
          starter: 'Starter',
          plus: 'Plus',
          pro: 'Pro',
          max: 'Max'
        }

        setPlanDetails({
          tier,
          name: tierNames[tier] || 'Unknown',
          price: getTierPrice(tier as 'starter' | 'plus' | 'pro' | 'max'),
          shares: calculateSubscriptionShares(tier as 'starter' | 'plus' | 'pro' | 'max')
        })
      } catch (err) {
        console.error('Unexpected error loading plan:', err)
        setError('Failed to load plan details')
      }
    }

    loadPlan()
  }, [user, navigate])

  // Create checkout session after plan loads
  useEffect(() => {
    if (!planDetails || clientSecret) return

    async function createCheckoutSession() {
      // Type guard - planDetails is checked in useEffect guard above
      if (!planDetails) return

      setLoadingSession(true)
      setError(null)

      try {
        // Check if user session is valid before calling function
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

        if (sessionError || !sessionData.session) {
          console.error('Session error:', sessionError || 'No session found')
          console.log('Redirecting to login due to missing session')
          navigate('/login', { replace: true })
          return
        }

        console.log('✅ Session validated, user:', sessionData.session.user.id)
        console.log('Session expires at:', new Date(sessionData.session.expires_at! * 1000).toISOString())

        // Map tier to price ID from environment variables
        const priceIdMap: Record<string, string> = {
          starter: import.meta.env.VITE_STRIPE_PRICE_STARTER,
          plus: import.meta.env.VITE_STRIPE_PRICE_PLUS,
          pro: import.meta.env.VITE_STRIPE_PRICE_PRO,
          max: import.meta.env.VITE_STRIPE_PRICE_MAX
        }

        const priceId = priceIdMap[planDetails.tier]

        if (!priceId) {
          console.error(`No price ID configured for tier: ${planDetails.tier}`)
          setError('Plan configuration error')
          return
        }

        console.log(`Creating checkout session for tier: ${planDetails.tier}, priceId: ${priceId}`)

        // Call edge function to create checkout session
        // Using direct fetch instead of supabase.functions.invoke() for better compatibility with Capacitor
        // Edge function validates KYC status and tier selection
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sessionData.session.access_token}`,
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
            },
            body: JSON.stringify({ priceId })
          }
        )

        console.log('Response status:', response.status)
        console.log('Response OK:', response.ok)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
          console.error('Edge function error:', errorData)

          const errorMessage = errorData.message || errorData.error || 'Unknown error'

          // Handle specific error cases
          if (errorMessage.includes('KYC')) {
            // KYC not approved - redirect to pending page
            navigate('/kyc-pending', { replace: true })
            return
          }

          if (errorMessage.includes('tier')) {
            // No tier selected - redirect to plan selection
            navigate('/onboarding/plans', { replace: true })
            return
          }

          // Generic error
          setError('Failed to create checkout session. Please try again.')
          return
        }

        const data = await response.json()
        console.log('Response data:', data)

        if (!data?.clientSecret) {
          console.error('No client secret in response:', data)
          setError('Invalid response from server')
          return
        }

        console.log('Checkout session created successfully')
        setClientSecret(data.clientSecret)
      } catch (err) {
        console.error('Unexpected error creating checkout session:', err)
        setError('Failed to load checkout. Please try again.')
      } finally {
        setLoadingSession(false)
      }
    }

    createCheckoutSession()
  }, [planDetails, clientSecret, navigate])

  // Handle payment completion
  // This callback is triggered by Stripe when payment succeeds
  // IMPORTANT: We don't grant shares here - only navigate to success page
  // The webhook handler verifies payment and grants shares
  const handleComplete = () => {
    console.log('Payment completed, navigating to success page')
    navigate('/checkout-success', { replace: true })
  }

  // Show loading spinner while loading plan details
  if (!planDetails) {
    return (
      <div className="min-h-screen bg-[#FDFCFA] flex flex-col items-center justify-center">
        <svg
          className="animate-spin h-12 w-12 text-[#30302E] mb-4"
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
        <p className="text-sm text-gray-600">Loading plan details...</p>
      </div>
    )
  }

  // Show loading spinner while creating checkout session
  if (loadingSession || !clientSecret) {
    return (
      <div className="min-h-screen bg-[#FDFCFA] flex flex-col items-center justify-center">
        <svg
          className="animate-spin h-12 w-12 text-[#30302E] mb-4"
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
        <p className="text-sm text-gray-600">Preparing checkout...</p>
      </div>
    )
  }

  // Show error state with retry button
  if (error) {
    return (
      <div
        className="min-h-screen bg-[#FDFCFA] flex items-center justify-center px-4"
        style={{
          paddingTop: 'max(2rem, env(safe-area-inset-top))',
          paddingBottom: 'max(2rem, env(safe-area-inset-bottom))',
        }}
      >
        <div className="max-w-md w-full">
          <div className="bg-white border border-red-200 rounded-xl p-6 shadow-sm text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full mx-auto flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-3 bg-[#30302E] hover:bg-primary-700 text-white rounded-xl font-medium text-base transition-all duration-150 active:scale-[0.98] min-h-[48px]"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Render embedded checkout
  return (
    <div
      className="h-screen bg-[#FDFCFA] overflow-y-auto px-4 py-8"
      style={{
        paddingTop: 'max(2rem, env(safe-area-inset-top))',
        paddingBottom: 'max(2rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="max-w-2xl mx-auto">
        {/* Success Icon and Header */}
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-green-100 rounded-full mx-auto flex items-center justify-center mb-4">
            <Check className="w-10 h-10 text-green-600" strokeWidth={3} />
          </div>
          <h1 className="text-2xl font-serif font-semibold text-gray-900 mb-2">
            Identity Verified!
          </h1>
          <p className="text-base text-gray-600">
            Complete your subscription to get started
          </p>
        </div>

        {/* Plan Summary Card */}
        <div className="bg-white border border-[#E5E3DD] rounded-xl p-6 shadow-sm mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Your Selected Plan
          </h2>

          <div className="space-y-3">
            {/* Plan Name */}
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Plan</span>
              <span className="text-base font-semibold text-gray-900">
                {planDetails.name}
              </span>
            </div>

            {/* Price */}
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Monthly Price</span>
              <span className="text-base font-semibold text-gray-900">
                ${planDetails.price}/month
              </span>
            </div>

            {/* Shares */}
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Monthly Shares</span>
              <span className="text-base font-semibold text-gray-900">
                {planDetails.shares} shares
              </span>
            </div>
          </div>
        </div>

        {/* Stripe Embedded Checkout */}
        {stripePromise && clientSecret && (
          <div className="bg-white border border-[#E5E3DD] rounded-xl overflow-hidden shadow-sm">
            <EmbeddedCheckoutProvider
              stripe={stripePromise}
              options={{
                clientSecret,
                onComplete: handleComplete
              }}
            >
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        )}
      </div>
    </div>
  )
}
