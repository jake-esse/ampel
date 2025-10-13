import { useState, KeyboardEvent, useRef, useEffect } from 'react'
import { SendHorizontal, Brain, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChatInputProps {
  onSend: (content: string) => void
  disabled?: boolean
  reasoning?: boolean
  webSearch?: boolean
  onReasoningToggle?: () => void
  onWebSearchToggle?: () => void
  autoFocus?: boolean
  placeholder?: string
}

/**
 * Chat input component with integrated controls
 * Includes reasoning and web search toggles below input
 */
export function ChatInput({
  onSend,
  disabled = false,
  reasoning = false,
  webSearch = false,
  onReasoningToggle,
  onWebSearchToggle,
  autoFocus = false,
  placeholder = 'Type a message...',
}: ChatInputProps) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-focus if requested
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [autoFocus])

  const handleSend = () => {
    const trimmed = input.trim()
    if (trimmed && !disabled) {
      onSend(trimmed)
      setInput('')
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div
      className="border-t border-gray-800 bg-gray-900 px-4 py-3"
      style={{
        // iOS safe area support for bottom (home indicator)
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="max-w-4xl mx-auto">
        {/* Input row */}
        <div className="flex items-end gap-2 mb-2">
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={placeholder}
            rows={1}
            className={cn(
              'flex-1 bg-gray-800 text-white rounded-2xl px-4 py-3',
              'resize-none overflow-hidden',
              'placeholder:text-gray-500',
              'focus:outline-none focus:ring-2 focus:ring-primary-500',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'min-h-[48px] max-h-[120px]'
            )}
            style={{
              // Auto-expand based on content
              height: 'auto',
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement
              target.style.height = 'auto'
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`
            }}
          />

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={disabled || !input.trim()}
            className={cn(
              'flex-shrink-0 w-12 h-12 rounded-full',
              'flex items-center justify-center',
              'bg-primary-600 text-white',
              'transition-all duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'active:scale-95',
              !disabled && input.trim() && 'hover:bg-primary-700'
            )}
            aria-label="Send message"
          >
            <SendHorizontal className="w-5 h-5" />
          </button>
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-2 px-2">
          {/* Reasoning toggle */}
          {onReasoningToggle && (
            <button
              onClick={onReasoningToggle}
              disabled={disabled}
              className={cn(
                'p-2 rounded-lg transition-all',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                reasoning
                  ? 'bg-primary-600/20 text-primary-400'
                  : 'text-gray-500 hover:bg-gray-800'
              )}
              aria-label="Toggle reasoning mode"
              title="Reasoning"
            >
              <Brain className="w-5 h-5" />
            </button>
          )}

          {/* Web search toggle */}
          {onWebSearchToggle && (
            <button
              onClick={onWebSearchToggle}
              disabled={disabled}
              className={cn(
                'p-2 rounded-lg transition-all',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                webSearch
                  ? 'bg-primary-600/20 text-primary-400'
                  : 'text-gray-500 hover:bg-gray-800'
              )}
              aria-label="Toggle web search"
              title="Web Search"
            >
              <Globe className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
