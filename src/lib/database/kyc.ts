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
 * Note: RLS policy "Users can update KYC to pending" allows authenticated users
 * to update their own KYC status to 'pending' and set inquiry/reference IDs.
 *
 * @param userId - The authenticated user's ID
 * @param inquiryId - The Persona inquiry ID returned from the embedded flow
 * @throws Error if profile doesn't exist or update fails
 */
export async function markKYCPending(userId: string, inquiryId: string): Promise<void> {
  // First, verify the user's profile exists
  // This catches stale session issues where the user was deleted
  const { data: existingProfile, error: checkError } = await supabase
    .from('profiles')
    .select('id, kyc_status')
    .eq('id', userId)
    .single()

  if (checkError || !existingProfile) {
    console.error('❌ Profile not found for user:', userId)
    console.error('Check error:', checkError)
    throw new Error(
      'User profile not found. Your session may be outdated. Please log out and log in again.'
    )
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
    console.error('❌ Error updating KYC status:', error)
    throw new Error(`Failed to update KYC status: ${error.message}`)
  }

  // Verify rows were actually updated
  // Without .select(), Supabase returns { error: null } even if no rows matched
  if (!data || data.length === 0) {
    console.error('❌ No rows updated for user:', userId)
    throw new Error(
      'Failed to update profile. This may be due to permission issues. Please contact support.'
    )
  }

  console.log('✅ KYC status updated to pending:', {
    userId,
    inquiryId,
    rowsUpdated: data.length,
    newStatus: data[0].kyc_status
  })
}
