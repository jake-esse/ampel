import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Utility function to merge Tailwind CSS classes
 * Combines clsx for conditional classes and tailwind-merge for deduplication
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format timestamp for message display
 * Shows relative time for recent messages, exact time for older ones
 */
export function formatMessageTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)

  if (diffMins < 1) {
    return 'Just now'
  } else if (diffMins < 60) {
    return `${diffMins} min ago`
  } else if (diffHours < 24) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }
}

/**
 * Extract initials from a full name
 * Takes first letter of first and last word
 * @example getInitials("John Doe") // "JD"
 * @example getInitials("Jane") // "J"
 */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length === 0 || !words[0]) return '?'

  if (words.length === 1) {
    return words[0][0].toUpperCase()
  }

  // Take first and last word
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

/**
 * Get user initials with fallback to email
 * @param displayName - User's display name (optional)
 * @param email - User's email address (optional)
 * @returns Two-letter initials or '?' if no data
 */
export function getUserInitials(
  displayName: string | null | undefined,
  email: string | null | undefined
): string {
  if (displayName && displayName.trim()) {
    return getInitials(displayName)
  }

  if (email && email.trim()) {
    // Use first letter of email before @
    return email[0].toUpperCase()
  }

  return '?'
}

/**
 * Generate a consistent color for an avatar based on email
 * Uses a simple hash to pick from a predefined palette
 * @param email - User's email address
 * @returns Tailwind color class (e.g., 'bg-blue-600')
 */
export function getAvatarColor(email: string | null | undefined): string {
  // Color palette for avatars (all work well on dark background)
  const colors = [
    'bg-blue-600',
    'bg-purple-600',
    'bg-pink-600',
    'bg-red-600',
    'bg-orange-600',
    'bg-yellow-600',
    'bg-green-600',
    'bg-teal-600',
    'bg-cyan-600',
    'bg-indigo-600',
  ]

  if (!email) {
    return 'bg-gray-600' // Default fallback
  }

  // Simple hash function
  let hash = 0
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash)
    hash = hash & hash // Convert to 32-bit integer
  }

  // Pick color based on hash
  const index = Math.abs(hash) % colors.length
  return colors[index]
}
