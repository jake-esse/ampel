import { supabase } from '@/lib/supabase'
import type { AmpelQuestion } from '@/types/database'

/**
 * Database helper functions for managing Ampel discussion board questions
 */

/**
 * Check if a user is an admin
 * Compares user ID against VITE_ADMIN_USER_ID environment variable
 * @param userId - The user ID to check
 * @returns True if user is admin, false otherwise
 */
export function isAdmin(userId: string): boolean {
  const adminUserId = import.meta.env.VITE_ADMIN_USER_ID
  if (!adminUserId) {
    console.warn('VITE_ADMIN_USER_ID not set in environment')
    return false
  }
  return userId === adminUserId
}

/**
 * Create a new question for the discussion board
 * @param userId - The authenticated user's ID
 * @param questionText - The question text (1-500 characters)
 * @returns The newly created question
 */
export async function createQuestion(
  userId: string,
  questionText: string
): Promise<AmpelQuestion> {
  // Validate question text length
  if (!questionText || questionText.trim().length === 0) {
    throw new Error('Question text cannot be empty')
  }
  if (questionText.length > 500) {
    throw new Error('Question text must be 500 characters or less')
  }

  const { data, error } = await supabase
    .from('ampel_questions')
    .insert({
      user_id: userId,
      question_text: questionText.trim(),
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating question:', error)
    throw new Error(`Failed to create question: ${error.message}`)
  }

  if (!data) {
    throw new Error('No data returned from question creation')
  }

  return data
}

/**
 * List all questions from the discussion board
 * Ordered by creation date (newest first)
 * @returns Array of questions with responses
 */
export async function listQuestions(): Promise<AmpelQuestion[]> {
  const { data, error } = await supabase
    .from('ampel_questions')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error listing questions:', error)
    throw new Error(`Failed to list questions: ${error.message}`)
  }

  return data || []
}

/**
 * Respond to a question (admin only)
 * Updates the question with a response, responded_at timestamp, and responded_by user ID
 * @param questionId - The question ID
 * @param responseText - The response text
 * @param respondedBy - The admin user ID posting the response
 * @returns The updated question
 */
export async function respondToQuestion(
  questionId: string,
  responseText: string,
  respondedBy: string
): Promise<AmpelQuestion> {
  // Validate admin status
  if (!isAdmin(respondedBy)) {
    throw new Error('Only admin users can respond to questions')
  }

  // Validate response text
  if (!responseText || responseText.trim().length === 0) {
    throw new Error('Response text cannot be empty')
  }

  const { data, error } = await supabase
    .from('ampel_questions')
    .update({
      response_text: responseText.trim(),
      responded_at: new Date().toISOString(),
      responded_by: respondedBy,
    })
    .eq('id', questionId)
    .select()
    .single()

  if (error) {
    console.error('Error responding to question:', error)
    throw new Error(`Failed to respond to question: ${error.message}`)
  }

  if (!data) {
    throw new Error('No data returned from response update')
  }

  return data
}

/**
 * Delete a question from the discussion board
 * Only the question author or admin can delete
 * @param questionId - The question ID
 * @param userId - The user attempting to delete (for permission check)
 */
export async function deleteQuestion(
  questionId: string,
  userId: string
): Promise<void> {
  // First, fetch the question to check ownership
  const { data: question, error: fetchError } = await supabase
    .from('ampel_questions')
    .select('user_id')
    .eq('id', questionId)
    .single()

  if (fetchError) {
    console.error('Error fetching question for deletion:', fetchError)
    throw new Error(`Failed to fetch question: ${fetchError.message}`)
  }

  // Check if user is author or admin
  if (question.user_id !== userId && !isAdmin(userId)) {
    throw new Error('Only the question author or admin can delete questions')
  }

  const { error } = await supabase
    .from('ampel_questions')
    .delete()
    .eq('id', questionId)

  if (error) {
    console.error('Error deleting question:', error)
    throw new Error(`Failed to delete question: ${error.message}`)
  }
}

/**
 * Get a specific question by ID
 * @param id - The question ID
 * @returns The question or null if not found
 */
export async function getQuestion(id: string): Promise<AmpelQuestion | null> {
  const { data, error } = await supabase
    .from('ampel_questions')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    // Not found is not an error we want to throw
    if (error.code === 'PGRST116') {
      return null
    }
    console.error('Error fetching question:', error)
    throw new Error(`Failed to fetch question: ${error.message}`)
  }

  return data
}
