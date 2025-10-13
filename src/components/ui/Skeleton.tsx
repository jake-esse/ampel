import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

/**
 * Base skeleton component with shimmer animation
 * Used to create loading placeholders for content
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse bg-gray-700/50 rounded',
        className
      )}
      style={{
        backgroundImage:
          'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.05), transparent)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 2s infinite linear',
      }}
    />
  )
}

// Add shimmer keyframes to global styles (injected via style tag)
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = `
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
  `
  document.head.appendChild(style)
}
