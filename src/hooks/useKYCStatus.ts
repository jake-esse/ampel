import { useState, useEffect, useRef } from 'react'
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
  const { user, loading: authLoading } = useAuth()
  const [kycStatus, setKycStatus] = useState<KYCStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const lastRealtimeUpdateRef = useRef<number>(Date.now()) // Use ref instead of state
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const userIdRef = useRef<string | null>(null) // Track user ID changes

  useEffect(() => {
    // CRITICAL FIX: Wait for auth to finish loading before bailing
    // During navigation, user can temporarily become null while auth re-initializes
    // We must stay in loading state until auth is done to prevent race conditions
    if (authLoading) {
      console.log('📊 useKYCStatus: Auth still loading, staying in loading state...')
      setLoading(true)
      return
    }

    if (!user) {
      console.log('📊 useKYCStatus: No user after auth loaded, exiting loading state')
      setLoading(false)
      return
    }

    // Only re-run if user ID actually changed (prevents loops on same user)
    if (userIdRef.current === user.id) {
      console.log('📊 useKYCStatus: Same user, skipping re-initialization')
      return
    }

    userIdRef.current = user.id
    console.log('📊 useKYCStatus: Loading KYC status for user:', user.id)

    // Load initial KYC status (with loading state)
    loadKYCStatus(true)

    // Subscribe to real-time updates on the profiles table
    // This will trigger when the webhook updates the user's KYC status
    console.log('📊 useKYCStatus: Setting up realtime subscription')
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
          console.log('📊 useKYCStatus: Received realtime update!', payload.new.kyc_status)
          lastRealtimeUpdateRef.current = Date.now() // Track when we last received an update (use ref)
          const newStatus = {
            status: payload.new.kyc_status,
            personaInquiryId: payload.new.persona_inquiry_id,
            personaAccountId: payload.new.persona_account_id,
            completedAt: payload.new.kyc_completed_at,
            declinedReason: payload.new.kyc_declined_reason
          }
          setKycStatus(newStatus)

          // STOP POLLING if realtime update shows terminal status
          if (payload.new.kyc_status === 'approved' || payload.new.kyc_status === 'declined') {
            console.log('📊 useKYCStatus: Realtime update shows terminal status, stopping polling')
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current)
              pollingIntervalRef.current = null
            }
          }
        }
      )
      .on('system', {}, (status) => {
        // Monitor subscription status changes
        console.log('📊 useKYCStatus: Realtime subscription status:', status)
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn('📊 useKYCStatus: Realtime subscription failed, polling will take over')
        } else if (status === 'SUBSCRIBED') {
          console.log('📊 useKYCStatus: Realtime subscription active ✓')
        }
      })
      .subscribe((status, err) => {
        // Handle initial subscription errors
        if (err) {
          console.error('📊 useKYCStatus: Subscription error:', err)
          console.log('📊 useKYCStatus: Falling back to polling')
        } else {
          console.log('📊 useKYCStatus: Initial subscription status:', status)
        }
      })

    // POLLING FALLBACK: In case realtime subscription fails
    // Start polling after a delay if no realtime updates received
    // This ensures the page always progresses even if realtime is broken
    // ONLY poll when status is 'pending' - stop when terminal (approved/declined)

    // Determine polling delay based on current location
    // On /kyc-pending page, start polling sooner for better UX
    const isOnPendingPage = window.location.pathname === '/kyc-pending'
    const pollingDelay = isOnPendingPage ? 2000 : 5000 // 2s on pending page, 5s elsewhere

    pollingTimeoutRef.current = setTimeout(() => {
      // Get the initial status to determine if we should poll
      const initialStatus = kycStatus?.status

      // Don't start polling if status is already terminal
      if (initialStatus === 'approved' || initialStatus === 'declined') {
        console.log('📊 useKYCStatus: Status is already terminal, skipping polling')
        return
      }

      console.log(`📊 useKYCStatus: Starting polling fallback (delay: ${pollingDelay}ms)`)

      pollingIntervalRef.current = setInterval(async () => {
        const now = Date.now()
        const timeSinceLastUpdate = now - lastRealtimeUpdateRef.current

        // If realtime has been working (updated recently), stop polling
        if (timeSinceLastUpdate < 5000) {
          console.log('📊 useKYCStatus: Realtime is working, stopping polling')
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }
          return
        }

        console.log('📊 useKYCStatus: Polling for status update...')
        await loadKYCStatus()
      }, 3000) // Poll every 3 seconds
    }, pollingDelay) // Dynamic delay based on page

    // Cleanup subscription and polling on unmount
    return () => {
      console.log('📊 useKYCStatus: Cleaning up subscription and polling')
      subscription.unsubscribe()

      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current)
        pollingTimeoutRef.current = null
      }

      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }

      // Reset user ID ref on cleanup to allow re-initialization if needed
      userIdRef.current = null
    }
  }, [user, authLoading]) // Removed lastRealtimeUpdate from dependencies - use ref instead

  /**
   * Load the user's current KYC status from the database
   * @param showLoading - If true, sets loading state (for initial load). If false, silently updates (for polling/refetch).
   */
  async function loadKYCStatus(showLoading = false) {
    if (!user) return

    console.log('📊 useKYCStatus: loadKYCStatus() called, showLoading:', showLoading)

    // Only set loading state on initial load, not during polling/refetch
    // This prevents re-renders that cause keyboard flickering
    if (showLoading) {
      setLoading(true)
    }

    const status = await getKYCStatus(user.id)
    console.log('📊 useKYCStatus: Loaded status from database:', status?.status)
    setKycStatus(status)

    // STOP POLLING if status is now terminal (approved/declined)
    if (status?.status === 'approved' || status?.status === 'declined') {
      console.log('📊 useKYCStatus: Status is now terminal, stopping polling')
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }

    if (showLoading) {
      setLoading(false)
    }
  }

  return {
    kycStatus,
    loading,
    refetch: loadKYCStatus
  }
}
