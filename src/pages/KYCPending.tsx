import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useKYCStatus } from '@/hooks/useKYCStatus'

/**
 * KYC Pending Page
 *
 * This page is shown after the user completes the Persona verification flow
 * and is waiting for Persona to review and approve/decline their verification.
 *
 * Real-time updates:
 * - useKYCStatus subscribes to database changes
 * - When webhook updates status to 'approved' → auto-redirect to /chat
 * - When webhook updates status to 'declined' → auto-redirect to /kyc-declined
 *
 * Typically this screen is shown for just a few seconds to a few minutes,
 * depending on Persona's processing time.
 */
export default function KYCPending() {
  const navigate = useNavigate()
  const { kycStatus } = useKYCStatus()

  console.log('⏳ KYCPending: Rendered with status:', kycStatus?.status)

  // Listen for status changes and redirect accordingly
  useEffect(() => {
    console.log('⏳ KYCPending: useEffect triggered, status:', kycStatus?.status)

    if (!kycStatus) {
      console.log('⏳ KYCPending: No status yet, waiting...')
      return
    }

    // When approved, redirect to chat
    if (kycStatus.status === 'approved') {
      console.log('⏳ KYCPending: Status is approved, redirecting to /chat')
      navigate('/chat', { replace: true })
    }
    // When declined or needs review, redirect to declined page
    else if (kycStatus.status === 'declined' || kycStatus.status === 'needs_review') {
      console.log('⏳ KYCPending: Status is declined/needs_review, redirecting to /kyc-declined')
      navigate('/kyc-declined', { replace: true })
    } else {
      console.log('⏳ KYCPending: Status is', kycStatus.status, '- staying on pending page')
    }
  }, [kycStatus, navigate])

  return (
    <div className="min-h-screen bg-[#FDFCFA] flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="bg-white border border-[#E5E3DD] rounded-2xl shadow-sm p-8">
          {/* Animated Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              {/* Outer pulsing ring */}
              <div className="absolute inset-0 bg-[#30302E] opacity-20 rounded-full animate-ping"></div>
              {/* Inner circle */}
              <div className="relative w-20 h-20 bg-[#30302E] rounded-full flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-gray-900 mb-3">
              Verification in Progress
            </h1>

            <p className="text-gray-600 text-base mb-6">
              We're reviewing your identity verification. This typically takes 5-30 seconds.
            </p>

            {/* Info Box */}
            <div className="bg-[#F2F1ED] border border-[#E5E3DD] rounded-xl p-4 space-y-2">
              <p className="text-sm text-gray-700">
                ⚡ You'll be automatically redirected once verification is complete.
              </p>
              <p className="text-sm text-gray-600">
                Most verifications complete within seconds. If it takes longer than a minute, try refreshing the page.
              </p>
            </div>
          </div>

          {/* Loading dots animation */}
          <div className="flex justify-center gap-2 mt-6">
            <div className="w-2 h-2 bg-[#30302E] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-[#30302E] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-[#30302E] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    </div>
  )
}
