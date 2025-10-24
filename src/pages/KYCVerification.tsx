import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Client } from 'persona'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { markKYCPending } from '@/lib/database/kyc'

/**
 * KYC Verification Page
 *
 * This page handles Persona's identity verification using the Embedded Flow
 * for all platforms (web, iOS, Android).
 *
 * UNIFIED APPROACH:
 * 1. Initialize Persona Client with embedded iframe
 * 2. User completes verification in iframe
 * 3. onComplete callback → update database → redirect to pending
 *
 * This approach works reliably across all platforms because:
 * - JavaScript callbacks fire consistently (unlike deep links)
 * - Single codebase for web + mobile
 * - Native in-app experience
 * - Proper camera access with HTTPS
 *
 * Documentation:
 * - Embedded Flow: https://docs.withpersona.com/quickstart-embedded-flow
 * - Client Parameters: https://docs.withpersona.com/embedded-flow-parameters
 */
export default function KYCVerification() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const clientRef = useRef<Client | null>(null)

  // Initialize Persona embedded flow for ALL platforms
  useEffect(() => {
    if (!user) return

    const templateId = import.meta.env.VITE_PERSONA_TEMPLATE_ID
    const environmentId = import.meta.env.VITE_PERSONA_ENVIRONMENT_ID
    const environment = import.meta.env.VITE_PERSONA_ENVIRONMENT || 'sandbox'

    console.log('Initializing Persona:', { templateId, environmentId, environment, userId: user.id })

    if (!templateId) {
      console.error('Missing VITE_PERSONA_TEMPLATE_ID')
      setError('KYC verification is not configured. Please contact support.')
      setIsLoading(false)
      return
    }

    // 30 second timeout for initialization
    const timeoutId = setTimeout(() => {
      console.error('Persona client timed out - onReady never called')
      setError('Verification is taking too long to load. Please refresh the page or try again later.')
      setIsLoading(false)
    }, 30000)

    try {
      console.log('🌐 Creating embedded Persona Client...')

      const client = new Client({
        templateId,
        environmentId,  // Required for sandbox environment
        environment: environment as 'sandbox' | 'production',
        referenceId: user.id,

        // Mobile-optimized fullscreen sizing
        frameHeight: '100vh',
        frameWidth: '100%',

        onReady: () => {
          console.log('✅ Persona client ready - opening flow')
          clearTimeout(timeoutId)
          setIsLoading(false)
          client.open()
        },

        onComplete: async ({ inquiryId, status }) => {
          console.log('✅ Persona verification completed:', { inquiryId, status })

          try {
            await markKYCPending(user.id, inquiryId)
            showToast({
              type: 'info',
              message: 'Verification submitted successfully'
            })
            navigate('/kyc-pending', { replace: true })
          } catch (err) {
            console.error('❌ Failed to save verification status:', err)
            setError('Failed to save verification status. Please contact support.')
            showToast({
              type: 'error',
              message: 'Failed to save verification. Please try again.'
            })
          }
        },

        onCancel: ({ inquiryId }) => {
          console.log('⚠️ Persona verification canceled:', inquiryId)
          clearTimeout(timeoutId)
          setError('You must complete identity verification to use Ampel.')
          showToast({
            type: 'info',
            message: 'Verification canceled'
          })
        },

        onError: (error) => {
          console.error('❌ Persona verification error:', error)
          clearTimeout(timeoutId)
          setError(`Verification failed: ${error.code || 'Unknown error'}. Please try again or contact support.`)
          setIsLoading(false)
          showToast({
            type: 'error',
            message: 'Verification failed. Please try again.'
          })
        }
      })

      console.log('✅ Persona Client created successfully')
      clientRef.current = client

      return () => {
        clearTimeout(timeoutId)
        if (clientRef.current) {
          try {
            console.log('Destroying Persona client...')
            clientRef.current.destroy()
          } catch (err) {
            console.debug('Error destroying Persona client:', err)
          }
        }
      }
    } catch (err) {
      console.error('❌ Failed to initialize Persona client:', err)
      clearTimeout(timeoutId)
      setError('Failed to load verification. Please try again or contact support.')
      setIsLoading(false)
    }
  }, [user, navigate, showToast])

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-[#FDFCFA] flex flex-col items-center justify-center p-6">
      {/* Loading State */}
      {isLoading && (
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4">
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
          <p className="text-gray-600 text-base">Loading identity verification...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="max-w-md w-full">
          <div className="bg-white border border-[#E5E3DD] rounded-2xl shadow-sm p-8">
            <div className="text-center mb-6">
              {/* Error Icon */}
              <div className="w-16 h-16 bg-red-100 rounded-full mx-auto flex items-center justify-center mb-4">
                <svg
                  className="w-8 h-8 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>

              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Verification Error
              </h2>
              <p className="text-gray-600 text-base">{error}</p>
            </div>

            <button
              onClick={() => window.location.reload()}
              className="w-full min-h-[48px] px-6 py-3 bg-[#30302E] text-white rounded-xl font-medium hover:bg-[#404040] transition-all duration-150 active:scale-[0.98]"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Persona will inject the iframe here */}
      <div id="persona-container"></div>
    </div>
  )
}
