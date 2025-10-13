import { useEffect, useRef } from 'react'
import { Message } from './Message'
import { EmptyState } from './EmptyState'
import type { Message as MessageType } from '@/types/chat'

interface MessageListProps {
  messages: MessageType[]
}

/**
 * Scrollable message list container
 * Auto-scrolls to bottom when new messages are added
 * Shows welcoming empty state when no messages
 */
export function MessageList({ messages }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-4 py-4"
      style={{
        // iOS safe area support for top (notch/dynamic island)
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
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
