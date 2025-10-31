// ============================================================================
// Cancel Subscription Edge Function
// ============================================================================
// Cancels a user's Stripe subscription at the end of the current billing period.
// The user retains access until their paid period expires.
//
// Authentication: REQUIRES valid Supabase JWT token
//
// Response: { success: true, message: "Subscription will cancel at period end", period_end: "2025-02-01T00:00:00.000Z" }
//
// Documentation:
// - Stripe Cancel at Period End: https://docs.stripe.com/api/subscriptions/update#update_subscription-cancel_at_period_end
// ============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@17'

// Extract user ID from JWT
function getUserIdFromJWT(req: Request): string {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing authorization')
  }

  const token = authHeader.replace('Bearer ', '')
  const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))

  if (!payload.sub) throw new Error('Invalid token')
  return payload.sub
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Get user ID from JWT
    const userId = getUserIdFromJWT(req)
    console.log(`Cancel subscription request from user: ${userId}`)

    // Initialize clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2024-12-18.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Get user's subscription ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_subscription_id, subscription_status')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError)
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!profile.stripe_subscription_id) {
      console.warn(`User ${userId} has no subscription to cancel`)
      return new Response(
        JSON.stringify({ error: 'No active subscription found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Cancel subscription at period end
    console.log(`Canceling subscription at period end: ${profile.stripe_subscription_id}`)

    const subscription = await stripe.subscriptions.update(
      profile.stripe_subscription_id,
      { cancel_at_period_end: true }
    )

    console.log(`Subscription ${subscription.id} will cancel at: ${new Date(subscription.current_period_end * 1000).toISOString()}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Subscription will cancel at the end of the current billing period',
        period_end: new Date(subscription.current_period_end * 1000).toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Cancel subscription error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to cancel subscription' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
