/**
 * Account Management Functions
 *
 * Handles subscription cancellation and account management
 */

import { supabase } from '@/lib/supabase'

/**
 * Cancel user subscription at end of billing period
 *
 * Calls Edge Function that:
 * 1. Updates Stripe subscription with cancel_at_period_end = true
 * 2. User retains access until subscription period ends
 * 3. Account and shares remain intact
 *
 * @throws Error if cancellation fails
 */
export async function cancelSubscription(): Promise<void> {
  const { error } = await supabase.functions.invoke('cancel-subscription')

  if (error) {
    console.error('Cancel subscription error:', error)
    throw new Error(error.message || 'Failed to cancel subscription')
  }
}
