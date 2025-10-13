interface StreamingTitleProps {
  title: string
  isStreaming: boolean
  className?: string
}

/**
 * Displays a title with streaming animation
 * Shows a blinking cursor while streaming
 */
export function StreamingTitle({
  title,
  isStreaming,
  className = '',
}: StreamingTitleProps) {
  return (
    <span className={className}>
      {title || 'New Chat'}
      {isStreaming && title && (
        <span className="inline-block w-0.5 h-4 ml-1 bg-current animate-pulse" />
      )}
    </span>
  )
}
