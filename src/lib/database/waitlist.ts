import { supabase } from '@/lib/supabase'
import type { DeveloperWaitlist } from '@/types/database'

/**
 * Database helper functions for managing developer waitlist
 */

/**
 * Submit an email address to the developer waitlist
 * @param email - The email address to add to the waitlist
 * @returns Success object with data or error message
 */
export async function submitWaitlistEmail(email: string): Promise<{
  success: boolean
  message: string
  data?: DeveloperWaitlist
}> {
  try {
    const { data, error } = await supabase
      .from('developer_waitlist')
      .insert({
        email: email.toLowerCase().trim(), // Normalize email
      })
      .select()
      .single()

    if (error) {
      // Handle duplicate email error specifically
      if (error.code === '23505') {
        // Postgres unique violation error code
        return {
          success: false,
          message: 'This email is already on the waitlist',
        }
      }

      console.error('Error submitting waitlist email:', error)
      return {
        success: false,
        message: 'Failed to join waitlist. Please try again.',
      }
    }

    if (!data) {
      return {
        success: false,
        message: 'No data returned from submission',
      }
    }

    return {
      success: true,
      message: 'Successfully joined the waitlist!',
      data,
    }
  } catch (err) {
    console.error('Unexpected error submitting waitlist email:', err)
    return {
      success: false,
      message: 'An unexpected error occurred. Please try again.',
    }
  }
}
