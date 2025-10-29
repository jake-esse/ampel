import { useNavigate } from 'react-router-dom'
import { useKYCStatusSimple } from '@/hooks/useKYCStatusSimple'

/**
 * KYC Declined Page
 *
 * This page is shown when:
 * 1. Persona declines the user's verification (status = 'declined')
 * 2. Persona marks inquiry for manual review (status = 'needs_review')
 *
 * The user can:
 * - Try again (restart KYC flow)
 * - Contact support for help
 *
 * Common reasons for decline:
 * - Unclear or blurry ID photo
 * - Expired government ID
 * - Information mismatch between ID and account
 * - Document not accepted (wrong country/type)
 */
export default function KYCDeclined() {
  const { kycStatus } = useKYCStatusSimple()
  const navigate = useNavigate()

  // Determine the message based on status
  const isNeedsReview = kycStatus?.status === 'needs_review'
  const title = isNeedsReview
    ? 'Verification Under Review'
    : 'Verification Not Approved'

  const description = isNeedsReview
    ? 'Your verification requires additional review. Our team will review your submission and contact you within 24-48 hours.'
    : kycStatus?.declinedReason ||
      'We were unable to verify your identity at this time. Please review the common issues below and try again.'

  return (
    <div className="min-h-screen bg-[#FDFCFA] flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="bg-white border border-[#E5E3DD] rounded-2xl shadow-sm p-8">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center ${
                isNeedsReview ? 'bg-yellow-100' : 'bg-red-100'
              }`}
            >
              <svg
                className={`w-10 h-10 ${isNeedsReview ? 'text-yellow-600' : 'text-red-600'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {isNeedsReview ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                )}
              </svg>
            </div>
          </div>

          {/* Content */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-semibold text-gray-900 mb-3">{title}</h1>
            <p className="text-gray-600 text-base">{description}</p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 mb-6">
            {!isNeedsReview && (
              <button
                onClick={() => navigate('/kyc')}
                className="w-full min-h-[48px] px-6 py-3 bg-[#30302E] text-white rounded-xl font-medium hover:bg-[#404040] transition-all duration-150 active:scale-[0.98]"
              >
                Try Again
              </button>
            )}

            <button
              onClick={() => (window.location.href = 'mailto:support@ampel.ai')}
              className={`w-full min-h-[48px] px-6 py-3 rounded-xl font-medium transition-all duration-150 active:scale-[0.98] border border-[#E5E3DD] ${
                isNeedsReview
                  ? 'bg-[#30302E] text-white hover:bg-[#404040]'
                  : 'bg-white text-gray-900 hover:bg-gray-50'
              }`}
            >
              Contact Support
            </button>
          </div>

          {/* Common Issues (only show for declined, not needs_review) */}
          {!isNeedsReview && (
            <div className="bg-[#F2F1ED] border border-[#E5E3DD] rounded-xl p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-2">
                Common Issues:
              </h3>
              <ul className="text-xs text-gray-700 space-y-1">
                <li>• Unclear or blurry ID photo</li>
                <li>• Expired government ID document</li>
                <li>• Information doesn't match your account</li>
                <li>• Document type not accepted</li>
              </ul>
            </div>
          )}

          {/* Additional Help Text */}
          <p className="text-xs text-gray-500 text-center mt-4">
            {isNeedsReview
              ? 'You will receive an email notification once the review is complete.'
              : 'Make sure you have a valid government-issued ID and good lighting when retrying.'}
          </p>
        </div>
      </div>
    </div>
  )
}
