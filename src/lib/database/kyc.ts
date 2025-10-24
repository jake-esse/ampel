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
 */
export async function markKYCPending(userId: string, inquiryId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      kyc_status: 'pending',
      persona_inquiry_id: inquiryId,
      persona_reference_id: userId,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)

  if (error) {
    console.error('Error updating KYC status:', error)
    throw new Error(`Failed to update KYC status: ${error.message}`)
  }

  console.log('✅ KYC status updated to pending:', { userId, inquiryId })
}
