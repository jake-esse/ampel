import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import type { KYCStatus } from '@/lib/database/kyc'

/**
 * Simplified KYC Status Hook
 *
 * This hook implements a SIMPLE and RELIABLE polling mechanism for KYC status.
 *
 * Design principles:
 * 1. SIMPLE: Just poll the database every 2 seconds
 * 2. IDEMPOTENT: Always fetch fresh data, no caching
 * 3. RELIABLE: No complex realtime subscriptions that can fail
 * 4. PREDICTABLE: Always works the same way
 *
 * When on the /kyc-pending page:
 * - Polls every 2 seconds until status changes from 'pending'
 * - Stops polling when status becomes 'approved' or 'declined'
 * - No complex state management or race conditions
 */
export function useKYCStatusSimple() {
  const { user } = useAuth()
  const [kycStatus, setKycStatus] = useState<KYCStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      setKycStatus(null)
      return
    }

    let intervalId: NodeJS.Timeout | null = null
    let mounted = true

    // Simple function to fetch KYC status
    const fetchStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('kyc_status, persona_inquiry_id, persona_account_id, kyc_completed_at, kyc_declined_reason')
          .eq('id', user.id)
          .single()

        if (error) {
          console.error('Error fetching KYC status:', error)
          return
        }

        if (!mounted) return

        const status: KYCStatus = {
          status: data.kyc_status,
          personaInquiryId: data.persona_inquiry_id,
          personaAccountId: data.persona_account_id,
          completedAt: data.kyc_completed_at,
          declinedReason: data.kyc_declined_reason
        }

        console.log('📊 Simple KYC Status:', status.status)
        setKycStatus(status)
        setLoading(false)

        // Stop polling if we've reached a terminal state
        if (status.status === 'approved' || status.status === 'declined' || status.status === 'needs_review') {
          console.log('📊 Terminal status reached, stopping polling')
          if (intervalId) {
            clearInterval(intervalId)
            intervalId = null
          }
        }
      } catch (error) {
        console.error('Error in fetchStatus:', error)
        if (mounted) {
          setLoading(false)
        }
      }
    }

    // Initial fetch
    fetchStatus()

    // Always poll if we're on the pending page
    // This ensures we catch status updates even with race conditions
    const isOnPendingPage = window.location.pathname === '/kyc-pending'

    if (isOnPendingPage) {
      console.log('📊 Starting simple polling (every 2 seconds)')
      // Start polling immediately and continue every 2 seconds
      intervalId = setInterval(fetchStatus, 2000)
    }

    // Cleanup
    return () => {
      mounted = false
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [user?.id]) // Only re-run if user ID changes

  return {
    kycStatus,
    loading,
    refetch: async () => {
      if (!user) return

      const { data, error } = await supabase
        .from('profiles')
        .select('kyc_status, persona_inquiry_id, persona_account_id, kyc_completed_at, kyc_declined_reason')
        .eq('id', user.id)
        .single()

      if (!error && data) {
        const status: KYCStatus = {
          status: data.kyc_status,
          personaInquiryId: data.persona_inquiry_id,
          personaAccountId: data.persona_account_id,
          completedAt: data.kyc_completed_at,
          declinedReason: data.kyc_declined_reason
        }
        setKycStatus(status)
      }
    }
  }
}