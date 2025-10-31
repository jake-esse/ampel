// ============================================================================
// Stripe Webhook Handler Edge Function
// ============================================================================
// This Edge Function receives and processes webhook events from Stripe,
// including payment success events that complete user onboarding and grant
// equity shares.
//
// Authentication: Webhook signature verification (NOT JWT)
//
// Critical Security Requirements:
// - MUST verify webhook signatures using HMAC-SHA256
// - MUST validate timestamp to prevent replay attacks
// - MUST use service role for database operations (bypasses RLS)
// - MUST check idempotency to prevent double-granting shares
// - MUST return 200 even on errors (prevents endless Stripe retries)
//
// Events Handled:
// - checkout.session.completed: Payment succeeded, grant shares, complete onboarding
// - customer.subscription.updated: Subscription status changed
// - customer.subscription.deleted: Subscription cancelled
//
// Documentation:
// - Stripe Webhooks: https://stripe.com/docs/webhooks
// - Signature Verification: https://stripe.com/docs/webhooks/signatures
// - Supabase Edge Functions: https://supabase.com/docs/guides/functions
// ============================================================================

import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

// ============================================================================
// Type Definitions
// ============================================================================

interface StripeEvent {
  id: string
  type: string
  data: {
    object: any
  }
  created: number
}

interface CheckoutSession {
  id: string
  customer: string
  subscription: string
  metadata: {
    user_id?: string
    tier?: string
    [key: string]: string | undefined
  }
  payment_status: string
  status: string
}

interface Subscription {
  id: string
  customer: string
  status: string
  current_period_end: number
  cancel_at_period_end: boolean
  metadata: {
    user_id?: string
    tier?: string
    [key: string]: string | undefined
  }
}

interface Profile {
  id: string
  selected_subscription_tier: string | null
  shares_balance: number
  pending_referral_code: string | null
  onboarding_completed_at: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
}

interface WebhookResponse {
  received: boolean
  event?: string
  processed?: boolean
  user_id?: string
  error?: string
}

// ============================================================================
// Constants
// ============================================================================

// Subscription tier to monthly share amounts
const TIER_SHARES: Record<string, number> = {
  starter: 5,
  plus: 10,
  pro: 20,
  max: 40
}

// Valid subscription tiers
const VALID_TIERS = ['starter', 'plus', 'pro', 'max'] as const

// Signup bonus shares (granted on first subscription)
const SIGNUP_SHARES = 100

// Referral shares
const REFERRAL_RECEIVED_SHARES = 25
const REFERRAL_GIVEN_SHARES = 50

// Timestamp tolerance for replay attack prevention (5 minutes)
const TIMESTAMP_TOLERANCE = 300 // seconds

// ============================================================================
// Webhook Signature Verification
// ============================================================================

/**
 * Verifies the authenticity of a Stripe webhook request using HMAC-SHA256.
 *
 * Stripe signs webhook payloads with a secret and includes the signature
 * in the `stripe-signature` header. We must verify this signature to ensure
 * the request actually came from Stripe and wasn't forged.
 *
 * Signature Header Format:
 *   stripe-signature: t=<timestamp>,v1=<signature>[,v1=<signature>...]
 *
 * Signed Payload Format:
 *   {timestamp}.{raw_body}
 *
 * Algorithm:
 *   HMAC-SHA256(webhook_secret, signed_payload)
 *
 * Security Checks:
 *   1. Signature header is present
 *   2. At least one v1 signature is present
 *   3. Computed signature matches at least one provided signature
 *   4. Timestamp is within tolerance window (prevents replay attacks)
 *
 * @param request - The incoming webhook request
 * @param rawBody - The raw request body as text
 * @param webhookSecret - The webhook signing secret from Stripe
 * @returns true if signature is valid, false otherwise
 */
async function verifyWebhookSignature(
  request: Request,
  rawBody: string,
  webhookSecret: string
): Promise<boolean> {
  try {
    // Extract signature header
    const signatureHeader = request.headers.get('stripe-signature')

    if (!signatureHeader) {
      console.error('🚨 Missing stripe-signature header')
      return false
    }

    // Parse signature header
    // Format: t=1234567890,v1=abc123...,v1=def456...
    const signatureParts = signatureHeader.split(',')
    const signatureMap: Record<string, string[]> = {}

    for (const part of signatureParts) {
      const [key, value] = part.split('=')
      if (key && value) {
        if (!signatureMap[key]) {
          signatureMap[key] = []
        }
        signatureMap[key].push(value)
      }
    }

    const timestamp = signatureMap['t']?.[0]
    const signatures = signatureMap['v1'] || []

    if (!timestamp) {
      console.error('🚨 Missing timestamp in signature header')
      return false
    }

    if (signatures.length === 0) {
      console.error('🚨 Missing v1 signature in signature header')
      return false
    }

    // Validate timestamp to prevent replay attacks
    const timestampSeconds = parseInt(timestamp, 10)
    const currentSeconds = Math.floor(Date.now() / 1000)
    const timeDifference = currentSeconds - timestampSeconds

    if (timeDifference > TIMESTAMP_TOLERANCE) {
      console.error('🚨 Webhook timestamp too old:', {
        timestamp: timestampSeconds,
        current: currentSeconds,
        difference: timeDifference,
        tolerance: TIMESTAMP_TOLERANCE
      })
      return false
    }

    // Construct signed payload
    // Format: {timestamp}.{raw_body}
    const signedPayload = `${timestamp}.${rawBody}`

    // Compute expected signature using HMAC-SHA256
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(webhookSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(signedPayload)
    )

    // Convert signature to hex string
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    // Compare with provided signatures (timing-safe comparison)
    // Stripe may provide multiple signatures (e.g., if secret was recently rotated)
    let signatureMatches = false
    for (const providedSignature of signatures) {
      if (timingSafeEqual(expectedSignature, providedSignature)) {
        signatureMatches = true
        break
      }
    }

    if (!signatureMatches) {
      console.error('🚨 Signature verification failed:', {
        expected: expectedSignature.substring(0, 16) + '...',
        provided: signatures[0].substring(0, 16) + '...',
        timestamp: timestampSeconds
      })
      return false
    }

    console.log('✅ Webhook signature verified successfully')
    return true
  } catch (error) {
    console.error('🚨 Error verifying webhook signature:', error)
    return false
  }
}

/**
 * Timing-safe string comparison to prevent timing attacks.
 *
 * @param a - First string
 * @param b - Second string
 * @returns true if strings are equal
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}

// ============================================================================
// Payment Success Handler (checkout.session.completed)
// ============================================================================

/**
 * Handles successful payment events from Stripe.
 *
 * This is the MOST CRITICAL function in the webhook handler. When a user
 * successfully pays for a subscription, this function:
 *
 * 1. Updates the user's profile with subscription details
 * 2. Grants signup shares (100) if this is their first subscription
 * 3. Grants subscription shares (5-40 based on tier)
 * 4. Processes referral bonuses if applicable
 * 5. Sets onboarding_completed_at to mark onboarding complete
 * 6. Stores subscription_period_end for access control
 *
 * Security:
 * - Only called after signature verification passes
 * - Uses service role to bypass RLS
 * - Checks idempotency to prevent double-granting
 * - Validates all metadata before processing
 *
 * @param event - The Stripe checkout.session.completed event
 * @param supabase - Supabase admin client (service role)
 * @param stripe - Stripe client instance
 * @returns Response object indicating success or failure
 */
async function handlePaymentSuccess(
  event: StripeEvent,
  supabase: any,
  stripe: Stripe
): Promise<WebhookResponse> {
  console.log('🎉 Processing payment success event:', event.id)

  const session = event.data.object as CheckoutSession

  // Extract metadata from session
  const userId = session.metadata?.user_id
  const tier = session.metadata?.tier
  const subscriptionId = session.subscription
  const customerId = session.customer

  console.log('📋 Session metadata:', {
    userId,
    tier,
    subscriptionId,
    customerId,
    paymentStatus: session.payment_status,
    status: session.status
  })

  // Validate required metadata
  if (!userId) {
    console.error('❌ Missing user_id in session metadata')
    return {
      received: true,
      event: event.type,
      processed: false,
      error: 'Missing user_id in metadata'
    }
  }

  if (!tier || !VALID_TIERS.includes(tier as any)) {
    console.error('❌ Invalid or missing tier in session metadata:', tier)
    return {
      received: true,
      event: event.type,
      processed: false,
      error: 'Invalid tier in metadata'
    }
  }

  // Fetch user profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, selected_subscription_tier, shares_balance, pending_referral_code, onboarding_completed_at, stripe_customer_id, stripe_subscription_id')
    .eq('id', userId)
    .single()

  if (profileError || !profile) {
    console.error('❌ Failed to fetch profile:', profileError)
    return {
      received: true,
      event: event.type,
      processed: false,
      error: 'Profile not found'
    }
  }

  console.log('👤 Profile loaded:', {
    userId: profile.id,
    tier: profile.selected_subscription_tier,
    sharesBalance: profile.shares_balance,
    onboardingCompleted: profile.onboarding_completed_at,
    hasPendingReferral: !!profile.pending_referral_code
  })

  // Check idempotency: Has onboarding already been completed?
  if (profile.onboarding_completed_at) {
    console.log('⚠️ Onboarding already completed, skipping share grants')
    return {
      received: true,
      event: event.type,
      processed: true,
      user_id: userId,
      error: 'Already processed (idempotency check)'
    }
  }

  // Fetch subscription details from Stripe to get current_period_end
  console.log('📡 Fetching subscription details from Stripe...')
  let subscriptionPeriodEnd: string | null = null

  try {
    const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId as string)
    subscriptionPeriodEnd = new Date(stripeSubscription.current_period_end * 1000).toISOString()
    console.log(`📅 Subscription period ends: ${subscriptionPeriodEnd}`)
  } catch (error) {
    console.error('❌ Failed to fetch subscription from Stripe:', error)
    // Continue anyway - period_end can be updated later via subscription.updated event
  }

  // Update profile with subscription details and complete onboarding
  console.log('💾 Updating profile with subscription details...')

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      stripe_subscription_id: subscriptionId,
      subscription_status: 'active',
      subscription_period_end: subscriptionPeriodEnd,
      onboarding_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)

  if (updateError) {
    console.error('❌ Failed to update profile:', updateError)
    return {
      received: true,
      event: event.type,
      processed: false,
      error: 'Failed to update profile'
    }
  }

  console.log('✅ Profile updated successfully')

  // Grant shares
  let totalShares = 0
  const shareGrants: string[] = []

  // 1. SIGNUP SHARES (100) - Only if this is the first subscription
  if (profile.shares_balance === 0) {
    console.log('💰 Granting signup shares (first subscription)...')

    const { error: signupError } = await supabase
      .from('equity_transactions')
      .insert({
        user_id: userId,
        transaction_type: 'signup',
        shares_amount: SIGNUP_SHARES,
        description: 'Signup bonus - thank you for joining Ampel!',
        metadata: {
          granted_at: new Date().toISOString(),
          granted_via: 'stripe_webhook',
          event_id: event.id
        }
      })

    if (signupError) {
      console.error('❌ Failed to grant signup shares:', signupError)
    } else {
      totalShares += SIGNUP_SHARES
      shareGrants.push(`${SIGNUP_SHARES} signup shares`)
      console.log(`✅ Granted ${SIGNUP_SHARES} signup shares`)
    }
  } else {
    console.log('ℹ️ Skipping signup shares (not first subscription)')
  }

  // 2. SUBSCRIPTION SHARES (5-40 based on tier) - Always grant
  const subscriptionShares = TIER_SHARES[tier]
  console.log(`💰 Granting subscription shares for ${tier} tier...`)

  const { error: subscriptionError } = await supabase
    .from('equity_transactions')
    .insert({
      user_id: userId,
      transaction_type: 'subscription',
      shares_amount: subscriptionShares,
      description: `Monthly subscription shares (${tier} tier)`,
      metadata: {
        tier,
        granted_at: new Date().toISOString(),
        granted_via: 'stripe_webhook',
        event_id: event.id,
        subscription_id: subscriptionId
      }
    })

  if (subscriptionError) {
    console.error('❌ Failed to grant subscription shares:', subscriptionError)
  } else {
    totalShares += subscriptionShares
    shareGrants.push(`${subscriptionShares} subscription shares (${tier})`)
    console.log(`✅ Granted ${subscriptionShares} subscription shares`)
  }

  // 3. REFERRAL SHARES (if applicable)
  if (profile.pending_referral_code) {
    console.log('🤝 Processing referral code:', profile.pending_referral_code)

    // Find referrer by referral code
    const { data: referrer, error: referrerError } = await supabase
      .from('profiles')
      .select('id')
      .eq('referral_code', profile.pending_referral_code)
      .single()

    if (referrerError || !referrer) {
      console.warn('⚠️ Invalid referral code, skipping referral shares:', profile.pending_referral_code)
    } else {
      console.log('👥 Found referrer:', referrer.id)

      // Grant shares to new user (referral received)
      const { error: receivedError } = await supabase
        .from('equity_transactions')
        .insert({
          user_id: userId,
          transaction_type: 'referral_received',
          shares_amount: REFERRAL_RECEIVED_SHARES,
          description: 'Referral bonus - you were referred by a friend!',
          metadata: {
            referred_by: referrer.id,
            referral_code: profile.pending_referral_code,
            granted_at: new Date().toISOString(),
            granted_via: 'stripe_webhook',
            event_id: event.id
          }
        })

      if (receivedError) {
        console.error('❌ Failed to grant referral received shares:', receivedError)
      } else {
        totalShares += REFERRAL_RECEIVED_SHARES
        shareGrants.push(`${REFERRAL_RECEIVED_SHARES} referral received shares`)
        console.log(`✅ Granted ${REFERRAL_RECEIVED_SHARES} referral received shares`)
      }

      // Grant shares to referrer (referral given)
      const { error: givenError } = await supabase
        .from('equity_transactions')
        .insert({
          user_id: referrer.id,
          transaction_type: 'referral_given',
          shares_amount: REFERRAL_GIVEN_SHARES,
          description: 'Referral reward - thank you for spreading the word!',
          metadata: {
            referred_user: userId,
            referral_code: profile.pending_referral_code,
            granted_at: new Date().toISOString(),
            granted_via: 'stripe_webhook',
            event_id: event.id
          }
        })

      if (givenError) {
        console.error('❌ Failed to grant referral given shares:', givenError)
      } else {
        console.log(`✅ Granted ${REFERRAL_GIVEN_SHARES} referral given shares to referrer`)
      }

      // Clear pending referral code
      const { error: clearError } = await supabase
        .from('profiles')
        .update({
          pending_referral_code: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (clearError) {
        console.error('❌ Failed to clear pending referral code:', clearError)
      } else {
        console.log('✅ Cleared pending referral code')
      }
    }
  } else {
    console.log('ℹ️ No pending referral code')
  }

  console.log('🎊 Payment success processing complete:', {
    userId,
    tier,
    totalShares,
    shareGrants,
    onboardingCompleted: true
  })

  return {
    received: true,
    event: event.type,
    processed: true,
    user_id: userId
  }
}

// ============================================================================
// Subscription Update Handler (customer.subscription.updated)
// ============================================================================

/**
 * Handles subscription status changes.
 *
 * This event is fired when:
 * - Subscription renews (status remains 'active')
 * - Payment fails (status changes to 'past_due')
 * - Subscription is paused or cancelled
 *
 * We update the subscription_status in the profile but do NOT grant shares
 * (shares are only granted on initial payment via checkout.session.completed).
 *
 * @param event - The Stripe customer.subscription.updated event
 * @param supabase - Supabase admin client (service role)
 * @returns Response object indicating success or failure
 */
async function handleSubscriptionUpdated(
  event: StripeEvent,
  supabase: any
): Promise<WebhookResponse> {
  console.log('🔄 Processing subscription update event:', event.id)

  const subscription = event.data.object as Subscription

  const userId = subscription.metadata?.user_id
  const subscriptionId = subscription.id
  const status = subscription.status
  const cancelAtPeriodEnd = subscription.cancel_at_period_end
  const currentPeriodEnd = subscription.current_period_end

  console.log('📋 Subscription details:', {
    userId,
    subscriptionId,
    status,
    cancelAtPeriodEnd,
    currentPeriodEnd: new Date(currentPeriodEnd * 1000).toISOString()
  })

  if (!userId) {
    console.error('❌ Missing user_id in subscription metadata')
    return {
      received: true,
      event: event.type,
      processed: false,
      error: 'Missing user_id in metadata'
    }
  }

  // Map Stripe status to our subscription_status
  // Stripe statuses: active, past_due, canceled, incomplete, incomplete_expired, trialing, unpaid
  // Our statuses: active, past_due, cancelled, pending
  let ourStatus: string
  switch (status) {
    case 'active':
    case 'trialing':
      ourStatus = 'active'
      break
    case 'past_due':
    case 'unpaid':
      ourStatus = 'past_due'
      break
    case 'canceled':
    case 'incomplete_expired':
      ourStatus = 'cancelled'
      break
    case 'incomplete':
      ourStatus = 'pending'
      break
    default:
      ourStatus = status
  }

  // Convert period end to ISO string
  const subscriptionPeriodEnd = new Date(currentPeriodEnd * 1000).toISOString()

  console.log(`💾 Updating subscription: status=${status} → ${ourStatus}, period_end=${subscriptionPeriodEnd}, cancel_at_period_end=${cancelAtPeriodEnd}`)

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      subscription_status: ourStatus,
      subscription_period_end: subscriptionPeriodEnd,
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscriptionId)

  if (updateError) {
    console.error('❌ Failed to update subscription status:', updateError)
    return {
      received: true,
      event: event.type,
      processed: false,
      error: 'Failed to update subscription status'
    }
  }

  console.log('✅ Subscription status updated successfully')

  return {
    received: true,
    event: event.type,
    processed: true,
    user_id: userId
  }
}

// ============================================================================
// Subscription Deleted Handler (customer.subscription.deleted)
// ============================================================================

/**
 * Handles subscription cancellation or expiration.
 *
 * This event is fired when:
 * - User cancels their subscription
 * - Subscription expires after grace period
 * - Subscription is deleted by Stripe
 *
 * We update the subscription_status to 'cancelled' but do NOT revoke shares
 * (shares are permanent once granted).
 *
 * @param event - The Stripe customer.subscription.deleted event
 * @param supabase - Supabase admin client (service role)
 * @returns Response object indicating success or failure
 */
async function handleSubscriptionDeleted(
  event: StripeEvent,
  supabase: any
): Promise<WebhookResponse> {
  console.log('🗑️ Processing subscription deletion event:', event.id)

  const subscription = event.data.object as Subscription

  const userId = subscription.metadata?.user_id
  const subscriptionId = subscription.id

  console.log('📋 Subscription details:', {
    userId,
    subscriptionId
  })

  if (!userId) {
    console.error('❌ Missing user_id in subscription metadata')
    return {
      received: true,
      event: event.type,
      processed: false,
      error: 'Missing user_id in metadata'
    }
  }

  console.log('💾 Marking subscription as cancelled')

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      subscription_status: 'cancelled',
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscriptionId)

  if (updateError) {
    console.error('❌ Failed to update subscription status:', updateError)
    return {
      received: true,
      event: event.type,
      processed: false,
      error: 'Failed to update subscription status'
    }
  }

  console.log('✅ Subscription marked as cancelled')

  return {
    received: true,
    event: event.type,
    processed: true,
    user_id: userId
  }
}

// ============================================================================
// Main Handler
// ============================================================================

/**
 * Main Edge Function handler.
 *
 * Receives webhook events from Stripe, verifies signatures, and routes
 * events to appropriate handlers.
 *
 * Flow:
 * 1. Handle CORS preflight
 * 2. Read raw request body
 * 3. Verify webhook signature
 * 4. Parse event
 * 5. Route to event handler
 * 6. Return response
 *
 * Security:
 * - MUST verify signature before processing
 * - Returns 401 for invalid signatures
 * - Returns 200 for all other cases (prevents Stripe retries)
 */
Deno.serve(async (req) => {
  // CORS headers for webhook endpoint
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, stripe-signature',
  }

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({
        error: 'Method not allowed',
        message: 'This endpoint only accepts POST requests'
      } as WebhookResponse),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }

  try {
    // Read raw request body (needed for signature verification)
    const rawBody = await req.text()

    console.log('📨 Webhook request received:', {
      contentLength: rawBody.length,
      hasSignature: !!req.headers.get('stripe-signature')
    })

    // Get webhook secret
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    if (!webhookSecret) {
      console.error('🚨 STRIPE_WEBHOOK_SECRET not configured')
      return new Response(
        JSON.stringify({
          error: 'Configuration error',
          message: 'Webhook secret not configured'
        } as WebhookResponse),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Verify webhook signature
    const isValid = await verifyWebhookSignature(req, rawBody, webhookSecret)
    if (!isValid) {
      console.error('🚨 Invalid webhook signature - rejecting request')
      return new Response(
        JSON.stringify({
          received: false,
          error: 'Invalid signature'
        } as WebhookResponse),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Parse event
    let event: StripeEvent
    try {
      event = JSON.parse(rawBody)
    } catch (error) {
      console.error('❌ Failed to parse webhook event:', error)
      return new Response(
        JSON.stringify({
          received: true,
          processed: false,
          error: 'Invalid JSON'
        } as WebhookResponse),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('🎯 Webhook event:', {
      id: event.id,
      type: event.type,
      created: new Date(event.created * 1000).toISOString()
    })

    // Initialize Supabase admin client (service role)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('🚨 Missing Supabase environment variables')
      throw new Error('Supabase not configured')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Initialize Stripe client for fetching subscription details
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecretKey) {
      console.error('🚨 STRIPE_SECRET_KEY not configured')
      throw new Error('Stripe not configured')
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-12-18.acacia',
      httpClient: Stripe.createFetchHttpClient()
    })

    // Route event to appropriate handler
    let response: WebhookResponse

    switch (event.type) {
      case 'checkout.session.completed':
        response = await handlePaymentSuccess(event, supabase, stripe)
        break

      case 'customer.subscription.updated':
        response = await handleSubscriptionUpdated(event, supabase)
        break

      case 'customer.subscription.deleted':
        response = await handleSubscriptionDeleted(event, supabase)
        break

      default:
        console.log('ℹ️ Unhandled event type:', event.type)
        response = {
          received: true,
          event: event.type,
          processed: false,
          error: 'Unhandled event type'
        }
    }

    // Always return 200 (even on errors) to prevent Stripe from retrying
    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('🚨 Webhook processing error:', error)

    // Log detailed error but return generic message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error details:', errorMessage)

    // Return 200 even on errors (prevents endless retries)
    return new Response(
      JSON.stringify({
        received: true,
        processed: false,
        error: 'Internal error'
      } as WebhookResponse),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

/* ============================================================================
 * Configuration Notes:
 * ============================================================================
 *
 * Required Environment Variables (set via Supabase Vault/Secrets):
 * - STRIPE_SECRET_KEY: Your Stripe secret key for API calls
 * - STRIPE_WEBHOOK_SECRET: Webhook signing secret from Stripe Dashboard
 *   Format: whsec_...
 *   Get from: Stripe Dashboard > Developers > Webhooks > [Your Endpoint]
 * - SUPABASE_URL: Auto-provided by Supabase
 * - SUPABASE_SERVICE_ROLE_KEY: Auto-provided by Supabase
 *
 * Deploy command:
 *   supabase functions deploy stripe-webhook --no-verify-jwt
 *
 * Note: MUST use --no-verify-jwt flag. Webhooks use signature verification.
 *
 * Function URL (after deployment):
 *   https://[YOUR_PROJECT_REF].supabase.co/functions/v1/stripe-webhook
 *
 * Stripe Webhook Configuration (Phase 7):
 *   1. Go to Stripe Dashboard > Developers > Webhooks
 *   2. Add endpoint with URL above
 *   3. Select events to send:
 *      - checkout.session.completed
 *      - customer.subscription.updated
 *      - customer.subscription.deleted
 *   4. Copy webhook signing secret
 *   5. Set in Supabase: supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
 *
 * Testing:
 *   Use Stripe CLI to test locally:
 *   stripe trigger checkout.session.completed
 *   stripe listen --forward-to https://[YOUR_PROJECT_REF].supabase.co/functions/v1/stripe-webhook
 * ============================================================================
 */
