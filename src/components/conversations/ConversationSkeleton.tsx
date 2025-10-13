import { Skeleton } from '@/components/ui/Skeleton'

/**
 * Skeleton loader for conversation list items
 * Matches the dimensions and layout of ConversationItem
 */
export function ConversationSkeleton() {
  return (
    <div className="px-4 py-3">
      <div className="flex flex-col gap-2">
        {/* Title skeleton */}
        <Skeleton className="h-4 w-3/4" />

        {/* Preview/subtitle skeleton */}
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}
