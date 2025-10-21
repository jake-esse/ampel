import { Leaf } from 'lucide-react'

/**
 * Empty state component shown when no messages in conversation
 * Displays a large leaf icon to indicate a fresh start
 * Fixed position prevents movement when keyboard opens
 */
export function EmptyState() {
  return (
    <div className="relative h-full px-6">
      {/* Icon - fixed position to prevent keyboard from moving it */}
      <div
        className="absolute left-1/2"
        style={{
          top: 'calc(50% - 60px)',
          transform: 'translateX(-50%)',
        }}
      >
        <Leaf className="w-32 h-32 text-primary-500" strokeWidth={1.5} />
      </div>
    </div>
  )
}
