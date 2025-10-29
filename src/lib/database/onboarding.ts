/**
 * Onboarding Completion Functions
 *
 * These functions handle the final steps of onboarding after:
 * - User has selected a subscription plan
 * - User has accepted disclosures
 * - User has completed KYC verification
 * - User has completed Stripe payment (or placeholder in Phase 1)
 */

import { supabase } from '@/lib/supabase'
import { grantSignupShares, grantReferralBonus } from './equity'
import { validateReferralCode } from './subscriptions'

/**
 * Complete user onboarding and grant all earned shares
 *
 * This function should ONLY be called after the user has:
 * 1. Selected a subscription tier
 * 2. Accepted legal disclosures
 * 3. Completed KYC verification (approved status)
 * 4. Completed payment (Stripe checkout in Phase 2)
 *
 * It will:
 * - Grant 100 signup shares
 * - Process any pending referral code (grant 25 to user, 50 to referrer)
 * - Mark onboarding as complete
 *
 * @param userId - The user's ID
 * @throws Error if user is not ready for completion or database operations fail
 */
export async function completeOnboardingAndGrantShares(userId: string): Promise<void> {
  // First, verify the user has completed all required steps
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('selected_subscription_tier, disclosures_accepted_at, kyc_status, onboarding_completed_at, pending_referral_code')
    .eq('id', userId)
    .single()

  if (profileError) {
    throw new Error(`Failed to fetch user profile: ${profileError.message}`)
  }

  if (!profile) {
    throw new Error('User profile not found')
  }

  // Verify all onboarding requirements are met
  if (!profile.selected_subscription_tier) {
    throw new Error('Cannot complete onboarding: No subscription tier selected')
  }

  if (!profile.disclosures_accepted_at) {
    throw new Error('Cannot complete onboarding: Disclosures not accepted')
  }

  if (profile.kyc_status !== 'approved') {
    throw new Error('Cannot complete onboarding: KYC not approved')
  }

  // Prevent double-granting if onboarding was already completed
  if (profile.onboarding_completed_at) {
    console.log('Onboarding already completed for user:', userId)
    return
  }

  // Now grant all the shares the user has earned
  try {
    // 1. Grant signup shares (100 shares)
    await grantSignupShares(userId)
    console.log('✅ Signup shares granted:', userId)

    // 2. Process pending referral code if exists
    if (profile.pending_referral_code) {
      const isValid = await validateReferralCode(profile.pending_referral_code)

      if (isValid) {
        // Find the referrer by their referral code
        const { data: referrer, error: referrerError } = await supabase
          .from('profiles')
          .select('id')
          .eq('referral_code', profile.pending_referral_code)
          .single()

        if (!referrerError && referrer) {
          // Grant referral bonuses (25 to new user, 50 to referrer)
          await grantReferralBonus(userId, referrer.id)
          console.log('✅ Referral bonuses granted for code:', profile.pending_referral_code)
        } else {
          console.warn('Could not find referrer for code:', profile.pending_referral_code)
        }
      } else {
        console.warn('Invalid referral code, skipping:', profile.pending_referral_code)
      }

      // Clear the pending referral code now that it's been processed
      await supabase
        .from('profiles')
        .update({ pending_referral_code: null })
        .eq('id', userId)
    }

    // 3. Mark onboarding as complete
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        onboarding_completed_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (updateError) {
      throw new Error(`Failed to mark onboarding complete: ${updateError.message}`)
    }

    console.log('✅ Onboarding completed and shares granted for user:', userId)

  } catch (error) {
    console.error('Error completing onboarding:', error)
    throw error
  }
}

/**
 * Check if a user has completed onboarding
 *
 * @param userId - The user's ID
 * @returns true if onboarding is complete, false otherwise
 */
export async function isOnboardingComplete(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('onboarding_completed_at')
    .eq('id', userId)
    .single()

  if (error || !data) {
    return false
  }

  return !!data.onboarding_completed_at
}