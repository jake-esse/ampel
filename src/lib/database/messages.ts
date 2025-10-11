import { supabase } from '@/lib/supabase'
import type { Message as DbMessage } from '@/types/database'
import type { Message as FrontendMessage } from '@/types/chat'

/**
 * Database helper functions for managing messages
 */

/**
 * Save a message to the database
 * @param conversationId - The conversation this message belongs to
 * @param role - 'user' or 'assistant'
 * @param content - The message content
 * @param tokensUsed - Optional token count (null for user messages)
 * @returns The created message
 */
export async function saveMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  tokensUsed?: number | null
): Promise<DbMessage> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      role,
      content,
      tokens_used: tokensUsed ?? null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error saving message:', error)
    throw new Error(`Failed to save message: ${error.message}`)
  }

  if (!data) {
    throw new Error('No data returned from message creation')
  }

  return data
}

/**
 * Load all messages for a conversation
 * Ordered chronologically (oldest first)
 * @param conversationId - The conversation ID
 * @returns Array of messages
 */
export async function loadMessages(conversationId: string): Promise<DbMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error loading messages:', error)
    throw new Error(`Failed to load messages: ${error.message}`)
  }

  return data || []
}

/**
 * Delete a specific message
 * @param id - The message ID
 */
export async function deleteMessage(id: string): Promise<void> {
  const { error } = await supabase.from('messages').delete().eq('id', id)

  if (error) {
    console.error('Error deleting message:', error)
    throw new Error(`Failed to delete message: ${error.message}`)
  }
}

/**
 * Get total token usage for a conversation
 * @param conversationId - The conversation ID
 * @returns Total tokens used across all assistant messages
 */
export async function getConversationTokenUsage(
  conversationId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('messages')
    .select('tokens_used')
    .eq('conversation_id', conversationId)
    .eq('role', 'assistant')

  if (error) {
    console.error('Error calculating token usage:', error)
    return 0
  }

  // Sum up all non-null token values
  const total = (data || []).reduce((sum, msg) => {
    return sum + (msg.tokens_used || 0)
  }, 0)

  return total
}

/**
 * Convert database message to frontend message format
 * Handles timestamp conversion from ISO string to Date object
 * @param dbMessage - Database message with string timestamps
 * @returns Frontend message with Date objects
 */
export function convertDbMessageToFrontend(dbMessage: DbMessage): FrontendMessage {
  return {
    id: dbMessage.id,
    role: dbMessage.role,
    content: dbMessage.content,
    timestamp: new Date(dbMessage.created_at),
    // Don't include isStreaming - that's only for active streaming messages
  }
}

/**
 * Convert array of database messages to frontend format
 * @param dbMessages - Array of database messages
 * @returns Array of frontend messages
 */
export function convertDbMessagesToFrontend(
  dbMessages: DbMessage[]
): FrontendMessage[] {
  return dbMessages.map(convertDbMessageToFrontend)
}
