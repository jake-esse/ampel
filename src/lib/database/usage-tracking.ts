import { supabase } from '@/lib/supabase'
import type {
  UsageTracking,
  UsageStatus,
  UsageLimitCheck,
  ActionType,
  SubscriptionTier,
} from '@/types/usage'
import { getLimitsForTier, getLimitForAction } from '@/lib/subscription-limits'

/**
 * Database helper functions for usage tracking and limit enforcement
 */

/**
 * Get the current usage status for a user
 * @param userId - The user ID
 * @returns Usage status with metrics, limits, and billing period info
 */
export async function getUsageStatus(userId: string): Promise<UsageStatus | null> {
  const { data, error } = await supabase
    .from('usage_tracking')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    // If no row exists, return null (will be initialized on first use)
    if (error.code === 'PGRST116') {
      return null
    }
    console.error('Error fetching usage status:', error)
    throw new Error(`Failed to fetch usage status: ${error.message}`)
  }

  if (!data) {
    return null
  }

  const limits = getLimitsForTier(data.effective_tier as SubscriptionTier | null)

  return {
    metrics: {
      messages_used: data.messages_used,
      web_searches_used: data.web_searches_used,
      reasoning_queries_used: data.reasoning_queries_used,
    },
    limits,
    period_ends: data.billing_period_end,
    effective_tier: data.effective_tier as SubscriptionTier | null,
  }
}

/**
 * Get the raw usage tracking record for a user
 * @param userId - The user ID
 * @returns Usage tracking record or null if not found
 */
export async function getUsageTracking(userId: string): Promise<UsageTracking | null> {
  const { data, error } = await supabase
    .from('usage_tracking')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    console.error('Error fetching usage tracking:', error)
    throw new Error(`Failed to fetch usage tracking: ${error.message}`)
  }

  return data
}

/**
 * Initialize usage tracking for a new user
 * @param userId - The user ID
 * @param tier - The user's subscription tier
 * @returns The created usage tracking record
 */
export async function initializeUsageTracking(
  userId: string,
  tier: SubscriptionTier | null
): Promise<UsageTracking> {
  const now = new Date()
  const billingPeriodEnd = new Date(now)
  billingPeriodEnd.setDate(billingPeriodEnd.getDate() + 30)

  const { data, error } = await supabase
    .from('usage_tracking')
    .insert({
      user_id: userId,
      billing_period_start: now.toISOString(),
      billing_period_end: billingPeriodEnd.toISOString(),
      effective_tier: tier,
      messages_used: 0,
      web_searches_used: 0,
      reasoning_queries_used: 0,
      last_reset_at: now.toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('Error initializing usage tracking:', error)
    throw new Error(`Failed to initialize usage tracking: ${error.message}`)
  }

  if (!data) {
    throw new Error('No data returned from usage tracking initialization')
  }

  return data
}

/**
 * Check if a specific action is allowed based on current usage and limits
 * @param userId - The user ID
 * @param tier - The user's current subscription tier
 * @param action - The action type to check
 * @returns Check result with allowed status and usage info
 */
export async function checkUsageLimit(
  userId: string,
  tier: SubscriptionTier | null,
  action: ActionType
): Promise<UsageLimitCheck> {
  // Get or initialize usage tracking
  let usageTracking = await getUsageTracking(userId)

  if (!usageTracking) {
    // Initialize for new user
    usageTracking = await initializeUsageTracking(userId, tier)
  }

  // Check if billing period has expired
  const now = new Date()
  const periodEnd = new Date(usageTracking.billing_period_end)

  if (now > periodEnd) {
    // Period expired - reset usage
    await resetUsageCounters(userId, tier)
    // Re-fetch after reset
    usageTracking = await getUsageTracking(userId)
    if (!usageTracking) {
      throw new Error('Failed to reset usage counters')
    }
  }

  // Get current usage for this action
  let currentUsage: number
  switch (action) {
    case 'message':
      currentUsage = usageTracking.messages_used
      break
    case 'web_search':
      currentUsage = usageTracking.web_searches_used
      break
    case 'reasoning':
      currentUsage = usageTracking.reasoning_queries_used
      break
  }

  // Get limit for this action
  const limit = getLimitForAction(tier, action)

  // Check if allowed
  const allowed = currentUsage < limit

  return {
    allowed,
    current_usage: currentUsage,
    limit,
    reason: allowed ? undefined : `Limit of ${limit} ${action}s reached for this billing period`,
  }
}

/**
 * Increment usage counter for a specific action
 * @param userId - The user ID
 * @param action - The action type that was performed
 * @returns The new usage count
 */
export async function incrementUsage(userId: string, action: ActionType): Promise<number> {
  // Determine which field to increment
  let field: string
  switch (action) {
    case 'message':
      field = 'messages_used'
      break
    case 'web_search':
      field = 'web_searches_used'
      break
    case 'reasoning':
      field = 'reasoning_queries_used'
      break
  }

  // Use Supabase RPC to atomically increment
  const { data, error } = await supabase.rpc('increment_usage_counter', {
    p_user_id: userId,
    p_field: field,
  })

  if (error) {
    // If function doesn't exist, fall back to manual increment
    // First get current value
    const usageTracking = await getUsageTracking(userId)
    if (!usageTracking) {
      throw new Error('Usage tracking not initialized')
    }

    const currentValue = usageTracking[field as keyof UsageTracking] as number
    const newValue = currentValue + 1

    // Update the field
    const { error: updateError } = await supabase
      .from('usage_tracking')
      .update({ [field]: newValue })
      .eq('user_id', userId)

    if (updateError) {
      console.error('Error incrementing usage:', updateError)
      throw new Error(`Failed to increment usage: ${updateError.message}`)
    }

    return newValue
  }

  return data as number
}

/**
 * Reset usage counters for a user (called on billing period renewal)
 * @param userId - The user ID
 * @param newTier - Optional new tier to apply (defaults to current tier)
 */
export async function resetUsageCounters(
  userId: string,
  newTier?: SubscriptionTier | null
): Promise<void> {
  const { error } = await supabase.rpc('reset_user_usage', {
    p_user_id: userId,
    p_new_tier: newTier ?? null,
  })

  if (error) {
    console.error('Error resetting usage counters:', error)
    throw new Error(`Failed to reset usage counters: ${error.message}`)
  }
}

/**
 * Update the effective tier for a user
 * Used when subscription changes - tier takes effect on next billing period
 * @param userId - The user ID
 * @param newTier - The new subscription tier
 */
export async function updateEffectiveTier(
  userId: string,
  newTier: SubscriptionTier | null
): Promise<void> {
  const { error } = await supabase
    .from('usage_tracking')
    .update({ effective_tier: newTier })
    .eq('user_id', userId)

  if (error) {
    console.error('Error updating effective tier:', error)
    throw new Error(`Failed to update effective tier: ${error.message}`)
  }
}

/**
 * Check if a user's billing period has expired and needs reset
 * @param userId - The user ID
 * @returns True if period has expired
 */
export async function isPeriodExpired(userId: string): Promise<boolean> {
  const usageTracking = await getUsageTracking(userId)
  if (!usageTracking) {
    return false
  }

  const now = new Date()
  const periodEnd = new Date(usageTracking.billing_period_end)

  return now > periodEnd
}
