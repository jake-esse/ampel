import { cn } from '@/lib/utils'
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

  // Check if message is new (created within last 1000ms)
  const isNew = Date.now() - message.timestamp.getTime() < 1000

  return (
    <div
      className={cn(
        'flex flex-col gap-1 mb-4',
        isUser ? 'ml-auto items-end max-w-[85%]' : 'mr-auto items-start',
        // Fade-in animation for new messages
        isNew && isUser && 'animate-in fade-in slide-in-from-right-4 duration-200',
        isNew && isAssistant && 'animate-in fade-in slide-in-from-left-4 duration-200'
      )}
    >
      {/* Message bubble */}
      <div
        className={cn(
          'px-4 py-3 rounded-2xl break-words',
          isUser
            ? 'bg-[#E8E6E1] text-gray-900'
            : 'text-gray-900 rounded-tl-sm'
        )}
      >
        {/* User messages: plain text */}
        {isUser && (
          <p className="text-lg leading-snug whitespace-pre-wrap">
            {message.content}
          </p>
        )}

        {/* Assistant messages: markdown with syntax highlighting */}
        {isAssistant && (
          <div className="font-serif">
            {message.content ? (
              <MarkdownMessage content={message.content} />
            ) : message.isStreaming ? (
              // Animated typing indicator with bouncing dots
              <div className="flex items-center gap-1 py-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            ) : (
              <p className="text-base leading-relaxed text-gray-500">
                No response
              </p>
            )}
            {/* Streaming cursor */}
            {message.isStreaming && message.content && (
              <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
