import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { getTierPrice } from '@/lib/database/subscriptions'
import { calculateSubscriptionShares } from '@/lib/database/equity'
import { completeOnboardingAndGrantShares } from '@/lib/database/onboarding'
import { useToast } from '@/hooks/useToast'

/**
 * Checkout Page (Placeholder)
 *
 * This is a placeholder page for Phase 1. In Phase 2, this page will:
 * 1. Create a Stripe Checkout session
 * 2. Redirect to Stripe for payment
 * 3. Handle payment success/failure webhooks
 * 4. Update onboarding_completed_at after successful payment
 *
 * For now, it shows the selected plan and automatically redirects to chat
 * after a brief delay to simulate the checkout flow.
 *
 * TODO (Phase 2):
 * - Integrate Stripe Checkout
 * - Create Stripe Customer
 * - Create Stripe Subscription
 * - Handle webhooks for payment confirmation
 * - Update subscription_status to 'active'
 * - Set onboarding_completed_at timestamp
 */
export default function Checkout() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [planDetails, setPlanDetails] = useState<{
    tier: string
    name: string
    price: number
    shares: number
  } | null>(null)
  const [countdown, setCountdown] = useState(3)

  // Load user's selected plan
  useEffect(() => {
    async function loadPlan() {
      if (!user) return

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('selected_subscription_tier')
        .eq('id', user.id)
        .single()

      if (error || !profile?.selected_subscription_tier) {
        console.error('Error loading plan:', error)
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
    }

    loadPlan()
  }, [user, navigate])

  // Countdown timer and redirect
  useEffect(() => {
    if (!planDetails) return

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // TODO: In Phase 2, redirect to Stripe Checkout instead
          // For now, complete onboarding, grant shares, and redirect to chat
          if (user) {
            completeOnboardingAndGrantShares(user.id)
              .then(() => {
                showToast({
                  type: 'info',
                  message: '🎉 Welcome to Ampel! Your shares have been granted.'
                })
                navigate('/chat', { replace: true })
              })
              .catch(error => {
                console.error('Error completing onboarding:', error)
                showToast({
                  type: 'error',
                  message: 'Failed to complete onboarding. Please contact support.'
                })
              })
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [planDetails, user, navigate, showToast])

  if (!planDetails) {
    return (
      <div className="min-h-screen bg-[#FDFCFA] flex items-center justify-center">
        <svg
          className="animate-spin h-12 w-12 text-[#30302E]"
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

  return (
    <div
      className="min-h-screen bg-[#FDFCFA] flex items-center justify-center px-4"
      style={{
        paddingTop: 'max(2rem, env(safe-area-inset-top))',
        paddingBottom: 'max(2rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="max-w-md w-full">
        {/* Success Icon */}
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-green-100 rounded-full mx-auto flex items-center justify-center mb-4">
            <Check className="w-10 h-10 text-green-600" strokeWidth={3} />
          </div>
          <h1 className="text-2xl font-serif font-semibold text-gray-900 mb-2">
            Identity Verified!
          </h1>
          <p className="text-base text-gray-600">
            You're all set to complete your subscription
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

        {/* Phase 2 Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-blue-900 text-center">
            <strong>Coming Soon:</strong> Stripe payment integration will be added in Phase 2.
            For now, redirecting you to the app in {countdown} seconds...
          </p>
        </div>

        {/* Placeholder Button */}
        <button
          onClick={() => {
            if (user) {
              completeOnboardingAndGrantShares(user.id)
                .then(() => {
                  showToast({
                    type: 'info',
                    message: '🎉 Welcome to Ampel! Your shares have been granted.'
                  })
                  navigate('/chat', { replace: true })
                })
                .catch(error => {
                  console.error('Error completing onboarding:', error)
                  showToast({
                    type: 'error',
                    message: 'Failed to complete onboarding. Please contact support.'
                  })
                })
            }
          }}
          className="w-full px-4 py-3 bg-[#30302E] hover:bg-primary-700 text-white rounded-xl font-medium text-base transition-all duration-150 active:scale-[0.98] min-h-[48px]"
        >
          Continue to App
        </button>
      </div>
    </div>
  )
}
