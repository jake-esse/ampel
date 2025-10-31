import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Sprout } from 'lucide-react'
import { impact } from '@/hooks/useHaptics'
import { submitWaitlistEmail } from '@/lib/database/waitlist'

/**
 * Apps page showing available apps and developer waitlist
 */
export default function Apps() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const handleSubmitWaitlist = async (e: React.FormEvent) => {
    e.preventDefault()
    setFeedbackMessage(null)

    // Validate email
    if (!email.trim()) {
      setFeedbackMessage({
        type: 'error',
        text: 'Please enter an email address',
      })
      return
    }

    if (!validateEmail(email)) {
      setFeedbackMessage({
        type: 'error',
        text: 'Please enter a valid email address',
      })
      return
    }

    setIsSubmitting(true)

    try {
      const result = await submitWaitlistEmail(email)

      if (result.success) {
        setFeedbackMessage({
          type: 'success',
          text: result.message,
        })
        setEmail('') // Clear input on success
        impact('light')
      } else {
        setFeedbackMessage({
          type: 'error',
          text: result.message,
        })
      }
    } catch (err) {
      console.error('Error submitting waitlist:', err)
      setFeedbackMessage({
        type: 'error',
        text: 'An unexpected error occurred. Please try again.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <header
        className="border-b-[0.5px] border-[#E5E3DD] p-4 flex-shrink-0"
        style={{
          // iOS safe area support for top (notch/Dynamic Island)
          paddingTop: 'max(1rem, env(safe-area-inset-top))',
        }}
      >
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          {/* Left: Back button */}
          <button
            onClick={() => {
              impact('light')
              navigate(-1)
            }}
            className="p-2.5 hover:bg-gray-100 rounded-lg transition-all duration-150 active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Back"
          >
            <ChevronLeft className="w-6 h-6 text-gray-900" />
          </button>

          {/* Center: Title */}
          <h1 className="text-lg font-semibold text-gray-900">Apps</h1>

          {/* Right: Empty space for symmetry */}
          <div className="min-w-[44px]" />
        </div>
      </header>

      {/* Main content */}
      <main
        className="flex-1 overflow-y-auto p-6"
        style={{
          // iOS safe area support for bottom (home indicator)
          paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
        }}
      >
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Ampel App Card */}
          <button
            onClick={() => {
              impact('light')
              navigate('/apps/ampel')
            }}
            className="w-full bg-white border border-[#E5E3DD] rounded-xl p-6 transition-all duration-150 hover:bg-gray-50 active:scale-95 shadow-sm"
          >
            <div className="flex items-center gap-4">
              {/* App Icon */}
              <div className="w-16 h-16 bg-[#30302E] rounded-xl flex items-center justify-center flex-shrink-0">
                <Sprout className="w-9 h-9 text-white" />
              </div>

              {/* App Info */}
              <div className="flex-1 text-left">
                <h2 className="text-lg font-bold text-gray-900">Ampel</h2>
                <p className="text-sm text-gray-600">Your AI Company</p>
              </div>

              {/* Chevron indicator */}
              <ChevronLeft className="w-5 h-5 text-gray-400 rotate-180" />
            </div>
          </button>

          {/* Coming Soon Card */}
          <div className="bg-white border border-[#E5E3DD] rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Coming Soon</h2>
            <p className="text-sm text-gray-600 mb-1">Third party apps.</p>
            <p className="text-sm text-gray-500 mb-4">
              Join the developer waitlist
            </p>

            {/* Waitlist Form */}
            <form onSubmit={handleSubmitWaitlist} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-[#F2F1ED] border border-[#E5E3DD] rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              />

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-[#30302E] hover:bg-primary-700 text-white font-medium rounded-lg transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 min-h-[44px]"
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </button>

              {/* Feedback Message */}
              {feedbackMessage && (
                <p
                  className={`text-sm ${
                    feedbackMessage.type === 'success'
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}
                >
                  {feedbackMessage.text}
                </p>
              )}
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
