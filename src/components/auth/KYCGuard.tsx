import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useKYCStatus } from '@/hooks/useKYCStatus'

interface KYCGuardProps {
  children: React.ReactNode
}

/**
 * KYC Route Guard
 *
 * This component ensures that users have completed KYC verification before
 * accessing protected routes. It wraps routes that require KYC approval.
 *
 * How it works:
 * 1. Checks the user's KYC status
 * 2. Redirects based on status:
 *    - not_started → /kyc (start verification)
 *    - pending → /kyc-pending (show waiting screen)
 *    - declined → /kyc-declined (show error with retry)
 *    - needs_review → /kyc-declined (show manual review message)
 *    - approved → render children (allow access)
 *
 * Usage in App.tsx:
 * ```tsx
 * <Route
 *   path="/chat"
 *   element={
 *     <ProtectedRoute>
 *       <KYCGuard>
 *         <Chat />
 *       </KYCGuard>
 *     </ProtectedRoute>
 *   }
 * />
 * ```
 *
 * This creates a nested guard system:
 * 1. ProtectedRoute checks authentication + disclosures
 * 2. KYCGuard checks KYC verification status
 * 3. Only approved users can access nested routes
 */
export function KYCGuard({ children }: KYCGuardProps) {
  const { kycStatus, loading } = useKYCStatus()
  const navigate = useNavigate()

  // Route based on KYC status
  useEffect(() => {
    // Wait for status to load
    if (loading) {
      return
    }

    // If no status data, something went wrong - redirect to KYC
    if (!kycStatus) {
      navigate('/kyc', { replace: true })
      return
    }

    // Route based on current status
    switch (kycStatus.status) {
      case 'not_started':
        // User hasn't started KYC - redirect to verification page
        navigate('/kyc', { replace: true })
        break

      case 'pending':
        // User completed flow, waiting for approval - show pending screen
        navigate('/kyc-pending', { replace: true })
        break

      case 'declined':
      case 'needs_review':
        // Verification was declined or needs manual review
        navigate('/kyc-declined', { replace: true })
        break

      case 'approved':
        // User is approved - allow access to protected routes
        // No redirect needed, render children
        break

      default:
        // Unknown status - redirect to start
        navigate('/kyc', { replace: true })
    }
  }, [kycStatus, loading, navigate])

  // Show loading spinner while checking status
  if (loading) {
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

  // Only render children (protected routes) if user is approved
  if (kycStatus?.status === 'approved') {
    return <>{children}</>
  }

  // If not approved, the useEffect will handle redirection
  // Return null while redirecting
  return null
}
