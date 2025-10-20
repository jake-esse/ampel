import { useState, useRef } from 'react'
import { RefreshCw, MessageSquare } from 'lucide-react'
import { ConversationItem } from './ConversationItem'
import { ConversationSkeleton } from './ConversationSkeleton'
import { useConversations } from '@/hooks/useConversations'
import { impact } from '@/hooks/useHaptics'
import type { Conversation } from '@/types/database'

interface ConversationListProps {
  currentConversationId: string | null
  onSelectConversation: (id: string) => void
  onLongPressConversation: (conversation: Conversation) => void
}

/**
 * List of user's conversations
 * Uses shared conversation context for real-time updates
 */
export function ConversationList({
  currentConversationId,
  onSelectConversation,
  onLongPressConversation,
}: ConversationListProps) {
  const { conversations, isLoading, error, refreshList } = useConversations()

  // Pull-to-refresh state
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const touchStartY = useRef<number>(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const PULL_THRESHOLD = 80 // Distance to trigger refresh

  const handleTouchStart = (e: React.TouchEvent) => {
    // Only track if at top of scroll container
    if (scrollContainerRef.current?.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isRefreshing || touchStartY.current === 0) return

    const currentY = e.touches[0].clientY
    const distance = currentY - touchStartY.current

    // Only pull down, and only if at top
    if (distance > 0 && scrollContainerRef.current?.scrollTop === 0) {
      // Apply rubber band effect (diminishing returns)
      const rubberBandDistance = Math.min(distance * 0.5, PULL_THRESHOLD * 1.2)
      setPullDistance(rubberBandDistance)
    }
  }

  const handleTouchEnd = async () => {
    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      // Trigger refresh
      setIsRefreshing(true)

      // Haptic feedback on iOS
      impact('light')

      try {
        await refreshList()
      } catch (err) {
        console.error('Failed to refresh conversations:', err)
      } finally {
        setIsRefreshing(false)
      }
    }

    // Reset pull state
    setPullDistance(0)
    touchStartY.current = 0
  }

  return (
    <div className="flex flex-col h-full">
      {/* Conversations list */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto relative"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull-to-refresh indicator */}
        {(pullDistance > 0 || isRefreshing) && (
          <div
            className="absolute top-0 left-0 right-0 flex items-center justify-center py-4 transition-opacity"
            style={{
              transform: `translateY(${isRefreshing ? 0 : pullDistance - 60}px)`,
              opacity: isRefreshing ? 1 : Math.min(pullDistance / PULL_THRESHOLD, 1),
            }}
          >
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
              />
              <span>
                {isRefreshing
                  ? 'Refreshing...'
                  : pullDistance >= PULL_THRESHOLD
                  ? 'Release to refresh'
                  : 'Pull to refresh'}
              </span>
            </div>
          </div>
        )}
        {/* Add spacing for pull indicator */}
        {(pullDistance > 0 || isRefreshing) && (
          <div
            style={{
              height: isRefreshing ? 60 : Math.min(pullDistance, 60),
            }}
          />
        )}

        {isLoading ? (
          <div className="py-4">
            {/* Show 4 skeleton placeholders while loading */}
            <ConversationSkeleton />
            <ConversationSkeleton />
            <ConversationSkeleton />
            <ConversationSkeleton />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-8 px-4">
            <p className="text-sm text-red-400 text-center">{error}</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            {/* Icon */}
            <div className="mb-4">
              <MessageSquare className="w-12 h-12 text-gray-600" strokeWidth={1.5} />
            </div>

            {/* Message */}
            <p className="text-base text-gray-400 text-center mb-2">
              No conversations yet
            </p>
            <p className="text-sm text-gray-500 text-center">
              Tap the + button at the top to start your first chat
            </p>
          </div>
        ) : (
          <>
            {/* Section label */}
            <div className="px-6 pt-4 pb-2">
              <h3 className="text-sm font-semibold text-gray-600">
                Recents
              </h3>
            </div>

            {/* List */}
            <div className="pb-4 px-6">
              {conversations.map((conversation) => (
                <ConversationItem
                  key={conversation.id}
                  conversation={conversation}
                  isActive={conversation.id === currentConversationId}
                  onClick={() => onSelectConversation(conversation.id)}
                  onLongPress={() => onLongPressConversation(conversation)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
