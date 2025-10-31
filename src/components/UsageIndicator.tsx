import { useUsageLimits } from '@/hooks/useUsageLimits'
import { formatResetDate, getTierDisplayName } from '@/lib/subscription-limits'
import { MessageSquare, Globe, Brain } from 'lucide-react'

/**
 * Usage indicator component - displays current usage metrics and limits
 * Shows progress for messages, web searches, and reasoning queries
 */
export function UsageIndicator() {
  const { usageStatus, featureAccess, loading, subscriptionActive } = useUsageLimits()

  if (loading) {
    return (
      <div className="bg-white border border-[#E5E3DD] rounded-xl p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!subscriptionActive) {
    return (
      <div className="bg-white border border-[#E5E3DD] rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Usage & Limits</h3>
        <p className="text-sm text-gray-600">
          Your subscription is inactive. Please resubscribe to continue using Ampel.
        </p>
      </div>
    )
  }

  if (!usageStatus) {
    return null
  }

  const { metrics, limits, period_ends, effective_tier } = usageStatus

  // Calculate percentages for progress bars
  const messagePercent = limits.messages > 0 ? (metrics.messages_used / limits.messages) * 100 : 0
  const webSearchPercent = limits.web_searches > 0 ? (metrics.web_searches_used / limits.web_searches) * 100 : 0
  const reasoningPercent = limits.reasoning > 0 ? (metrics.reasoning_queries_used / limits.reasoning) * 100 : 0

  // Determine color based on usage percentage
  const getProgressColor = (percent: number) => {
    if (percent >= 90) return 'bg-red-500'
    if (percent >= 75) return 'bg-yellow-500'
    return 'bg-primary-600'
  }

  return (
    <div className="bg-white border border-[#E5E3DD] rounded-xl p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Usage & Limits</h3>
        <span className="text-sm font-medium text-gray-600">
          {getTierDisplayName(effective_tier)} Plan
        </span>
      </div>

      {/* Usage metrics */}
      <div className="space-y-4">
        {/* Messages */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Messages</span>
            </div>
            <span className="text-sm text-gray-600">
              {metrics.messages_used} / {limits.messages}
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(messagePercent)}`}
              style={{ width: `${Math.min(messagePercent, 100)}%` }}
            />
          </div>
        </div>

        {/* Web Search - only show if feature is available */}
        {featureAccess.has_web_search && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Web Searches</span>
              </div>
              <span className="text-sm text-gray-600">
                {metrics.web_searches_used} / {limits.web_searches}
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(webSearchPercent)}`}
                style={{ width: `${Math.min(webSearchPercent, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Reasoning - only show if feature is available */}
        {featureAccess.has_reasoning && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Reasoning Queries</span>
              </div>
              <span className="text-sm text-gray-600">
                {metrics.reasoning_queries_used} / {limits.reasoning}
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(reasoningPercent)}`}
                style={{ width: `${Math.min(reasoningPercent, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Billing period info */}
      <div className="mt-4 pt-4 border-t border-[#E5E3DD]">
        <p className="text-xs text-gray-500">
          Resets {formatResetDate(period_ends)}
        </p>
      </div>
    </div>
  )
}
