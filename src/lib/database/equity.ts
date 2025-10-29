/**
 * Equity Transaction Database Functions
 *
 * This module handles all equity-related database operations including:
 * - Granting shares for various actions (signup, subscription, referrals)
 * - Fetching equity transaction history
 * - Calculating shares balances
 *
 * Share Grant Rules:
 * - Signup: 100 shares (one-time)
 * - Subscription: 5-40 shares/month (based on tier)
 * - Referral Given: 50 shares (per successful referral)
 * - Referral Received: 25 shares (one-time bonus)
 */

import { supabase } from '@/lib/supabase'
import type { EquityTransaction } from '@/types/database'

/**
 * Grant signup shares to a new user
 * Awards 100 shares as a one-time bonus for creating an account
 *
 * @param userId - The user's ID (UUID)
 * @throws Error if database operation fails
 */
export async function grantSignupShares(userId: string): Promise<void> {
  const { error } = await supabase
    .from('equity_transactions')
    .insert({
      user_id: userId,
      transaction_type: 'signup',
      shares_amount: 100,
      description: 'Signup bonus - thank you for joining Ampel!',
      metadata: {
        granted_at: new Date().toISOString()
      }
    })

  if (error) {
    console.error('Error granting signup shares:', error)
    throw new Error(`Failed to grant signup shares: ${error.message}`)
  }
}

/**
 * Grant referral bonus shares
 * Awards shares to both the new user (25) and the referrer (50)
 *
 * @param newUserId - The new user's ID who was referred
 * @param referrerId - The ID of the user who made the referral
 * @throws Error if database operation fails
 */
export async function grantReferralBonus(
  newUserId: string,
  referrerId: string
): Promise<void> {
  // Grant 25 shares to the new user
  const { error: newUserError } = await supabase
    .from('equity_transactions')
    .insert({
      user_id: newUserId,
      transaction_type: 'referral_received',
      shares_amount: 25,
      description: 'Referral bonus - you were referred by a friend!',
      metadata: {
        referred_by: referrerId,
        granted_at: new Date().toISOString()
      }
    })

  if (newUserError) {
    console.error('Error granting referral bonus to new user:', newUserError)
    throw new Error(`Failed to grant referral bonus to new user: ${newUserError.message}`)
  }

  // Grant 50 shares to the referrer
  const { error: referrerError } = await supabase
    .from('equity_transactions')
    .insert({
      user_id: referrerId,
      transaction_type: 'referral_given',
      shares_amount: 50,
      description: 'Referral reward - thank you for spreading the word!',
      metadata: {
        referred_user: newUserId,
        granted_at: new Date().toISOString()
      }
    })

  if (referrerError) {
    console.error('Error granting referral bonus to referrer:', referrerError)
    // Note: We don't throw here because the new user's bonus was already granted
    // The referrer's bonus can be retried or handled separately
  }
}

/**
 * Grant subscription shares based on the user's subscription tier
 * Awards 5-40 shares per month depending on the tier
 *
 * Tier Share Amounts:
 * - starter: 5 shares/month
 * - plus: 10 shares/month
 * - pro: 20 shares/month
 * - max: 40 shares/month
 *
 * @param userId - The user's ID
 * @param tier - The subscription tier
 * @throws Error if database operation fails or tier is invalid
 */
export async function grantSubscriptionShares(
  userId: string,
  tier: 'starter' | 'plus' | 'pro' | 'max'
): Promise<void> {
  // Calculate shares based on tier
  const sharesMap = {
    starter: 5,
    plus: 10,
    pro: 20,
    max: 40
  }

  const sharesAmount = sharesMap[tier]

  if (!sharesAmount) {
    throw new Error(`Invalid subscription tier: ${tier}`)
  }

  const { error } = await supabase
    .from('equity_transactions')
    .insert({
      user_id: userId,
      transaction_type: 'subscription',
      shares_amount: sharesAmount,
      description: `Monthly subscription shares (${tier} tier)`,
      metadata: {
        tier,
        granted_at: new Date().toISOString(),
        billing_period: new Date().toISOString().slice(0, 7) // YYYY-MM format
      }
    })

  if (error) {
    console.error('Error granting subscription shares:', error)
    throw new Error(`Failed to grant subscription shares: ${error.message}`)
  }
}

/**
 * Get all equity transactions for a user
 * Returns transactions in reverse chronological order (newest first)
 *
 * @param userId - The user's ID
 * @returns Array of equity transactions
 * @throws Error if database operation fails
 */
export async function getEquityTransactions(userId: string): Promise<EquityTransaction[]> {
  const { data, error } = await supabase
    .from('equity_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching equity transactions:', error)
    throw new Error(`Failed to fetch equity transactions: ${error.message}`)
  }

  return data || []
}

/**
 * Get the current shares balance for a user
 * This is stored in the profiles table and updated automatically by a trigger
 *
 * @param userId - The user's ID
 * @returns The user's current shares balance
 * @throws Error if database operation fails
 */
export async function getSharesBalance(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('profiles')
    .select('shares_balance')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('Error fetching shares balance:', error)
    throw new Error(`Failed to fetch shares balance: ${error.message}`)
  }

  return data?.shares_balance || 0
}

/**
 * Calculate the monthly shares amount for a given subscription tier
 * This is a helper function for displaying share amounts in the UI
 *
 * @param tier - The subscription tier
 * @returns Number of shares earned per month for this tier
 */
export function calculateSubscriptionShares(tier: 'starter' | 'plus' | 'pro' | 'max'): number {
  const sharesMap = {
    starter: 5,
    plus: 10,
    pro: 20,
    max: 40
  }

  return sharesMap[tier] || 0
}
