/**
 * Subscription tier limits and feature access configuration
 *
 * Tier pricing:
 * - Starter: $2/month
 * - Plus: $5/month
 * - Pro: $10/month
 * - Max: $20/month
 */

import type { SubscriptionTier, UsageLimits, FeatureAccess, ActionType } from '@/types/usage'

/**
 * Usage limits for each subscription tier
 */
export const TIER_LIMITS: Record<SubscriptionTier, UsageLimits> = {
  starter: {
    messages: 40,
    web_searches: 0,
    reasoning: 0,
  },
  plus: {
    messages: 100,
    web_searches: 20,
    reasoning: 0,
  },
  pro: {
    messages: 200,
    web_searches: 50,
    reasoning: 40,
  },
  max: {
    messages: 400,
    web_searches: 120,
    reasoning: 100,
  },
}

/**
 * Get usage limits for a specific tier
 */
export function getLimitsForTier(tier: SubscriptionTier | null): UsageLimits {
  if (!tier) {
    // No subscription - return zero limits
    return {
      messages: 0,
      web_searches: 0,
      reasoning: 0,
    }
  }

  return TIER_LIMITS[tier]
}

/**
 * Get the limit for a specific action type and tier
 */
export function getLimitForAction(tier: SubscriptionTier | null, action: ActionType): number {
  const limits = getLimitsForTier(tier)

  switch (action) {
    case 'message':
      return limits.messages
    case 'web_search':
      return limits.web_searches
    case 'reasoning':
      return limits.reasoning
    default:
      return 0
  }
}

/**
 * Check what features are available for a tier
 */
export function getFeatureAccess(tier: SubscriptionTier | null): FeatureAccess {
  if (!tier) {
    return {
      has_web_search: false,
      has_reasoning: false,
      tier: null,
    }
  }

  return {
    has_web_search: tier === 'plus' || tier === 'pro' || tier === 'max',
    has_reasoning: tier === 'pro' || tier === 'max',
    tier,
  }
}

/**
 * Get the minimum tier required for a feature
 */
export function getMinimumTierForFeature(feature: 'web_search' | 'reasoning'): SubscriptionTier {
  switch (feature) {
    case 'web_search':
      return 'plus'
    case 'reasoning':
      return 'pro'
  }
}

/**
 * Get the tier display name
 */
export function getTierDisplayName(tier: SubscriptionTier | null): string {
  if (!tier) return 'No subscription'

  switch (tier) {
    case 'starter':
      return 'Starter'
    case 'plus':
      return 'Plus'
    case 'pro':
      return 'Pro'
    case 'max':
      return 'Max'
  }
}

/**
 * Get the monthly price for a tier
 */
export function getTierPrice(tier: SubscriptionTier): number {
  switch (tier) {
    case 'starter':
      return 2
    case 'plus':
      return 5
    case 'pro':
      return 10
    case 'max':
      return 20
  }
}

/**
 * Get suggested upgrade tier when a limit is hit
 */
export function getSuggestedUpgradeTier(
  currentTier: SubscriptionTier | null,
  action: ActionType
): SubscriptionTier | null {
  // If no tier, suggest starter
  if (!currentTier) {
    return 'starter'
  }

  // Suggest next tier up based on action
  switch (action) {
    case 'message':
      // Suggest next tier for more messages
      if (currentTier === 'starter') return 'plus'
      if (currentTier === 'plus') return 'pro'
      if (currentTier === 'pro') return 'max'
      return null // Already on max

    case 'web_search':
      // Need at least plus for web search
      if (currentTier === 'starter') return 'plus'
      if (currentTier === 'plus') return 'pro'
      if (currentTier === 'pro') return 'max'
      return null // Already on max

    case 'reasoning':
      // Need at least pro for reasoning
      if (currentTier === 'starter' || currentTier === 'plus') return 'pro'
      if (currentTier === 'pro') return 'max'
      return null // Already on max
  }
}

/**
 * Generate user-friendly error message when limit is reached
 */
export function getLimitReachedMessage(
  tier: SubscriptionTier | null,
  action: ActionType,
  _currentUsage: number,
  limit: number
): string {
  const suggestedTier = getSuggestedUpgradeTier(tier, action)

  let baseMessage = ''
  let upgradeMessage = ''

  // Build base message
  switch (action) {
    case 'message':
      baseMessage = `You've used all ${limit} messages this month.`
      break
    case 'web_search':
      if (limit === 0) {
        baseMessage = 'Web Search is not available on your current plan.'
      } else {
        baseMessage = `You've used all ${limit} web searches this month.`
      }
      break
    case 'reasoning':
      if (limit === 0) {
        baseMessage = 'Reasoning mode is not available on your current plan.'
      } else {
        baseMessage = `You've used all ${limit} reasoning queries this month.`
      }
      break
  }

  // Build upgrade message
  if (suggestedTier) {
    const suggestedLimit = getLimitForAction(suggestedTier, action)
    const suggestedTierName = getTierDisplayName(suggestedTier)
    const suggestedPrice = getTierPrice(suggestedTier)

    upgradeMessage = ` Upgrade to ${suggestedTierName} ($${suggestedPrice}/month) for ${suggestedLimit} ${action === 'message' ? 'messages' : action === 'web_search' ? 'searches' : 'reasoning queries'}/month.`
  }

  return baseMessage + upgradeMessage
}

/**
 * Format date for "resets on" message
 */
export function formatResetDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()

  // Calculate days until reset
  const daysUntil = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (daysUntil === 0) {
    return 'today'
  } else if (daysUntil === 1) {
    return 'tomorrow'
  } else if (daysUntil < 7) {
    return `in ${daysUntil} days`
  } else {
    // Format as "Jan 15, 2025"
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
}
