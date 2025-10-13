import { useContext } from 'react'
import { ConversationContext } from '@/contexts/ConversationContext'

/**
 * Hook to access the conversation list context
 * Provides access to conversations and methods to update them
 * @throws Error if used outside ConversationProvider
 */
export function useConversations() {
  const context = useContext(ConversationContext)

  if (!context) {
    throw new Error(
      'useConversations must be used within a ConversationProvider'
    )
  }

  return context
}
