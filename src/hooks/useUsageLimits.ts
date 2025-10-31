import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './useAuth'
import { getProfile } from '@/lib/auth/profile'
import {
  getUsageStatus,
  checkUsageLimit,
  incrementUsage as incrementUsageDb,
  initializeUsageTracking,
} from '@/lib/database/usage-tracking'
import {
  getLimitReachedMessage,
  getFeatureAccess,
} from '@/lib/subscription-limits'
import type {
  UsageStatus,
  UsageLimitCheck,
  ActionType,
  SubscriptionTier,
  FeatureAccess,
} from '@/types/usage'

interface UseUsageLimitsReturn {
  usageStatus: UsageStatus | null
  featureAccess: FeatureAccess
  loading: boolean
  subscriptionActive: boolean
  checkLimit: (action: ActionType) => Promise<UsageLimitCheck>
  incrementUsage: (action: ActionType) => Promise<void>
  getLimitMessage: (action: ActionType, check: UsageLimitCheck) => string
  refreshUsage: () => Promise<void>
}

/**
 * Hook for managing usage limits and subscription features
 *
 * Handles:
 * - Loading user's current usage metrics
 * - Checking if actions are allowed based on tier limits
 * - Incrementing usage counters after actions
 * - Checking subscription status
 * - Auto-initialization for new users
 */
export function useUsageLimits(): UseUsageLimitsReturn {
  const { user } = useAuth()
  const [usageStatus, setUsageStatus] = useState<UsageStatus | null>(null)
  const [tier, setTier] = useState<SubscriptionTier | null>(null)
  const [subscriptionActive, setSubscriptionActive] = useState(true)
  const [loading, setLoading] = useState(true)

  /**
   * Load user's profile, subscription tier, and usage status
   */
  const loadUsageData = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      // Fetch user profile to get subscription tier and status
      const profile = await getProfile(user.id)

      if (!profile) {
        console.error('No profile found for user')
        setLoading(false)
        return
      }

      // Check if subscription is active
      const isActive = profile.subscription_status === 'active'
      setSubscriptionActive(isActive)

      // Get subscription tier
      const userTier = profile.selected_subscription_tier
      setTier(userTier)

      // If subscription is not active, don't load usage (block all features)
      if (!isActive) {
        setUsageStatus(null)
        setLoading(false)
        return
      }

      // Try to get existing usage status
      let status = await getUsageStatus(user.id)

      // If no usage tracking exists, initialize it
      if (!status && userTier) {
        await initializeUsageTracking(user.id, userTier)
        status = await getUsageStatus(user.id)
      }

      setUsageStatus(status)
    } catch (error) {
      console.error('Error loading usage data:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  /**
   * Load usage data on mount and when user changes
   */
  useEffect(() => {
    loadUsageData()
  }, [loadUsageData])

  /**
   * Check if a specific action is allowed
   * @param action - The action type to check ('message', 'web_search', 'reasoning')
   * @returns Check result with allowed status and usage info
   */
  const checkLimit = useCallback(
    async (action: ActionType): Promise<UsageLimitCheck> => {
      if (!user) {
        return {
          allowed: false,
          current_usage: 0,
          limit: 0,
          reason: 'Not authenticated',
        }
      }

      if (!subscriptionActive) {
        return {
          allowed: false,
          current_usage: 0,
          limit: 0,
          reason: 'Subscription expired or inactive. Please resubscribe to continue.',
        }
      }

      try {
        const result = await checkUsageLimit(user.id, tier, action)
        return result
      } catch (error) {
        console.error('Error checking usage limit:', error)
        return {
          allowed: false,
          current_usage: 0,
          limit: 0,
          reason: 'Error checking usage limit',
        }
      }
    },
    [user, tier, subscriptionActive]
  )

  /**
   * Increment usage counter after performing an action
   * @param action - The action type that was performed
   */
  const incrementUsage = useCallback(
    async (action: ActionType): Promise<void> => {
      if (!user) {
        console.warn('Cannot increment usage: user not authenticated')
        return
      }

      try {
        await incrementUsageDb(user.id, action)

        // Refresh usage status to reflect new counts
        await loadUsageData()
      } catch (error) {
        console.error('Error incrementing usage:', error)
        // Don't throw - this is a background operation
      }
    },
    [user, loadUsageData]
  )

  /**
   * Get a user-friendly error message for a limit check
   * @param action - The action type that was checked
   * @param check - The limit check result
   * @returns User-friendly error message
   */
  const getLimitMessage = useCallback(
    (action: ActionType, check: UsageLimitCheck): string => {
      if (check.allowed) {
        return ''
      }

      if (!subscriptionActive) {
        return 'Your subscription has expired. Please resubscribe to continue using Ampel.'
      }

      return getLimitReachedMessage(tier, action, check.current_usage, check.limit)
    },
    [tier, subscriptionActive]
  )

  /**
   * Manually refresh usage data
   * Useful after subscription changes or for periodic refresh
   */
  const refreshUsage = useCallback(async () => {
    await loadUsageData()
  }, [loadUsageData])

  /**
   * Get feature access based on current tier
   */
  const featureAccess = getFeatureAccess(tier)

  return {
    usageStatus,
    featureAccess,
    loading,
    subscriptionActive,
    checkLimit,
    incrementUsage,
    getLimitMessage,
    refreshUsage,
  }
}
