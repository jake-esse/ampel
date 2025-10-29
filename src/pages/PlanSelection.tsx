import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { saveSubscriptionSelection } from '@/lib/database/subscriptions'

/**
 * Plan Selection Page
 *
 * Displays the four subscription tiers and allows users to select one.
 * The Pro ($10/mo) plan is highlighted as "Most Popular".
 *
 * Plans:
 * - Starter: $2/mo, 5 shares/month, AI Chat only
 * - Plus: $5/mo, 10 shares/month, AI Chat + Web Search
 * - Pro: $10/mo, 20 shares/month, AI Chat + Web Search + Reasoning (Most Popular)
 * - Max: $20/mo, 40 shares/month, Everything + Priority Support
 *
 * After selection, saves to database and navigates to /disclosures
 */

type SubscriptionTier = 'starter' | 'plus' | 'pro' | 'max'

interface Plan {
  tier: SubscriptionTier
  name: string
  price: number
  shares: number
  features: {
    name: string
    included: boolean
  }[]
  popular?: boolean
}

const plans: Plan[] = [
  {
    tier: 'starter',
    name: 'Starter',
    price: 2,
    shares: 5,
    features: [
      { name: 'AI Chat', included: true },
      { name: 'Web Search', included: false },
      { name: 'Advanced Reasoning', included: false },
    ]
  },
  {
    tier: 'plus',
    name: 'Plus',
    price: 5,
    shares: 10,
    features: [
      { name: 'AI Chat', included: true },
      { name: 'Web Search', included: true },
      { name: 'Advanced Reasoning', included: false },
    ]
  },
  {
    tier: 'pro',
    name: 'Pro',
    price: 10,
    shares: 20,
    features: [
      { name: 'AI Chat', included: true },
      { name: 'Web Search', included: true },
      { name: 'Advanced Reasoning', included: true },
    ],
    popular: true
  },
  {
    tier: 'max',
    name: 'Max',
    price: 20,
    shares: 40,
    features: [
      { name: 'AI Chat', included: true },
      { name: 'Web Search', included: true },
      { name: 'Advanced Reasoning', included: true },
    ]
  },
]

export default function PlanSelection() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSelectPlan = (tier: SubscriptionTier) => {
    setSelectedTier(tier)
  }

  const handleContinue = async () => {
    if (!selectedTier || !user) {
      return
    }

    setLoading(true)

    try {
      // Save the selected subscription tier to the database
      await saveSubscriptionSelection(user.id, selectedTier)

      // Wait a moment to ensure the database update has propagated
      await new Promise(resolve => setTimeout(resolve, 500))

      // Verify the update was successful by fetching the profile
      const { data: updatedProfile, error: verifyError } = await supabase
        .from('profiles')
        .select('selected_subscription_tier')
        .eq('id', user.id)
        .single()

      if (verifyError || !updatedProfile?.selected_subscription_tier) {
        throw new Error('Failed to verify subscription selection')
      }

      // Navigate to disclosures page with state to indicate tier was just selected
      // This helps ProtectedRoute know not to redirect while the profile updates
      navigate('/disclosures', { state: { tierJustSelected: true } })
    } catch (error) {
      console.error('Error saving subscription selection:', error)
      // Silently handle error - user can retry by selecting again
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen bg-[#FDFCFA] overflow-y-auto flex items-center justify-center"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="max-w-2xl w-full mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-4">
          <h1 className="text-3xl font-serif font-semibold text-gray-900 mb-1">
            Choose Your Plan
          </h1>
          <p className="text-base text-gray-600">
            Select the plan that's right for you
          </p>
        </div>

        {/* Plan Cards */}
        <div className="space-y-3 mb-4">
          {plans.map((plan) => {
            const isSelected = selectedTier === plan.tier

            return (
              <button
                key={plan.tier}
                onClick={() => handleSelectPlan(plan.tier)}
                disabled={loading}
                className={`w-full text-left bg-white rounded-xl p-4 transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed relative ${
                  isSelected
                    ? 'border-2 border-[#30302E] shadow-lg'
                    : 'border border-[#E5E3DD] shadow-sm hover:shadow-md'
                }`}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <div className="px-3 py-1 bg-[#30302E] text-white text-xs font-semibold rounded-full">
                      ⭐ MOST POPULAR
                    </div>
                  </div>
                )}

                {/* Plan Header with Price and Shares on same row */}
                <div className="flex items-start justify-between mb-3">
                  {/* Left side: Name and Price */}
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-1">
                      {plan.name}
                    </h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-gray-900">
                        ${plan.price}
                      </span>
                      <span className="text-sm text-gray-600">/month</span>
                    </div>
                  </div>

                  {/* Right side: Selection circle and shares */}
                  <div className="flex flex-col items-end">
                    {/* Selection Indicator */}
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all mb-2 ${
                        isSelected
                          ? 'bg-[#30302E] border-[#30302E]'
                          : 'border-gray-300'
                      }`}
                    >
                      {isSelected && (
                        <Check className="w-4 h-4 text-white" strokeWidth={3} />
                      )}
                    </div>

                    {/* Shares Badge aligned with price row */}
                    <div className="px-2 py-1 bg-[#F2F1ED] rounded-lg">
                      <span className="text-sm font-semibold text-gray-900">
                        {plan.shares} shares/mo
                      </span>
                    </div>
                  </div>
                </div>

                {/* Horizontal Features List */}
                <div className="flex items-center gap-3 justify-between">
                  {plan.features.map((feature) => (
                    <div key={feature.name} className="flex items-center gap-1">
                      {feature.included ? (
                        <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                      ) : (
                        <X className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      )}
                      <span
                        className={`text-xs ${
                          feature.included ? 'text-gray-900' : 'text-gray-500'
                        }`}
                      >
                        {feature.name}
                      </span>
                    </div>
                  ))}
                </div>
              </button>
            )
          })}
        </div>

        {/* Info Text */}
        <p className="text-xs text-center text-gray-500 mb-4">
          All plans include equity ownership and can be cancelled anytime.
          Payment will be processed after identity verification.
        </p>

        {/* Continue Button */}
        <button
          onClick={handleContinue}
          disabled={!selectedTier || loading}
          className={`w-full px-4 py-3 rounded-xl font-medium text-base transition-all duration-150 min-h-[48px] ${
            selectedTier && !loading
              ? 'bg-[#30302E] hover:bg-primary-700 text-white active:scale-[0.98]'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-5 w-5"
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
              <span>Saving...</span>
            </div>
          ) : (
            'Continue'
          )}
        </button>
      </div>
    </div>
  )
}
