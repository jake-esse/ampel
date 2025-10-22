import { Leaf } from 'lucide-react'

/**
 * Empty state component shown when no messages in conversation
 * Displays a large leaf icon to indicate a fresh start
 * Smoothly transitions when keyboard opens/closes
 */
export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center transition-all duration-300 ease-out">
      {/* Icon */}
      <div className="transition-all duration-300 ease-out">
        <Leaf className="w-32 h-32 text-primary-500" strokeWidth={1.5} />
      </div>
    </div>
  )
}
