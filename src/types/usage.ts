/**
 * Usage tracking types for subscription-based limits
 */

export type SubscriptionTier = 'starter' | 'plus' | 'pro' | 'max'

export type ActionType = 'message' | 'web_search' | 'reasoning'

/**
 * Database table: usage_tracking
 * Tracks user's usage metrics for the current billing period
 */
export type UsageTracking = {
  id: string
  user_id: string
  billing_period_start: string
  billing_period_end: string
  messages_used: number
  web_searches_used: number
  reasoning_queries_used: number
  effective_tier: SubscriptionTier | null // Tier active during this period
  last_reset_at: string | null
  created_at: string
  updated_at: string
}

/**
 * Current usage metrics for a user
 */
export type UsageMetrics = {
  messages_used: number
  web_searches_used: number
  reasoning_queries_used: number
}

/**
 * Usage limits for a subscription tier
 */
export type UsageLimits = {
  messages: number
  web_searches: number
  reasoning: number
}

/**
 * Combined usage status with limits
 */
export type UsageStatus = {
  metrics: UsageMetrics
  limits: UsageLimits
  period_ends: string
  effective_tier: SubscriptionTier | null
}

/**
 * Result of checking if an action is allowed
 */
export type UsageLimitCheck = {
  allowed: boolean
  current_usage: number
  limit: number
  reason?: string
}

/**
 * Feature availability for a tier
 */
export type FeatureAccess = {
  has_web_search: boolean
  has_reasoning: boolean
  tier: SubscriptionTier | null
}
