import { supabase } from '@/lib/supabase'
import type { Conversation } from '@/types/database'

/**
 * Database helper functions for managing conversations
 */

/**
 * Create a new conversation for the authenticated user
 * @param userId - The authenticated user's ID
 * @returns The newly created conversation
 */
export async function createConversation(userId: string): Promise<Conversation> {
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      user_id: userId,
      title: null, // Will be AI-generated later
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating conversation:', error)
    throw new Error(`Failed to create conversation: ${error.message}`)
  }

  if (!data) {
    throw new Error('No data returned from conversation creation')
  }

  return data
}

/**
 * Get a specific conversation by ID
 * @param id - The conversation ID
 * @returns The conversation or null if not found
 */
export async function getConversation(id: string): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    // Not found is not an error we want to throw
    if (error.code === 'PGRST116') {
      return null
    }
    console.error('Error fetching conversation:', error)
    throw new Error(`Failed to fetch conversation: ${error.message}`)
  }

  return data
}

/**
 * Update the updated_at timestamp for a conversation
 * This is called automatically by the database trigger when messages are added,
 * but can also be called manually if needed
 * @param id - The conversation ID
 */
export async function updateConversationTimestamp(id: string): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('Error updating conversation timestamp:', error)
    // Don't throw - this is a non-critical operation
  }
}

/**
 * List all conversations for the authenticated user
 * Ordered by most recently updated first
 * @param userId - The authenticated user's ID
 * @returns Array of conversations
 */
export async function listUserConversations(
  userId: string
): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Error listing conversations:', error)
    throw new Error(`Failed to list conversations: ${error.message}`)
  }

  return data || []
}

/**
 * Delete a conversation and all its messages (cascade delete)
 * @param id - The conversation ID
 */
export async function deleteConversation(id: string): Promise<void> {
  const { error } = await supabase.from('conversations').delete().eq('id', id)

  if (error) {
    console.error('Error deleting conversation:', error)
    throw new Error(`Failed to delete conversation: ${error.message}`)
  }
}

/**
 * Update the title of a conversation
 * @param id - The conversation ID
 * @param title - The new title
 */
export async function updateConversationTitle(
  id: string,
  title: string
): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ title })
    .eq('id', id)

  if (error) {
    console.error('Error updating conversation title:', error)
    throw new Error(`Failed to update conversation title: ${error.message}`)
  }
}
