import { supabase } from '@/lib/supabase'

/**
 * Database helper functions for managing KYC verification status
 *
 * KYC Status Flow:
 * 1. not_started: User hasn't started KYC verification
 * 2. pending: User completed Persona flow, waiting for review
 * 3. approved: Verification approved by Persona
 * 4. declined: Verification declined by Persona
 * 5. needs_review: Inquiry marked for manual review
 */

export interface KYCStatus {
  status: 'not_started' | 'pending' | 'approved' | 'declined' | 'needs_review'
  personaInquiryId: string | null
  personaAccountId: string | null
  completedAt: string | null
  declinedReason: string | null
}

/**
 * Get the current user's KYC status from the database
 *
 * @param userId - The authenticated user's ID
 * @returns KYCStatus object or null if user not found
 */
export async function getKYCStatus(userId: string): Promise<KYCStatus | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('kyc_status, persona_inquiry_id, persona_account_id, kyc_completed_at, kyc_declined_reason')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('Error fetching KYC status:', error)
    return null
  }

  if (!data) {
    return null
  }

  return {
    status: data.kyc_status,
    personaInquiryId: data.persona_inquiry_id,
    personaAccountId: data.persona_account_id,
    completedAt: data.kyc_completed_at,
    declinedReason: data.kyc_declined_reason
  }
}

/**
 * Mark KYC as pending after user completes Persona embedded flow
 *
 * This is called when the user successfully completes the Persona verification
 * flow on the frontend. Sets the status to 'pending' and saves the inquiry ID.
 *
 * The status will be updated to 'approved', 'declined', or 'needs_review' later
 * by the webhook when Persona finishes processing.
 *
 * Includes retry logic with exponential backoff to handle:
 * - Transient network errors
 * - Auth token expiration
 * - Temporary database unavailability
 *
 * Note: RLS policy "Users can update KYC to pending" allows authenticated users
 * to update their own KYC status to 'pending' and set inquiry/reference IDs.
 *
 * @param userId - The authenticated user's ID
 * @param inquiryId - The Persona inquiry ID returned from the embedded flow
 * @throws Error if profile doesn't exist or update fails after retries
 */
export async function markKYCPending(userId: string, inquiryId: string): Promise<void> {
  const maxRetries = 3
  const baseDelay = 1000 // Start with 1 second

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Refresh auth session before critical operation
      // This prevents "TypeError: Load failed" from expired tokens
      if (attempt > 0) {
        console.log(`🔄 Retry attempt ${attempt}/${maxRetries}: Refreshing auth session...`)
        const { error: refreshError } = await supabase.auth.refreshSession()
        if (refreshError) {
          console.warn('⚠️ Failed to refresh session:', refreshError.message)
          // Continue anyway - the session might still be valid
        }
      }

      // Verify the user's profile exists
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('id, kyc_status')
        .eq('id', userId)
        .single()

      // Distinguish between network errors and actual missing profile
      if (checkError) {
        const errorMessage = checkError.message || ''
        const isNetworkError =
          errorMessage.includes('Load failed') ||
          errorMessage.includes('Failed to fetch') ||
          errorMessage.includes('NetworkError') ||
          checkError.code === ''

        if (isNetworkError && attempt < maxRetries) {
          // Network error - retry with exponential backoff
          const delay = baseDelay * Math.pow(2, attempt)
          console.warn(`⚠️ Network error on attempt ${attempt + 1}, retrying in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue // Try again
        }

        // Either not a network error, or we've exhausted retries
        console.error('❌ Profile lookup failed:', checkError)
        throw new Error(
          isNetworkError
            ? 'Network connection issue. Please check your connection and try again.'
            : 'User profile not found. Your session may be outdated. Please log out and log in again.'
        )
      }

      if (!existingProfile) {
        console.error('❌ Profile not found for user:', userId)
        throw new Error('User profile not found. Please log out and log in again.')
      }

      console.log('Profile found, current KYC status:', existingProfile.kyc_status)

      // Update the profile with KYC pending status
      const { data, error } = await supabase
        .from('profiles')
        .update({
          kyc_status: 'pending',
          persona_inquiry_id: inquiryId,
          persona_reference_id: userId,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()

      if (error) {
        const errorMessage = error.message || ''
        const isNetworkError =
          errorMessage.includes('Load failed') ||
          errorMessage.includes('Failed to fetch') ||
          errorMessage.includes('NetworkError')

        if (isNetworkError && attempt < maxRetries) {
          // Network error during update - retry
          const delay = baseDelay * Math.pow(2, attempt)
          console.warn(`⚠️ Network error during update on attempt ${attempt + 1}, retrying in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue // Try again
        }

        console.error('❌ Error updating KYC status:', error)
        throw new Error(
          isNetworkError
            ? 'Network connection issue. Please check your connection and try again.'
            : `Failed to update KYC status: ${error.message}`
        )
      }

      // Verify rows were actually updated
      if (!data || data.length === 0) {
        console.error('❌ No rows updated for user:', userId)
        throw new Error('Failed to update profile. This may be due to permission issues. Please contact support.')
      }

      console.log('✅ KYC status updated to pending:', {
        userId,
        inquiryId,
        rowsUpdated: data.length,
        newStatus: data[0].kyc_status,
        attemptNumber: attempt + 1
      })

      // Success! Exit the retry loop
      return

    } catch (error) {
      // If this was our last attempt, re-throw the error
      if (attempt === maxRetries) {
        throw error
      }
      // Otherwise, the loop will continue to retry
    }
  }
}
