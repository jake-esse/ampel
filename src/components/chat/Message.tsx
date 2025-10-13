import { cn, formatMessageTime } from '@/lib/utils'
import type { Message as MessageType } from '@/types/chat'
import { MarkdownMessage } from './MarkdownMessage'

interface MessageProps {
  message: MessageType
}

/**
 * Individual message bubble component
 * Displays differently based on role (user vs assistant)
 * Shows streaming indicator for messages being generated
 * Assistant messages are rendered with markdown support
 */
export function Message({ message }: MessageProps) {
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'

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
        {/* User messages: plain text */}
        {isUser && (
          <p className="text-base leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        )}

        {/* Assistant messages: markdown with syntax highlighting */}
        {isAssistant && (
          <>
            {message.content ? (
              <MarkdownMessage content={message.content} />
            ) : message.isStreaming ? (
              <p className="text-base leading-relaxed">Thinking...</p>
            ) : (
              <p className="text-base leading-relaxed text-gray-500">
                No response
              </p>
            )}
            {/* Streaming cursor */}
            {message.isStreaming && message.content && (
              <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
            )}
          </>
        )}
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
