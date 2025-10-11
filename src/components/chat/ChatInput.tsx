import { useState, KeyboardEvent } from 'react'
import { SendHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChatInputProps {
  onSend: (content: string) => void
  disabled?: boolean
}

/**
 * Chat input component with textarea and send button
 * Handles Enter to send, Shift+Enter for new line
 */
export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [input, setInput] = useState('')

  const handleSend = () => {
    const trimmed = input.trim()
    if (trimmed && !disabled) {
      onSend(trimmed)
      setInput('')
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
      <div className="flex items-end gap-2 max-w-4xl mx-auto">
        {/* Textarea */}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Type a message..."
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
    </div>
  )
}
