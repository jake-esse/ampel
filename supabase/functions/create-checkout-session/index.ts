// ============================================================================
// Stripe Checkout Session Edge Function
// ============================================================================
// This Edge Function creates Stripe checkout sessions for authenticated users
// who have completed KYC verification. It handles customer creation/retrieval
// and returns a client secret for embedded checkout.
//
// Authentication: REQUIRES valid Supabase JWT token
//
// Request Body:
// {
//   "priceId": "price_xxx" // One of the four configured subscription tiers
// }
//
// Response:
// {
//   "clientSecret": "cs_test_...",
//   "customerId": "cus_...",
//   "sessionId": "cs_..."
// }
//
// Security:
// - JWT verification required (verify_jwt = true in config.toml)
// - Validates KYC status before creating session
// - Uses service role for database writes
// - Validates price ID against expected values
//
// Documentation:
// - Stripe Embedded Checkout: https://docs.stripe.com/payments/checkout/embedded
// - Supabase Edge Functions: https://supabase.com/docs/guides/functions
// ============================================================================

import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

// ============================================================================
// Type Definitions
// ============================================================================

interface CheckoutSessionRequest {
  priceId: string
}

interface CheckoutSessionResponse {
  clientSecret: string
  customerId: string
  sessionId: string
}

interface ErrorResponse {
  error: string
  message: string
  code?: string
}

interface Profile {
  id: string
  selected_subscription_tier: string | null
  kyc_status: string
  stripe_customer_id: string | null
}

// ============================================================================
// Constants
// ============================================================================

// Valid Stripe price IDs for subscription tiers
// These correspond to the four subscription products in Stripe
const VALID_PRICE_IDS = [
  'price_1SMZj7CslnCo4qXAAyDoL4zr', // Starter
  'price_1SMZkGCslnCo4qXA5ndkqNt2', // Plus
  'price_1SMZkdCslnCo4qXA1RssoO41', // Pro
  'price_1SMZmHCslnCo4qXAmFuGxIqq'  // Max
] as const

// ============================================================================
// JWT Extraction
// ============================================================================

/**
 * Extracts and validates the user ID from the Supabase JWT token.
 *
 * Supabase automatically validates the JWT before the function executes
 * (when verify_jwt = true). We extract the user ID from the Authorization header.
 *
 * @param req - The incoming request
 * @returns User ID from the JWT
 * @throws Error if JWT is missing or invalid
 */
function getUserIdFromJWT(req: Request): string {
  const authHeader = req.headers.get('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header')
  }

  // Parse JWT to get user ID
  // Supabase has already validated the token, we just need to extract the payload
  const token = authHeader.replace('Bearer ', '')

  try {
    // JWT format: header.payload.signature
    const parts = token.split('.')
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format')
    }

    // Decode payload (base64url)
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))

    if (!payload.sub) {
      throw new Error('JWT missing sub claim')
    }

    return payload.sub
  } catch (error) {
    console.error('JWT parsing error:', error)
    throw new Error('Failed to parse JWT token')
  }
}

// ============================================================================
// Customer Management
// ============================================================================

/**
 * Creates or retrieves a Stripe customer for the user.
 *
 * If the user already has a stripe_customer_id in their profile, we reuse it.
 * Otherwise, we create a new Stripe customer and store the ID in the profile.
 *
 * Customer metadata includes the user_id for webhook correlation.
 *
 * @param stripe - Stripe client instance
 * @param supabase - Supabase admin client
 * @param userId - Supabase user ID
 * @param email - User's email address
 * @param existingCustomerId - Existing customer ID from profile (if any)
 * @returns Stripe customer ID
 */
async function getOrCreateCustomer(
  stripe: Stripe,
  supabase: any,
  userId: string,
  email: string,
  existingCustomerId: string | null
): Promise<string> {
  // If user already has a customer ID, verify it exists in Stripe and reuse it
  if (existingCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(existingCustomerId)
      if (customer && !customer.deleted) {
        console.log(`Using existing Stripe customer: ${existingCustomerId}`)
        return existingCustomerId
      }
      console.warn(`Customer ${existingCustomerId} not found or deleted in Stripe, creating new one`)
    } catch (error) {
      console.error(`Error retrieving customer ${existingCustomerId}:`, error)
      console.log('Will create new customer')
    }
  }

  // Create new Stripe customer
  console.log(`Creating new Stripe customer for user: ${userId}`)

  const customer = await stripe.customers.create({
    email,
    metadata: {
      user_id: userId, // CRITICAL: Webhook uses this to find the profile
      created_via: 'checkout_session_function',
      created_at: new Date().toISOString()
    }
  })

  console.log(`Created new Stripe customer: ${customer.id}`)

  // Store customer ID in profile
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      stripe_customer_id: customer.id,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)

  if (updateError) {
    console.error('Failed to update profile with customer ID:', updateError)
    // Don't throw - customer was created successfully in Stripe
    // Webhook can still work using metadata
  } else {
    console.log(`Updated profile with customer ID: ${customer.id}`)
  }

  return customer.id
}

// ============================================================================
// Main Handler
// ============================================================================

/**
 * Main Edge Function handler.
 *
 * Creates a Stripe checkout session for authenticated users who have:
 * - Selected a subscription tier
 * - Completed and passed KYC verification
 *
 * Returns a client secret for initializing embedded checkout on the frontend.
 *
 * Flow:
 * 1. Extract user ID from JWT (Supabase validates JWT automatically)
 * 2. Parse request body for price ID
 * 3. Fetch user profile and validate:
 *    - Tier is selected
 *    - KYC is approved
 *    - Price ID is valid
 * 4. Create or retrieve Stripe customer
 * 5. Create checkout session with embedded UI mode
 * 6. Return client secret
 *
 * Returns:
 * - 200: Success with client secret
 * - 400: Bad request (missing/invalid data)
 * - 401: Unauthorized (invalid/missing JWT)
 * - 403: Forbidden (KYC not approved)
 * - 404: Not found (profile doesn't exist)
 * - 500: Internal error
 */
Deno.serve(async (req) => {
  // CORS headers for frontend integration
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
      } as ErrorResponse),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }

  try {
    // Extract user ID from JWT token
    // Supabase validates JWT automatically when verify_jwt = true
    let userId: string
    try {
      userId = getUserIdFromJWT(req)
      console.log(`Create checkout session request from user: ${userId}`)
    } catch (error) {
      console.error('JWT validation error:', error)
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          message: 'Authentication required'
        } as ErrorResponse),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Parse request body
    let requestBody: CheckoutSessionRequest
    try {
      requestBody = await req.json()
    } catch (error) {
      console.error('JSON parse error:', error)
      return new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: 'Invalid JSON in request body',
          code: 'INVALID_JSON'
        } as ErrorResponse),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate price ID is provided
    if (!requestBody.priceId) {
      return new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: 'Price ID is required',
          code: 'MISSING_PRICE_ID'
        } as ErrorResponse),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate price ID is one of our configured tiers
    if (!VALID_PRICE_IDS.includes(requestBody.priceId as any)) {
      console.error(`Invalid price ID provided: ${requestBody.priceId}`)
      return new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: 'Invalid price ID',
          code: 'INVALID_PRICE_ID'
        } as ErrorResponse),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`Price ID validated: ${requestBody.priceId}`)

    // Initialize Stripe client
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecretKey) {
      console.error('STRIPE_SECRET_KEY not configured')
      throw new Error('Stripe not configured')
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-12-18.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Initialize Supabase admin client (service role)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('Missing Supabase environment variables')
      throw new Error('Supabase not configured')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Fetch user profile with required fields
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, selected_subscription_tier, kyc_status, stripe_customer_id')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError)
      return new Response(
        JSON.stringify({
          error: 'Not Found',
          message: 'User profile not found'
        } as ErrorResponse),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`Profile loaded: tier=${profile.selected_subscription_tier}, kyc=${profile.kyc_status}`)

    // Validate user has selected a subscription tier
    if (!profile.selected_subscription_tier) {
      return new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: 'Please select a subscription tier',
          code: 'NO_TIER_SELECTED'
        } as ErrorResponse),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate KYC is approved
    if (profile.kyc_status !== 'approved') {
      console.warn(`User ${userId} attempted checkout with KYC status: ${profile.kyc_status}`)
      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: 'Please complete identity verification',
          code: 'KYC_NOT_APPROVED'
        } as ErrorResponse),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`Selected tier: ${profile.selected_subscription_tier}, price ID: ${requestBody.priceId}`)

    // Get user email for customer creation
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId)

    if (authError || !authUser.user || !authUser.user.email) {
      console.error('Failed to fetch user email:', authError)
      throw new Error('Failed to retrieve user email')
    }

    const userEmail = authUser.user.email

    // Create or retrieve Stripe customer
    const customerId = await getOrCreateCustomer(
      stripe,
      supabase,
      userId,
      userEmail,
      profile.stripe_customer_id
    )

    // Get origin for return URL
    const origin = req.headers.get('origin') || 'http://localhost:5173'

    // Create checkout session with embedded UI mode
    console.log(`Creating checkout session for customer: ${customerId}`)

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      ui_mode: 'embedded', // CRITICAL: Enables embedded checkout
      customer: customerId,
      line_items: [
        {
          price: requestBody.priceId,
          quantity: 1
        }
      ],
      metadata: {
        user_id: userId, // CRITICAL: Webhook uses this to find the profile
        tier: profile.selected_subscription_tier,
        created_via: 'checkout_session_function'
      },
      // return_url is required by Stripe API but we use onComplete callback instead
      return_url: `${origin}/checkout-success?session_id={CHECKOUT_SESSION_ID}`
    })

    console.log(`Created checkout session: ${session.id}`)

    // Return success response with client secret
    const response: CheckoutSessionResponse = {
      clientSecret: session.client_secret!,
      customerId: customerId,
      sessionId: session.id
    }

    console.log('Checkout session created successfully')

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Checkout session creation error:', error)

    // Log detailed error but return generic message to client
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error details:', errorMessage)

    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: 'Failed to create checkout session'
      } as ErrorResponse),
      {
        status: 500,
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
 * - SUPABASE_URL: Auto-provided by Supabase
 * - SUPABASE_SERVICE_ROLE_KEY: Auto-provided by Supabase
 *
 * Deploy command:
 *   supabase functions deploy create-checkout-session
 *
 * Note: Do NOT use --no-verify-jwt flag. JWT verification is required.
 *
 * Function URL (after deployment):
 *   https://[YOUR_PROJECT_REF].supabase.co/functions/v1/create-checkout-session
 *
 * Call from frontend:
 *   const { data, error } = await supabase.functions.invoke(
 *     'create-checkout-session',
 *     {
 *       body: { priceId: 'price_xxx' }
 *     }
 *   )
 * ============================================================================
 */
