import { useState, useRef, useEffect } from 'react'
import type { Conversation } from '@/types/database'
import { cn } from '@/lib/utils'
import { selection } from '@/hooks/useHaptics'

interface ConversationItemProps {
  conversation: Conversation
  isActive?: boolean
  onClick: () => void
  onLongPress: () => void
}

/**
 * Individual conversation item in the list
 * Supports tap to open and long-press to show delete menu
 */
export function ConversationItem({
  conversation,
  isActive = false,
  onClick,
  onLongPress,
}: ConversationItemProps) {
  const [isPressed, setIsPressed] = useState(false)
  const timeoutRef = useRef<number | null>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
    setIsPressed(true)

    // Start long-press timer (500ms)
    timeoutRef.current = window.setTimeout(() => {
      // Trigger selection haptic when long-press activates (iOS only)
      selection()

      onLongPress()
      setIsPressed(false)
      touchStartRef.current = null
    }, 500)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    // Cancel long-press if finger moves too much
    if (touchStartRef.current && timeoutRef.current) {
      const touch = e.touches[0]
      const deltaX = Math.abs(touch.clientX - touchStartRef.current.x)
      const deltaY = Math.abs(touch.clientY - touchStartRef.current.y)

      // If moved more than 10px, cancel
      if (deltaX > 10 || deltaY > 10) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
        setIsPressed(false)
      }
    }
  }

  const handleTouchEnd = () => {
    setIsPressed(false)
    touchStartRef.current = null

    // If timeout still exists, it was a short tap
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
      onClick()
    }
  }

  const handleTouchCancel = () => {
    setIsPressed(false)
    touchStartRef.current = null
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  // Fallback for non-touch devices (desktop)
  const handleClick = () => {
    onClick()
  }

  // Get display title (truncate if needed)
  const displayTitle = conversation.title || 'New Chat'
  const truncatedTitle =
    displayTitle.length > 40 ? displayTitle.slice(0, 40) + '...' : displayTitle

  return (
    <button
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onClick={handleClick}
      className={cn(
        'w-full px-4 py-3.5 text-left transition-colors min-h-[48px]',
        'flex items-center',
        'hover:bg-gray-700/50 active:bg-gray-700',
        isActive && 'bg-gray-700/70',
        isPressed && 'bg-gray-700'
      )}
    >
      <span className="text-white text-base font-medium line-clamp-1">
        {truncatedTitle}
      </span>
    </button>
  )
}
