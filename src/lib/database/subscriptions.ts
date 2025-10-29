/**
 * Subscription Database Functions
 *
 * This module handles subscription-related database operations including:
 * - Saving subscription tier selections
 * - Validating and applying referral codes
 * - Fetching subscription information
 *
 * Subscription Tiers:
 * - starter: $2/month
 * - plus: $5/month
 * - pro: $10/month (most popular)
 * - max: $20/month
 */

import { supabase } from '@/lib/supabase'
import { grantReferralBonus } from './equity'

/**
 * Save the user's subscription tier selection
 * This is called when the user selects a plan during onboarding
 *
 * @param userId - The user's ID
 * @param tier - The selected subscription tier
 * @throws Error if database operation fails
 */
export async function saveSubscriptionSelection(
  userId: string,
  tier: 'starter' | 'plus' | 'pro' | 'max'
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      selected_subscription_tier: tier
    })
    .eq('id', userId)

  if (error) {
    console.error('Error saving subscription selection:', error)
    throw new Error(`Failed to save subscription selection: ${error.message}`)
  }
}

/**
 * Get the user's selected subscription tier
 *
 * @param userId - The user's ID
 * @returns The subscription tier or null if not selected
 * @throws Error if database operation fails
 */
export async function getSubscriptionTier(
  userId: string
): Promise<'starter' | 'plus' | 'pro' | 'max' | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('selected_subscription_tier')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('Error fetching subscription tier:', error)
    throw new Error(`Failed to fetch subscription tier: ${error.message}`)
  }

  return data?.selected_subscription_tier || null
}

/**
 * Validate that a referral code exists in the database
 *
 * @param code - The referral code to validate
 * @returns True if the code exists and is valid
 * @throws Error if database operation fails
 */
export async function validateReferralCode(code: string): Promise<boolean> {
  if (!code || code.trim().length === 0) {
    return false
  }

  // Normalize code to uppercase (codes are stored in uppercase)
  const normalizedCode = code.trim().toUpperCase()

  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('referral_code', normalizedCode)
    .single()

  if (error) {
    // If no rows returned, code doesn't exist (this is not an error)
    if (error.code === 'PGRST116') {
      return false
    }
    console.error('Error validating referral code:', error)
    throw new Error(`Failed to validate referral code: ${error.message}`)
  }

  return !!data
}

/**
 * Apply a referral code to a user's profile
 * This grants shares to both the new user and the referrer
 *
 * Steps:
 * 1. Validate the referral code exists
 * 2. Get the referrer's user ID
 * 3. Update the new user's profile with referral info
 * 4. Grant referral bonuses (25 shares to new user, 50 to referrer)
 *
 * @param userId - The new user's ID
 * @param referralCode - The referral code used
 * @throws Error if code is invalid or database operation fails
 */
export async function applyReferralCode(
  userId: string,
  referralCode: string
): Promise<void> {
  // Normalize code to uppercase
  const normalizedCode = referralCode.trim().toUpperCase()

  // Get the referrer's profile
  const { data: referrerProfile, error: referrerError } = await supabase
    .from('profiles')
    .select('id, referral_code')
    .eq('referral_code', normalizedCode)
    .single()

  if (referrerError || !referrerProfile) {
    console.error('Error finding referrer:', referrerError)
    throw new Error('Invalid referral code')
  }

  // Prevent users from using their own referral code
  if (referrerProfile.id === userId) {
    throw new Error('You cannot use your own referral code')
  }

  // Update the new user's profile with referral information
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      referred_by: referrerProfile.id,
      referral_code_used: normalizedCode
    })
    .eq('id', userId)

  if (updateError) {
    console.error('Error updating profile with referral info:', updateError)
    throw new Error(`Failed to apply referral code: ${updateError.message}`)
  }

  // Grant referral bonuses (25 shares to new user, 50 to referrer)
  try {
    await grantReferralBonus(userId, referrerProfile.id)
  } catch (error) {
    // Log the error but don't throw - the referral link is saved
    // Shares can be granted manually if needed
    console.error('Error granting referral bonuses:', error)
  }
}

/**
 * Get Stripe product ID for a subscription tier
 * Maps tier names to Stripe product IDs
 *
 * @param tier - The subscription tier
 * @returns Stripe product ID
 */
export function getStripeProductId(tier: 'starter' | 'plus' | 'pro' | 'max'): string {
  const productMap = {
    starter: 'prod_TJC7E8pUJOi0Bf',
    plus: 'prod_TJC840twAdl7gX',
    pro: 'prod_TJC8tjacmF2kYX',
    max: 'prod_TJCAuoZLeyHHi5'
  }

  return productMap[tier]
}

/**
 * Get Stripe price ID for a subscription tier
 * Maps tier names to Stripe price IDs
 *
 * @param tier - The subscription tier
 * @returns Stripe price ID
 */
export function getStripePriceId(tier: 'starter' | 'plus' | 'pro' | 'max'): string {
  const priceMap = {
    starter: 'price_1SMZj7CslnCo4qXAAyDoL4zr',
    plus: 'price_1SMZkGCslnCo4qXA5ndkqNt2',
    pro: 'price_1SMZkdCslnCo4qXA1RssoO41',
    max: 'price_1SMZmHCslnCo4qXAmFuGxIqq'
  }

  return priceMap[tier]
}

/**
 * Get the monthly price in USD for a subscription tier
 *
 * @param tier - The subscription tier
 * @returns Price in dollars
 */
export function getTierPrice(tier: 'starter' | 'plus' | 'pro' | 'max'): number {
  const priceMap = {
    starter: 2,
    plus: 5,
    pro: 10,
    max: 20
  }

  return priceMap[tier]
}
