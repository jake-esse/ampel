import { Sparkles } from 'lucide-react'

/**
 * Empty state component shown when no messages in conversation
 * Displays a welcoming message to encourage first interaction
 */
export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      {/* Icon */}
      <div className="mb-6">
        <Sparkles className="w-16 h-16 text-primary-500" strokeWidth={1.5} />
      </div>

      {/* Greeting */}
      <h2 className="text-2xl font-semibold text-gray-900 mb-2">Hi there!</h2>

      {/* Subtitle */}
      <p className="text-gray-600 text-base max-w-sm">
        Start a conversation by typing a message below. I'm here to help with anything you need.
      </p>
    </div>
  )
}
