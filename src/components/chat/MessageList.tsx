import { useEffect, useRef, useMemo } from 'react'
import { Message } from './Message'
import { EmptyState } from './EmptyState'
import { useKeyboard } from '@/hooks/useKeyboard'
import type { Message as MessageType } from '@/types/chat'

interface MessageListProps {
  messages: MessageType[]
}

/**
 * Scrollable message list container
 * Smart scroll behavior:
 * - When user sends a message, scrolls that message to TOP of viewport
 * - Keeps user message at top while AI response streams below
 * - Does NOT auto-scroll during streaming
 * Shows welcoming empty state when no messages
 */
export function MessageList({ messages }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const lastUserMessageRef = useRef<HTMLDivElement>(null)
  const previousMessagesLengthRef = useRef(0)

  // Get keyboard control utility (with height for dynamic padding)
  const { hideKeyboard, isVisible: keyboardVisible, keyboardHeight } = useKeyboard()

  // Find the index of the last user message
  // This is memoized to avoid recalculating on every render
  const lastUserMessageIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        return i
      }
    }
    return -1
  }, [messages])

  // Scroll user message to top when new user message is added
  useEffect(() => {
    const previousLength = previousMessagesLengthRef.current
    const currentLength = messages.length

    console.log('🔵 [MessageList] Message change - previous:', previousLength, 'current:', currentLength)
    console.log('🔵 [MessageList] Keyboard visible:', keyboardVisible)

    // Detect if a new user message was just added
    if (currentLength > previousLength) {
      const lastMessage = messages[messages.length - 1]
      const secondToLastMessage = messages[messages.length - 2]

      const newUserMessage =
        (lastMessage?.role === 'user') ? lastMessage :
        (secondToLastMessage?.role === 'user') ? secondToLastMessage :
        null

      if (newUserMessage) {
        console.log('🟢 [MessageList] NEW USER MESSAGE DETECTED!')

        // Visual debugging - flash the document title
        const originalTitle = document.title
        document.title = '🟢 NEW MESSAGE DETECTED!'
        setTimeout(() => { document.title = originalTitle }, 1000)

        // If keyboard is visible, wait for it to close before scrolling
        // Otherwise scroll immediately
        const delayMs = keyboardVisible ? 400 : 100

        console.log('🟢 [MessageList] Will scroll in', delayMs, 'ms')

        setTimeout(() => {
          if (!containerRef.current || !lastUserMessageRef.current) {
            console.log('🔴 [MessageList] Refs not available')
            return
          }

          const container = containerRef.current
          const element = lastUserMessageRef.current

          console.log('🟢 [MessageList] Element offsetHeight:', element.offsetHeight)
          console.log('🟢 [MessageList] Element offsetTop:', element.offsetTop)

          // Only scroll if element has valid dimensions
          if (element.offsetHeight === 0) {
            console.log('🔴 [MessageList] Element not ready, skipping scroll')
            return
          }

          // Calculate scroll position to place user message at top of viewport
          // Account for container's padding-top (0.5rem / 8px)
          const containerPaddingTop = 8 // 0.5rem = 8px
          const scrollTop = element.offsetTop - containerPaddingTop

          console.log('🟢 [MessageList] SCROLLING TO POSITION:', scrollTop)

          // Scroll the container to position user message at top
          container.scrollTo({
            top: scrollTop,
            behavior: 'smooth'
          })

          console.log('✅ [MessageList] Scroll command executed')
        }, delayMs)
      }
    }

    previousMessagesLengthRef.current = currentLength
  }, [messages, keyboardVisible])

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
      className="flex-1 overflow-y-auto px-2 pt-2"
      style={{
        // Dynamic bottom padding to compensate for keyboard and fixed input
        // When keyboard closed: 140px for fixed input
        // When keyboard open: 140px + keyboardHeight to compensate for viewport shrink
        paddingBottom: keyboardVisible ? `${140 + keyboardHeight}px` : '140px',
        // Smooth transition when paddingBottom changes (keyboard open/close)
        transition: 'padding-bottom 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)',
        // GPU acceleration for smoother animation
        willChange: 'padding-bottom',
      }}
    >
      {/* Messages or empty state */}
      {messages.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {messages.map((message, index) => {
            // Attach ref to the last user message for scroll-to-top behavior
            const isLastUserMessage = index === lastUserMessageIndex

            return (
              <div
                key={message.id}
                ref={isLastUserMessage ? lastUserMessageRef : null}
                style={{
                  // Explicit positioning for correct offsetTop calculation
                  position: 'relative'
                }}
              >
                <Message message={message} />
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
