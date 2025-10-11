import { cn, formatMessageTime } from '@/lib/utils'
import type { Message as MessageType } from '@/types/chat'

interface MessageProps {
  message: MessageType
}

/**
 * Individual message bubble component
 * Displays differently based on role (user vs assistant)
 * Shows streaming indicator for messages being generated
 */
export function Message({ message }: MessageProps) {
  const isUser = message.role === 'user'

  return (
    <div
      className={cn(
        'flex flex-col gap-1 max-w-[80%] mb-4',
        isUser ? 'ml-auto items-end' : 'mr-auto items-start'
      )}
    >
      {/* Message bubble */}
      <div
        className={cn(
          'px-4 py-3 rounded-2xl break-words',
          isUser
            ? 'bg-primary-600 text-white rounded-tr-sm'
            : 'bg-gray-100 text-gray-900 rounded-tl-sm'
        )}
      >
        <p className="text-base leading-relaxed whitespace-pre-wrap">
          {message.content || (message.isStreaming ? 'Thinking...' : '')}
          {/* Streaming cursor */}
          {message.isStreaming && message.content && (
            <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
          )}
        </p>
      </div>

      {/* Timestamp */}
      {!message.isStreaming && (
        <span className="text-xs text-gray-500 px-1">
          {formatMessageTime(message.timestamp)}
        </span>
      )}
    </div>
  )
}
