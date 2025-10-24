// ============================================================================
// Persona KYC Webhook Handler
// ============================================================================
// This Edge Function receives webhooks from Persona when KYC status changes.
// It verifies the webhook signature, parses the event, and updates the user's
// KYC status in the database using the service role.
//
// Webhook Events Handled:
// - inquiry.completed: User finished KYC flow
// - inquiry.approved: Verification passed
// - inquiry.declined: Verification failed
// - inquiry.marked-for-review: Requires manual review
//
// Security:
// - Verifies HMAC-SHA256 signature using PERSONA_WEBHOOK_SECRET
// - Uses service role to bypass RLS policies
// - Validates all inputs before database updates
//
// Documentation:
// - Persona Webhooks: https://docs.withpersona.com/docs/webhooks
// - Supabase Edge Functions: https://supabase.com/docs/guides/functions
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================================================
// Type Definitions
// ============================================================================

interface PersonaWebhookPayload {
  data: {
    type: 'event'
    id: string
    attributes: {
      name: string
      payload: {
        data: {
          type: 'inquiry'
          id: string
          attributes: {
            status: string
            'reference-id': string
            'created-at': string
            'completed-at'?: string
            'declined-at'?: string
          }
        }
      }
    }
  }
}

interface WebhookResponse {
  success: boolean
  event?: string
  inquiry_id?: string
  error?: string
  details?: string
}

// ============================================================================
// Signature Verification
// ============================================================================

/**
 * Verifies the Persona webhook signature using HMAC-SHA256.
 *
 * Persona signs webhooks by computing HMAC-SHA256 of the raw request body
 * using your webhook secret. The signature is sent in the Persona-Signature header.
 *
 * @param body - Raw request body as string
 * @param signature - Signature from Persona-Signature header
 * @returns Promise<boolean> - True if signature is valid
 */
async function verifySignature(body: string, signature: string | null): Promise<boolean> {
  if (!signature) {
    console.error('Missing Persona-Signature header')
    return false
  }

  const webhookSecret = Deno.env.get('PERSONA_WEBHOOK_SECRET')
  if (!webhookSecret) {
    console.error('PERSONA_WEBHOOK_SECRET environment variable not configured')
    throw new Error('Webhook secret not configured')
  }

  try {
    // Encode the webhook secret and body
    const encoder = new TextEncoder()
    const keyData = encoder.encode(webhookSecret)
    const bodyData = encoder.encode(body)

    // Import the secret as a CryptoKey for HMAC
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    // Compute the HMAC-SHA256 signature
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, bodyData)

    // Convert signature to lowercase hex string
    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('')

    // Compare signatures (case-insensitive, timing-safe)
    const providedSignature = signature.toLowerCase()

    // Timing-safe comparison
    if (computedSignature.length !== providedSignature.length) {
      return false
    }

    let isMatch = true
    for (let i = 0; i < computedSignature.length; i++) {
      if (computedSignature[i] !== providedSignature[i]) {
        isMatch = false
      }
    }

    if (!isMatch) {
      console.error('Signature mismatch')
      console.error('Computed:', computedSignature.substring(0, 20) + '...')
      console.error('Provided:', providedSignature.substring(0, 20) + '...')
    }

    return isMatch
  } catch (error) {
    console.error('Error verifying signature:', error)
    return false
  }
}

// ============================================================================
// Event Handling
// ============================================================================

/**
 * Handles different Persona webhook events and updates the database.
 *
 * Maps Persona inquiry statuses to our internal KYC status values:
 * - inquiry.completed -> pending (user finished, waiting for review)
 * - inquiry.approved -> approved (verification passed)
 * - inquiry.declined -> declined (verification failed)
 * - inquiry.marked-for-review -> needs_review (manual review required)
 *
 * @param eventName - Persona event name (e.g., "inquiry.approved")
 * @param inquiry - Persona inquiry data object
 */
async function handleEvent(eventName: string, inquiry: any): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase environment variables')
  }

  // Create Supabase client with SERVICE ROLE key to bypass RLS
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  const referenceId = inquiry.attributes['reference-id']
  const inquiryId = inquiry.id
  const accountId = inquiry.attributes['account-id'] // For duplicate detection

  if (!referenceId) {
    throw new Error('Missing reference-id in inquiry attributes')
  }

  console.log(`Processing event: ${eventName} for reference: ${referenceId}`)

  // Prepare base update object
  const updates: any = {
    persona_inquiry_id: inquiryId,
    updated_at: new Date().toISOString()
  }

  // Add account ID for duplicate detection (if provided)
  if (accountId) {
    updates.persona_account_id = accountId
  }

  // Map event to KYC status
  switch (eventName) {
    case 'inquiry.completed':
      updates.kyc_status = 'pending'
      console.log('Inquiry completed, status set to pending')
      break

    case 'inquiry.approved':
      updates.kyc_status = 'approved'
      updates.kyc_completed_at = inquiry.attributes['completed-at'] || new Date().toISOString()
      console.log('Inquiry approved, status set to approved')
      break

    case 'inquiry.declined':
      updates.kyc_status = 'declined'
      updates.kyc_declined_reason = 'Verification failed per Persona decision'
      const declinedAt = inquiry.attributes['declined-at']
      if (declinedAt) {
        console.log(`Inquiry declined at ${declinedAt}`)
      }
      console.log('Inquiry declined, status set to declined')
      break

    case 'inquiry.marked-for-review':
      updates.kyc_status = 'needs_review'
      console.log('Inquiry marked for review, status set to needs_review')
      break

    default:
      console.log(`Unhandled event type: ${eventName}, skipping database update`)
      return // Don't update for unknown events
  }

  // Update the profile using reference_id
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('persona_reference_id', referenceId)
    .select()

  if (error) {
    console.error('Database update error:', error)
    throw new Error(`Failed to update profile: ${error.message}`)
  }

  if (!data || data.length === 0) {
    console.warn(`No profile found with persona_reference_id: ${referenceId}`)
    throw new Error(`Profile not found for reference ID: ${referenceId}`)
  }

  console.log(`Successfully updated profile for reference: ${referenceId}`)
  console.log(`New KYC status: ${updates.kyc_status}`)
}

// ============================================================================
// Main Handler
// ============================================================================

/**
 * Main Edge Function handler.
 *
 * Accepts POST requests from Persona webhooks, verifies the signature,
 * and updates the user's KYC status in the database.
 *
 * Returns:
 * - 200: Success
 * - 405: Method not allowed (only POST accepted)
 * - 401: Invalid signature
 * - 400: Invalid payload
 * - 500: Internal error
 */
Deno.serve(async (req) => {
  // CORS headers for all responses
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Persona-Signature',
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
        success: false,
        details: 'This endpoint only accepts POST requests'
      } as WebhookResponse),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }

  try {
    // Get raw body and signature
    const body = await req.text()
    const signature = req.headers.get('Persona-Signature')

    console.log('Received webhook request')
    console.log('Body length:', body.length)
    console.log('Has signature:', !!signature)

    // Verify webhook signature
    const isValidSignature = await verifySignature(body, signature)
    if (!isValidSignature) {
      console.error('Invalid signature, rejecting webhook')
      return new Response(
        JSON.stringify({
          error: 'Invalid signature',
          success: false,
          details: 'Webhook signature verification failed'
        } as WebhookResponse),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Signature verified successfully')

    // Parse the payload
    let payload: PersonaWebhookPayload
    try {
      payload = JSON.parse(body)
    } catch (parseError) {
      console.error('Failed to parse JSON payload:', parseError)
      return new Response(
        JSON.stringify({
          error: 'Invalid JSON payload',
          success: false,
          details: 'Request body is not valid JSON'
        } as WebhookResponse),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Extract event details
    const eventName = payload.data.attributes.name
    const inquiry = payload.data.attributes.payload.data

    console.log('Event name:', eventName)
    console.log('Inquiry ID:', inquiry.id)
    console.log('Reference ID:', inquiry.attributes['reference-id'])

    // Validate payload structure
    if (!eventName || !inquiry || !inquiry.id) {
      console.error('Invalid payload structure')
      return new Response(
        JSON.stringify({
          error: 'Invalid payload structure',
          success: false,
          details: 'Missing required fields in webhook payload'
        } as WebhookResponse),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Handle the event and update database
    await handleEvent(eventName, inquiry)

    // Return success response
    const response: WebhookResponse = {
      success: true,
      event: eventName,
      inquiry_id: inquiry.id
    }

    console.log('Webhook processed successfully')

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Webhook processing error:', error)

    // Log error details but don't expose internal details to client
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error details:', errorMessage)

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        success: false,
        details: 'An error occurred while processing the webhook'
      } as WebhookResponse),
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
 * - PERSONA_WEBHOOK_SECRET: Your Persona webhook secret from dashboard
 * - SUPABASE_URL: Auto-provided by Supabase
 * - SUPABASE_SERVICE_ROLE_KEY: Auto-provided by Supabase
 *
 * Deploy command:
 *   supabase functions deploy persona-webhook --no-verify-jwt
 *
 * The --no-verify-jwt flag is required because Persona doesn't send JWTs.
 * Authentication is handled via signature verification instead.
 *
 * Webhook URL (after deployment):
 *   https://[YOUR_PROJECT_REF].supabase.co/functions/v1/persona-webhook
 *
 * You'll configure this URL in the Persona Dashboard under:
 *   Settings > Webhooks > Add Endpoint
 * ============================================================================
 */
