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
 * DIAGNOSTIC MODE: Enhanced logging to identify signature verification failures.
 *
 * Persona signs webhooks using a versioned signature scheme similar to Stripe.
 * The Persona-Signature header contains: "t=<timestamp>,v1=<signature>"
 * where the signature is computed as: HMAC-SHA256(secret, "{timestamp}.{body}")
 *
 * During secret rotation, multiple signatures may be present:
 * "t=1234567890,v1=sig1... t=1234567890,v1=sig2..."
 *
 * Documentation: https://docs.withpersona.com/docs/webhooks-best-practices
 *
 * @param body - Raw request body as string
 * @param signatureHeader - Full Persona-Signature header value
 * @returns Promise<boolean> - True if signature is valid
 */
async function verifySignature(body: string, signatureHeader: string | null): Promise<boolean> {
  console.log('🔍 === DIAGNOSTIC MODE: SIGNATURE VERIFICATION ===')

  if (!signatureHeader) {
    console.error('❌ Missing Persona-Signature header')
    return false
  }

  const webhookSecret = Deno.env.get('PERSONA_WEBHOOK_SECRET')
  if (!webhookSecret) {
    console.error('❌ PERSONA_WEBHOOK_SECRET not found in environment')
    throw new Error('Webhook secret not configured')
  }

  try {
    // Log secret verification (safe - only showing length and edges)
    console.log('🔑 Secret verification:')
    console.log(`  Length: ${webhookSecret.length} characters`)
    console.log(`  First 4 chars: "${webhookSecret.substring(0, 4)}"`)
    console.log(`  Last 4 chars: "${webhookSecret.substring(webhookSecret.length - 4)}"`)
    console.log(`  Has leading whitespace: ${webhookSecret !== webhookSecret.trimStart()}`)
    console.log(`  Has trailing whitespace: ${webhookSecret !== webhookSecret.trimEnd()}`)
    console.log(`  Has newlines: ${webhookSecret.includes('\n') || webhookSecret.includes('\r')}`)

    // Log signature header details
    console.log('\n📝 Signature header:')
    console.log(`  Raw value: "${signatureHeader}"`)
    console.log(`  Length: ${signatureHeader.length} characters`)
    console.log(`  Has leading whitespace: ${signatureHeader !== signatureHeader.trimStart()}`)
    console.log(`  Has trailing whitespace: ${signatureHeader !== signatureHeader.trimEnd()}`)

    // Log request body details
    console.log('\n📦 Request body:')
    console.log(`  Length: ${body.length} bytes`)
    console.log(`  First 200 chars: "${body.substring(0, 200)}"`)
    console.log(`  Contains newlines: ${body.includes('\n')}`)
    console.log(`  Contains carriage returns: ${body.includes('\r')}`)

    // Parse signature header: "t=1234567890,v1=abc123..." or multiple during rotation
    // Multiple signatures are separated by spaces: "t=123,v1=abc t=123,v1=def"
    const signatureSets = signatureHeader.trim().split(' ')
    console.log(`\n🔍 Found ${signatureSets.length} signature set(s) in header`)

    // Try each signature set (important for secret rotation)
    for (let i = 0; i < signatureSets.length; i++) {
      const sigSet = signatureSets[i]
      console.log(`\n📍 === Processing signature set ${i + 1}/${signatureSets.length} ===`)
      console.log(`  Raw signature set: "${sigSet}"`)

      const parts = sigSet.split(',')
      let timestamp: string | null = null
      let signature: string | null = null

      // Parse key=value pairs
      for (const part of parts) {
        const [key, value] = part.split('=')
        if (key === 't') timestamp = value
        if (key === 'v1') signature = value
      }

      if (!timestamp || !signature) {
        console.warn(`  ⚠️ Invalid signature format - missing t or v1`)
        console.warn(`  Parsed parts:`, parts)
        continue // Try next signature set
      }

      console.log(`  ✓ Extracted timestamp: ${timestamp}`)
      console.log(`  ✓ Extracted signature (first 8): ${signature.substring(0, 8)}...`)

      // Validate timestamp (reject if >5 minutes old to prevent replay attacks)
      const now = Math.floor(Date.now() / 1000)
      const timestampNum = parseInt(timestamp, 10)
      const age = now - timestampNum

      console.log(`\n  ⏰ Timestamp validation:`)
      console.log(`    Server Unix time: ${now}`)
      console.log(`    Webhook Unix time: ${timestampNum}`)
      console.log(`    Age: ${age} seconds (${Math.floor(age / 60)} minutes)`)
      console.log(`    Valid (< 300s): ${age <= 300}`)

      if (age > 300) {
        console.warn(`  ⚠️ Timestamp too old: ${age} seconds - skipping this signature`)
        continue // Try next signature set
      }

      // Construct signed payload: "{timestamp}.{body}"
      // This is the CRITICAL difference from the old implementation
      const signedPayload = `${timestamp}.${body}`
      console.log(`\n  🔨 Signed payload construction:`)
      console.log(`    Format: "timestamp.body"`)
      console.log(`    Timestamp part: "${timestamp}"`)
      console.log(`    Separator: "."`)
      console.log(`    Body part (first 100): "${body.substring(0, 100)}..."`)
      console.log(`    Combined length: ${signedPayload.length} characters`)
      console.log(`    First 100 of combined: "${signedPayload.substring(0, 100)}..."`)

      // Compute HMAC-SHA256 of the signed payload
      const encoder = new TextEncoder()
      const keyData = encoder.encode(webhookSecret)
      const payloadData = encoder.encode(signedPayload)

      console.log(`\n  🔐 HMAC-SHA256 computation:`)
      console.log(`    Key bytes: ${keyData.length}`)
      console.log(`    Payload bytes: ${payloadData.length}`)

      const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      )

      const signatureBuffer = await crypto.subtle.sign('HMAC', key, payloadData)

      // Convert to hex string
      const computedSignature = Array.from(new Uint8Array(signatureBuffer))
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('')

      // Timing-safe comparison
      const providedSignature = signature.toLowerCase()

      console.log(`\n  📊 Signature comparison:`)
      console.log(`    Computed:  ${computedSignature}`)
      console.log(`    Provided:  ${providedSignature}`)
      console.log(`    Computed length: ${computedSignature.length}`)
      console.log(`    Provided length: ${providedSignature.length}`)

      if (computedSignature.length !== providedSignature.length) {
        console.warn(`  ❌ Length mismatch - skipping this signature`)
        continue // Try next signature set
      }

      // Find first mismatch position
      let firstMismatch = -1
      let isMatch = true
      for (let j = 0; j < computedSignature.length; j++) {
        if (computedSignature[j] !== providedSignature[j]) {
          isMatch = false
          if (firstMismatch === -1) firstMismatch = j
        }
      }

      if (isMatch) {
        console.log(`  ✅ *** SIGNATURES MATCH! VERIFICATION SUCCESSFUL! ***`)
        console.log('🔍 === END DIAGNOSTIC - SUCCESS ===\n')
        return true
      } else {
        console.log(`  ❌ Signature mismatch`)
        console.log(`  First mismatch at character position: ${firstMismatch}`)
        if (firstMismatch >= 0) {
          const contextStart = Math.max(0, firstMismatch - 5)
          const contextEnd = Math.min(computedSignature.length, firstMismatch + 15)
          console.log(`  Context around mismatch:`)
          console.log(`    Computed: ...${computedSignature.substring(contextStart, contextEnd)}...`)
          console.log(`    Provided: ...${providedSignature.substring(contextStart, contextEnd)}...`)
          console.log(`    Position:    ${' '.repeat(firstMismatch - contextStart)}^`)
        }
      }
    }

    // None of the signatures matched
    console.error('\n❌ *** ALL SIGNATURE VERIFICATIONS FAILED ***')
    console.log('🔍 === END DIAGNOSTIC - FAILURE ===\n')
    return false
  } catch (error) {
    console.error('💥 Exception during signature verification:', error)
    console.error('Stack trace:', error instanceof Error ? error.stack : 'N/A')
    console.log('🔍 === END DIAGNOSTIC - ERROR ===\n')
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

  // IDEMPOTENCY CHECK: Fetch current status to prevent downgrades
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('kyc_status, persona_inquiry_id')
    .eq('persona_reference_id', referenceId)
    .single()

  const currentStatus = currentProfile?.kyc_status
  const currentInquiryId = currentProfile?.persona_inquiry_id

  console.log(`Current status in database: ${currentStatus}`)
  console.log(`Current inquiry ID: ${currentInquiryId}`)

  // Define status priority (higher number = higher priority)
  // This prevents status downgrades when webhooks arrive out of order
  const statusPriority: Record<string, number> = {
    'not_started': 0,
    'pending': 1,
    'needs_review': 2,
    'declined': 3,
    'approved': 3  // approved and declined have same priority (both terminal states)
  }

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
  let newStatus: string | null = null

  switch (eventName) {
    case 'inquiry.completed':
      newStatus = 'pending'
      updates.kyc_status = newStatus
      console.log('Inquiry completed, mapping to pending status')
      break

    case 'inquiry.approved':
      newStatus = 'approved'
      updates.kyc_status = newStatus
      updates.kyc_completed_at = inquiry.attributes['completed-at'] || new Date().toISOString()
      console.log('Inquiry approved, mapping to approved status')
      break

    case 'inquiry.declined':
      newStatus = 'declined'
      updates.kyc_status = newStatus
      updates.kyc_declined_reason = 'Verification failed per Persona decision'
      const declinedAt = inquiry.attributes['declined-at']
      if (declinedAt) {
        console.log(`Inquiry declined at ${declinedAt}`)
      }
      console.log('Inquiry declined, mapping to declined status')
      break

    case 'inquiry.marked-for-review':
      newStatus = 'needs_review'
      updates.kyc_status = newStatus
      console.log('Inquiry marked for review, mapping to needs_review status')
      break

    default:
      console.log(`Unhandled event type: ${eventName}, skipping database update`)
      return // Don't update for unknown events
  }

  // Check for status downgrade
  if (currentStatus && newStatus) {
    const currentPriority = statusPriority[currentStatus] || 0
    const newPriority = statusPriority[newStatus] || 0

    if (newPriority < currentPriority) {
      console.warn(`⚠️ PREVENTED STATUS DOWNGRADE: ${currentStatus} -> ${newStatus}`)
      console.warn(`Current priority: ${currentPriority}, New priority: ${newPriority}`)
      console.warn(`Webhook event ${eventName} arrived after status already progressed`)
      console.log('Skipping database update to prevent status downgrade')
      return // Don't update - prevent downgrade
    } else if (newPriority === currentPriority && currentStatus === newStatus) {
      console.log(`ℹ️ Status unchanged: ${currentStatus} -> ${newStatus}`)
      console.log('Same inquiry ID, duplicate webhook - skipping update')
      return // Same status, no need to update
    }
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
