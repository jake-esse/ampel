import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { getKYCStatus, type KYCStatus } from '@/lib/database/kyc'

/**
 * Hook for managing KYC status with real-time updates
 *
 * This hook:
 * 1. Loads the user's current KYC status on mount
 * 2. Subscribes to real-time updates from Supabase (for webhook changes)
 * 3. Returns loading state, current status, and a refetch function
 *
 * Real-time updates are critical for the KYC flow:
 * - User completes Persona flow → status changes from 'not_started' to 'pending'
 * - Webhook receives approval → status changes from 'pending' to 'approved'
 * - User is automatically redirected based on the new status
 *
 * Usage:
 * ```typescript
 * const { kycStatus, loading, refetch } = useKYCStatus()
 *
 * if (kycStatus?.status === 'approved') {
 *   // User can access the app
 * }
 * ```
 */
export function useKYCStatus() {
  const { user } = useAuth()
  const [kycStatus, setKycStatus] = useState<KYCStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    // Load initial KYC status
    loadKYCStatus()

    // Subscribe to real-time updates on the profiles table
    // This will trigger when the webhook updates the user's KYC status
    const subscription = supabase
      .channel(`kyc-updates-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          const newStatus = {
            status: payload.new.kyc_status,
            personaInquiryId: payload.new.persona_inquiry_id,
            personaAccountId: payload.new.persona_account_id,
            completedAt: payload.new.kyc_completed_at,
            declinedReason: payload.new.kyc_declined_reason
          }
          setKycStatus(newStatus)
        }
      )
      .subscribe()

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe()
    }
  }, [user])

  /**
   * Load the user's current KYC status from the database
   */
  async function loadKYCStatus() {
    if (!user) return

    setLoading(true)
    const status = await getKYCStatus(user.id)
    setKycStatus(status)
    setLoading(false)
  }

  return {
    kycStatus,
    loading,
    refetch: loadKYCStatus
  }
}
