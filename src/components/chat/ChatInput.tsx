import { useState, KeyboardEvent, useRef, useEffect } from 'react'
import { ArrowUp, Brain, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import { impact } from '@/hooks/useHaptics'
import { useKeyboardAnimation } from '@/hooks/useKeyboardAnimation'

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

  // Use keyboard animation hook - returns ref callback for direct DOM manipulation
  const containerRef = useKeyboardAnimation()

  // Auto-focus if requested - with delay for mobile keyboard
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      // Small delay ensures mobile keyboard opens properly
      const timer = setTimeout(() => {
        textareaRef.current?.focus()
      }, 100)

      return () => clearTimeout(timer)
    }
  }, [autoFocus])

  const handleSend = () => {
    const trimmed = input.trim()
    if (trimmed && !disabled) {
      // Trigger haptic feedback for send action (iOS only)
      impact('medium')

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
      ref={containerRef}
      className="px-3 pb-2 pt-2"
      style={{
        // CRITICAL: position fixed with top positioning
        // The hook directly updates style.top based on visualViewport.height
        position: 'fixed',
        left: 0,
        width: '100%',
        // Transform shifts element up by its own height (keeps it at bottom edge)
        // Combined with top: ${vv.height}px, this creates bottom-aligned fixed positioning
        transform: 'translateY(-100%)',
        // iOS safe area support for bottom (home indicator)
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
        // Smooth CSS transition on 'top' property (NOT transform)
        // Slightly longer duration (0.3s) for smoother feel
        // cubic-bezier(0.25, 0.1, 0.25, 1) is iOS ease-in-out curve
        transition: 'top 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)',
        // GPU acceleration for smoother animation
        willChange: 'top',
        // Ensure input appears above other content
        zIndex: 1000,
      }}
    >
      <div className="max-w-4xl mx-auto">
        {/* Input container with solid background */}
        <div className="bg-white rounded-3xl shadow-lg overflow-hidden">
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={placeholder}
            rows={1}
            // Mobile keyboard configuration
            enterKeyHint="send"
            autoCorrect="on"
            spellCheck={true}
            autoCapitalize="sentences"
            className={cn(
              'w-full bg-transparent text-gray-900 px-4 pt-4 pb-2',
              'text-lg',
              'resize-none overflow-hidden',
              'placeholder:text-gray-400',
              'border-0 focus:outline-none focus:ring-0',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'min-h-[56px] max-h-[160px]'
            )}
            style={{
              // Auto-expand based on content
              height: 'auto',
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement
              target.style.height = 'auto'
              target.style.height = `${Math.min(target.scrollHeight, 160)}px`
            }}
          />

          {/* Controls row - buttons at bottom */}
          <div className="flex items-center justify-between px-3 pb-3 pt-1">
            <div className="flex items-center gap-2">
              {/* Reasoning toggle */}
              {onReasoningToggle && (
                <button
                  onClick={() => {
                    impact('light')
                    onReasoningToggle()
                    // Refocus textarea to prevent keyboard from closing
                    textareaRef.current?.focus()
                  }}
                  disabled={disabled}
                  className={cn(
                    'w-9 h-9 rounded-full transition-all duration-150 active:scale-95 flex items-center justify-center',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    reasoning
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-500 hover:bg-gray-100'
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
                  onClick={() => {
                    impact('light')
                    onWebSearchToggle()
                    // Refocus textarea to prevent keyboard from closing
                    textareaRef.current?.focus()
                  }}
                  disabled={disabled}
                  className={cn(
                    'w-9 h-9 rounded-full transition-all duration-150 active:scale-95 flex items-center justify-center',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    webSearch
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-500 hover:bg-gray-100'
                  )}
                  aria-label="Toggle web search"
                  title="Web Search"
                >
                  <Globe className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={disabled || !input.trim()}
              className={cn(
                'flex-shrink-0 w-9 h-9 rounded-full',
                'flex items-center justify-center',
                'bg-primary-600 text-white',
                'transition-all duration-200',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'active:scale-95',
                !disabled && input.trim() && 'hover:bg-primary-700'
              )}
              aria-label="Send message"
            >
              <ArrowUp className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
