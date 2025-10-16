import { useEffect, useRef, useState } from 'react'
import { Message } from './Message'
import { EmptyState } from './EmptyState'
import { useKeyboard } from '@/hooks/useKeyboard'
import type { Message as MessageType } from '@/types/chat'

interface MessageListProps {
  messages: MessageType[]
  keyboardVisible?: boolean
  keyboardHeight?: number
}

/**
 * Scrollable message list container
 * Smart auto-scroll: scrolls to bottom only when appropriate
 * - Scrolls on new message if user is at bottom
 * - Scrolls when keyboard appears if user is at bottom
 * - Does NOT scroll if user is reading older messages
 * Shows welcoming empty state when no messages
 */
export function MessageList({
  messages,
  keyboardVisible = false,
  keyboardHeight = 0
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [wasAtBottom, setWasAtBottom] = useState(true)
  const prevKeyboardVisible = useRef(keyboardVisible)

  // Get keyboard control utility
  const { hideKeyboard } = useKeyboard()

  // Check if user is at bottom of message list
  const isAtBottom = (): boolean => {
    if (!containerRef.current) return true

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    const threshold = 100 // pixels from bottom to consider "at bottom"

    return scrollHeight - scrollTop - clientHeight < threshold
  }

  // Track scroll position to know if user is at bottom
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      setWasAtBottom(isAtBottom())
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  // Smart auto-scroll on message changes
  // Only scroll if user is at bottom (not reading old messages)
  useEffect(() => {
    if (wasAtBottom && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, wasAtBottom])

  // Auto-scroll when keyboard appears (if user was at bottom)
  useEffect(() => {
    // Detect keyboard appearance (transition from hidden to visible)
    const keyboardJustAppeared = !prevKeyboardVisible.current && keyboardVisible

    if (keyboardJustAppeared && wasAtBottom && bottomRef.current) {
      // Small delay to let keyboard animation start, then scroll
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 50)
    }

    prevKeyboardVisible.current = keyboardVisible
  }, [keyboardVisible, wasAtBottom])

  // Handle tap on message area to dismiss keyboard
  const handleTapToDismiss = () => {
    // Only dismiss if keyboard is actually visible
    if (keyboardVisible) {
      hideKeyboard()
    }
  }

  return (
    <div
      ref={containerRef}
      onClick={handleTapToDismiss}
      className="flex-1 overflow-y-auto px-2 py-4"
      style={{
        // iOS safe area support for top (notch/dynamic island)
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        // Add bottom padding when keyboard is open to keep messages visible
        paddingBottom: keyboardHeight > 0 ? `${keyboardHeight}px` : '1rem',
        // Smooth transition matching iOS native keyboard timing
        transition: 'padding-bottom 0.25s ease-out',
      }}
    >
      {/* Messages or empty state */}
      {messages.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {messages.map((message) => (
            <Message key={message.id} message={message} />
          ))}
          {/* Invisible element to scroll to */}
          <div ref={bottomRef} />
        </>
      )}
    </div>
  )
}
