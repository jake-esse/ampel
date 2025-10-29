import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Client } from 'persona'
import { useAuth } from '@/hooks/useAuth'
import { markKYCPending } from '@/lib/database/kyc'
import { supabase } from '@/lib/supabase'

// MODULE-LEVEL SINGLETON: Prevents multiple Persona instances across ALL component lifecycles
// This persists even when component unmounts/remounts (React Strict Mode, navigation, etc.)
let globalPersonaInstance: Client | null = null
let isPersonaInitializing = false
let hasPersonaInitialized = false

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
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize Persona embedded flow for ALL platforms
  useEffect(() => {
    if (!user) return

    // CRITICAL FIX: Use module-level singleton to prevent multiple initializations
    // This persists across component mount/unmount cycles (React Strict Mode, navigation, etc.)
    if (hasPersonaInitialized || isPersonaInitializing) {
      console.log('⚠️ Persona already initialized or initializing (module-level check), skipping...')
      return
    }

    // Check if there's already a Persona instance in DOM
    if (globalPersonaInstance) {
      console.log('⚠️ Global Persona instance already exists, skipping initialization')
      return
    }

    isPersonaInitializing = true
    console.log('🎬 Starting Persona initialization (GLOBAL singleton - only once per page load)')

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

    // DEFENSIVE CHECK: Prevent re-initialization if user already completed KYC
    // This handles cases where user somehow lands on /kyc after approval
    async function checkExistingStatus() {
      if (!user) return true // Allow initialization if user is null

      try {
        const { data: profile, error: checkError } = await supabase
          .from('profiles')
          .select('kyc_status, onboarding_completed_at')
          .eq('id', user.id)
          .single()

        if (checkError) {
          console.error('Error checking KYC status:', checkError)
          // Continue with Persona init - better to show flow than block user
          return true
        }

        const status = profile?.kyc_status

        console.log('Current KYC status:', status)

        if (status === 'approved') {
          // Approved users who haven't completed onboarding should go to checkout, not chat
          const destination = profile?.onboarding_completed_at ? '/chat' : '/checkout'
          console.log(`✅ User already approved, redirecting to ${destination}`)
          navigate(destination, { replace: true })
          return false // Don't initialize Persona
        } else if (status === 'pending') {
          console.log('⏳ User status is pending, redirecting to /kyc-pending')
          navigate('/kyc-pending', { replace: true })
          return false // Don't initialize Persona
        }

        // Status is 'not_started', 'declined', or 'needs_review' - proceed with Persona
        return true
      } catch (err) {
        console.error('Error in checkExistingStatus:', err)
        // Continue with Persona init on error
        return true
      }
    }

    // Validate user session before initializing Persona
    // This prevents stale sessions from causing database update failures
    async function validateSession(): Promise<boolean> {
      if (!user) return false // Don't initialize if user is null

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .single()

        if (error || !profile) {
          console.error('❌ User profile not found - stale session detected')
          console.error('Session validation error:', error)
          setError('Your session is invalid. Please log out and log in again.')
          setIsLoading(false)

          // Force logout after a brief delay to show error message
          setTimeout(async () => {
            await supabase.auth.signOut()
          }, 2000)

          return false
        }

        console.log('✅ Session validated, profile exists')
        return true
      } catch (err) {
        console.error('Error validating session:', err)
        setError('Failed to validate session. Please try again.')
        setIsLoading(false)
        return false
      }
    }

    // Check existing status, then validate session, then initialize Persona
    checkExistingStatus().then((shouldInitialize) => {
      if (!shouldInitialize) return

      validateSession().then((isValid) => {
        if (!isValid) return
        initializePersona()
      })
    })

    function initializePersona() {
      if (!user) {
        setError('User session expired. Please refresh the page.')
        setIsLoading(false)
        isPersonaInitializing = false
        return
      }

      // Mark that we've attempted initialization (module-level)
      hasPersonaInitialized = true

      // 30 second timeout for initialization
      timeoutRef.current = setTimeout(() => {
        console.error('Persona client timed out - onReady never called')
        setError('Verification is taking too long to load. Please refresh the page or try again later.')
        setIsLoading(false)
        isPersonaInitializing = false
        hasPersonaInitialized = false // Allow retry on timeout
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
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current)
              timeoutRef.current = null
            }
            setIsLoading(false)
            isPersonaInitializing = false
            client.open()
          },

          onComplete: async ({ inquiryId, status }) => {
            console.log('✅ Persona verification completed:', { inquiryId, status })

            if (!user) {
              console.error('User is null in onComplete callback')
              setError('Session expired. Please refresh the page.')
              return
            }

            try {
              // Update database first
              console.log('📝 Calling markKYCPending...')
              await markKYCPending(user.id, inquiryId)
              console.log('✅ markKYCPending completed successfully')

              // Destroy the Persona client to clean up
              if (globalPersonaInstance) {
                try {
                  globalPersonaInstance.destroy()
                  globalPersonaInstance = null
                  console.log('🧹 Persona client destroyed')
                } catch (err) {
                  console.debug('Error destroying client:', err)
                }
              }

              console.log('🚀 Navigating to /kyc-pending with React Router...')

              // Use React Router navigate instead of window.location
              // This works better with routing guards and doesn't force a full page reload
              navigate('/kyc-pending', { replace: true })

              console.log('✅ Navigation triggered')
            } catch (err) {
              console.error('❌ Failed to save verification status:', err)
              const errorMessage = err instanceof Error ? err.message : 'Unknown error'
              setError(`Failed to save verification: ${errorMessage}`)
            }
          },

          onCancel: ({ inquiryId }) => {
            console.log('⚠️ Persona verification canceled:', inquiryId)
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current)
              timeoutRef.current = null
            }
            setError('You must complete identity verification to use Ampel.')
          },

          onError: (error) => {
            console.error('❌ Persona verification error:', error)
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current)
              timeoutRef.current = null
            }
            setError(`Verification failed: ${error.code || 'Unknown error'}. Please try again or contact support.`)
            setIsLoading(false)
          }
        })

        console.log('✅ Persona Client created successfully')
        globalPersonaInstance = client
        isPersonaInitializing = false
      } catch (err) {
        console.error('❌ Failed to initialize Persona client:', err)
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
        setError('Failed to load verification. Please try again or contact support.')
        setIsLoading(false)
        isPersonaInitializing = false
        hasPersonaInitialized = false // Allow retry on error
      }
    }

    // Cleanup function - runs when component unmounts
    return () => {
      console.log('🧹 Cleanup: Component unmounting (but NOT destroying Persona - it persists)')

      // Clear any pending timeouts
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }

      // DON'T destroy Persona here - it should persist until onComplete
      // DON'T reset module-level flags - they should persist across remounts
      // This prevents React Strict Mode from creating multiple instances
    }
  }, [user, navigate])

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
