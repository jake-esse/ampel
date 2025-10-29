import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

/**
 * Equity Introduction Page
 *
 * This page educates users about the equity ownership model in Ampel.
 * It shows the four ways to earn shares:
 * 1. Signup: 100 shares
 * 2. Monthly subscription: 5-40 shares/month (based on tier)
 * 3. Refer a friend: 50 shares per referral
 * 4. Get referred: 25 shares bonus
 *
 * If the user has already selected a subscription tier, they are
 * redirected to the appropriate next step.
 */
export default function EquityIntro() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [isVisible, setIsVisible] = useState(false)

  // Check if user has already selected a subscription tier
  useEffect(() => {
    async function checkProgress() {
      if (!user) return

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('selected_subscription_tier, disclosures_accepted_at, kyc_status')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error checking onboarding progress:', error)
        return
      }

      // If user has already selected a tier, redirect to next step
      if (profile?.selected_subscription_tier) {
        if (!profile.disclosures_accepted_at) {
          navigate('/disclosures', { replace: true })
        } else if (profile.kyc_status === 'not_started') {
          navigate('/kyc', { replace: true })
        } else {
          navigate('/chat', { replace: true })
        }
      }
    }

    checkProgress()
  }, [user, navigate])

  // Trigger animation entrance
  useEffect(() => {
    // Delay to allow page to render before animating
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, 50)

    return () => clearTimeout(timer)
  }, [])

  const handleContinue = () => {
    navigate('/onboarding/plans')
  }

  // Equity earning cards data
  const equityCards = [
    {
      emoji: '🎉',
      title: 'Sign Up',
      shares: 100,
      description: 'Welcome bonus for joining Ampel'
    },
    {
      emoji: '📅',
      title: 'Monthly Subscription',
      shares: '5-40',
      description: 'Earn shares every month based on your plan'
    },
    {
      emoji: '👥',
      title: 'Refer a Friend',
      shares: 50,
      description: 'Get shares for each person you invite'
    },
    {
      emoji: '🎁',
      title: 'Get Referred',
      shares: 25,
      description: 'Bonus shares for using a referral code'
    }
  ]

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
        <div className="text-center mb-6">
          <h1 className="text-3xl font-serif font-semibold text-gray-900 mb-2">
            Become an Owner 🚀
          </h1>
          <p className="text-base text-gray-600">
            Every action earns you shares in Ampel
          </p>
        </div>

        {/* Equity Cards */}
        <div className="space-y-3 mb-6">
          {equityCards.map((card, index) => (
            <div
              key={card.title}
              className="bg-white border border-[#E5E3DD] rounded-xl p-4 shadow-sm transition-all duration-300"
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
                transitionDelay: `${index * 150}ms`
              }}
            >
              <div className="flex items-center gap-3">
                {/* Content - no emoji */}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {card.title}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {card.description}
                  </p>
                </div>

                {/* Right-aligned bigger share numbers */}
                <div className="flex-shrink-0 text-right">
                  <div className="text-3xl font-bold text-gray-900 leading-tight">
                    {card.shares}
                  </div>
                  <div className="text-xs text-gray-600 -mt-1">
                    shares
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Info Box */}
        <div
          className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-6 transition-all duration-300"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
            transitionDelay: '600ms'
          }}
        >
          <p className="text-xs text-blue-900">
            <strong>Note:</strong> Shares represent your ownership stake in Ampel.
            As we grow, so does the value of your shares. All share grants are subject
            to our Terms of Service and the offering disclosures.
          </p>
        </div>

        {/* Continue Button */}
        <button
          onClick={handleContinue}
          className="w-full px-4 py-3 bg-[#30302E] hover:bg-primary-700 text-white rounded-xl font-medium text-base transition-all duration-150 active:scale-[0.98] min-h-[48px]"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
            transitionDelay: '700ms'
          }}
        >
          Continue
        </button>
      </div>
    </div>
  )
}
