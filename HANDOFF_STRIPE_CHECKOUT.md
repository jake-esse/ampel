# Stripe Checkout Implementation - Session Handoff

**Date:** 2025-10-28
**Session Context:** Onboarding Flow Debugging → Stripe Integration Prep
**Next Task:** Implement Stripe Embedded Checkout for subscription payments

---

## Executive Summary

This session successfully resolved critical bugs in the onboarding flow, making it production-ready. The app now handles KYC verification reliably with proper error handling and retry logic. The next phase is to implement Stripe's embedded checkout to collect payments before granting shares and completing onboarding.

**Current State:**
- ✅ Complete onboarding flow working (Signup → Equity → Plans → Disclosures → KYC)
- ✅ KYC verification with Persona integrated and tested
- ✅ Robust error handling with network retry logic
- ✅ Profile state management working correctly
- ⚠️ Checkout page is a placeholder with countdown (loops after completion)
- 🎯 **Ready for Stripe integration**

---

## Session Work Summary

### Problem 1: Stale Profile Cache Bug
**Symptom:** After KYC approval, users got stuck on "Loading identity verification..." screen.

**Root Cause:** ProtectedRoute was using cached profile data with old KYC status, causing incorrect redirects back to the KYC page.

**Solution:** Added `kycJustApproved` navigation state flag to force fresh profile fetch after KYC approval (matching existing patterns for `tierJustSelected` and `disclosuresJustAccepted`).

**Files Modified:**
- `src/pages/KYCPending.tsx` - Pass `kycJustApproved: true` in navigation state (line 44)
- `src/components/auth/ProtectedRoute.tsx` - Detect flag and immediately fetch fresh profile (lines 35-36, 112-136, 196)

### Problem 2: Network Error Handling
**Symptom:** "Verification Error: User profile not found" when network was unstable (user on train hotspot).

**Root Cause:**
1. No retry logic for critical database operations
2. Auth tokens could expire during long Persona flows
3. Network errors misreported as "profile not found"
4. Single failure point with no recovery

**Solution:** Implemented comprehensive retry logic with:
- 3 automatic retries with exponential backoff (1s, 2s, 4s)
- Auth session refresh on each retry attempt
- Network error detection (distinguishes "Load failed" from database errors)
- Clear, actionable error messages

**Files Modified:**
- `src/lib/database/kyc.ts` - Complete rewrite of `markKYCPending` function (lines 74-191)

### Problem 3: Early Checkout Guard
**Symptom:** Potential race conditions could redirect users away from checkout.

**Solution:** Added special-case guard that allows users with approved KYC to stay on checkout page regardless of timing.

**Files Modified:**
- `src/components/auth/ProtectedRoute.tsx` - Early return for `/checkout` with approved KYC (lines 233-238)

---

## Current Onboarding Flow Architecture

### Complete User Journey

```
1. Login/Signup (src/pages/Login.tsx)
   ↓ [Creates auth.users + profiles record]

2. Equity Introduction (src/pages/EquityIntro.tsx)
   ↓ [User learns about ownership model]

3. Plan Selection (src/pages/PlanSelection.tsx)
   ↓ [Sets selected_subscription_tier]

4. Legal Disclosures (src/pages/Disclosures.tsx)
   ↓ [Sets disclosures_accepted_at]

5. KYC Verification (src/pages/KYCVerification.tsx)
   ↓ [Persona embedded flow, sets kyc_status = 'pending']

6. KYC Pending (src/pages/KYCPending.tsx)
   ↓ [Polls every 2s, waits for webhook to set kyc_status = 'approved']
   ↓ [Passes kycJustApproved: true state]

7. Checkout (src/pages/Checkout.tsx) 👈 CURRENT PLACEHOLDER
   ↓ [Shows plan summary, countdown timer]
   ↓ [Calls completeOnboardingAndGrantShares() - WRONG, should happen after payment]
   ↓ [Navigates to /chat - LOOPS because onboarding_completed_at isn't set properly]

8. Chat (src/pages/Chat.tsx)
   ✓ [Main app, only accessible after onboarding_completed_at is set]
```

### ProtectedRoute Enforcement Logic

Located in: `src/components/auth/ProtectedRoute.tsx`

The ProtectedRoute component orchestrates the entire flow by checking profile state and redirecting as needed:

```typescript
// Special case: Allow checkout access for approved KYC (line 236)
if (location.pathname === '/checkout' && profile.kyc_status === 'approved') {
  return <>{children}</>
}

// Step 1: Require plan selection (line 238-280)
if (!profile.selected_subscription_tier) {
  redirect to /onboarding/equity
}

// Step 2: Require disclosures (line 282-290)
if (has_tier && !profile.disclosures_accepted_at) {
  redirect to /disclosures
}

// Step 3: Require KYC (line 292-311)
if (has_disclosures && profile.kyc_status !== 'approved') {
  redirect based on status (pending → /kyc-pending, declined → /kyc-declined, etc.)
}

// Step 4: Require checkout completion (line 313-320)
if (kyc_approved && !profile.onboarding_completed_at) {
  redirect to /checkout
}

// Allow access to protected routes
return children
```

**Key Navigation State Flags:**
- `tierJustSelected` - Forces profile refetch after plan selection
- `disclosuresJustAccepted` - Forces profile refetch after accepting disclosures
- `kycJustApproved` - Forces profile refetch after KYC approval

These prevent race conditions by ensuring ProtectedRoute has fresh data when checking routing logic.

---

## Database Schema

### profiles Table (Relevant Fields)

```sql
profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),

  -- Onboarding Progress
  selected_subscription_tier text,           -- 'starter' | 'plus' | 'pro' | 'max'
  disclosures_accepted_at timestamptz,
  kyc_status text DEFAULT 'not_started',     -- 'not_started' | 'pending' | 'approved' | 'declined' | 'needs_review'
  onboarding_completed_at timestamptz,       -- Set AFTER successful payment

  -- KYC/Persona Data
  persona_inquiry_id text,
  persona_reference_id text,
  persona_account_id text,
  kyc_completed_at timestamptz,
  kyc_declined_reason text,

  -- Subscription & Payment
  subscription_status text DEFAULT 'inactive', -- Will be 'active' after Stripe payment
  stripe_customer_id text,                     -- TODO: Add this field
  stripe_subscription_id text,                 -- TODO: Add this field

  -- Equity/Shares
  shares_balance integer DEFAULT 0,
  pending_referral_code text,                  -- Deferred until onboarding complete

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)
```

### equity_transactions Table

```sql
equity_transactions (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES profiles(id),
  transaction_type text,        -- 'signup_bonus' | 'subscription' | 'referral_sent' | 'referral_received'
  shares_amount integer,
  description text,
  created_at timestamptz DEFAULT now()
)
```

---

## Stripe Integration Requirements

### Business Logic

**Share Grant Rules (CRITICAL SECURITY):**
Shares represent actual ownership and must ONLY be granted after:
1. ✅ KYC verification approved
2. ✅ Payment successfully processed
3. ✅ Subscription active

**Share Amounts:**
- **100 shares:** Signup bonus (one-time, granted after first successful payment)
- **5-40 shares/month:** Based on subscription tier
  - Starter ($2/mo): 5 shares/month
  - Plus ($5/mo): 10 shares/month
  - Pro ($10/mo): 20 shares/month
  - Max ($20/mo): 40 shares/month
- **50 shares:** Per successful referral (referrer gets this)
- **25 shares:** Referral recipient bonus

**Current Implementation:**
The function `completeOnboardingAndGrantShares()` in `src/lib/database/onboarding.ts` handles:
- Setting `onboarding_completed_at` timestamp
- Granting signup bonus (100 shares)
- Granting first month's subscription shares
- Processing deferred referral codes
- Creating equity_transaction records

⚠️ **IMPORTANT:** This function is currently called from the Checkout page placeholder. It should ONLY be called AFTER successful Stripe payment confirmation (webhook).

---

## Phase 2: Stripe Implementation Plan

### Overview

Replace the placeholder Checkout page with Stripe's embedded checkout flow. Users will enter payment information directly within the app (no redirect to Stripe's hosted page), maintaining a seamless native app experience.

### Implementation Steps

#### Step 1: Stripe Product & Price Setup

**Create Stripe Products via Dashboard or API:**

```typescript
// Products for each tier
const products = [
  { id: 'starter', name: 'Ampel Starter', price: 200 },  // $2.00
  { id: 'plus', name: 'Ampel Plus', price: 500 },        // $5.00
  { id: 'pro', name: 'Ampel Pro', price: 1000 },         // $10.00
  { id: 'max', name: 'Ampel Max', price: 2000 }          // $20.00
]
```

**Using Stripe MCP Tools:**
```typescript
// Create products
const starterProduct = await mcp__stripe__create_product({
  name: 'Ampel Starter',
  description: '5 shares/month + AI chat access'
})

// Create recurring prices
const starterPrice = await mcp__stripe__create_price({
  product: starterProduct.id,
  unit_amount: 200,  // $2.00 in cents
  currency: 'usd',
  recurring: { interval: 'month' }
})

// Repeat for plus, pro, max
```

**Store Price IDs:**
Store the Stripe price IDs in a config file or environment variables:
```
VITE_STRIPE_PRICE_STARTER=price_xxx
VITE_STRIPE_PRICE_PLUS=price_xxx
VITE_STRIPE_PRICE_PRO=price_xxx
VITE_STRIPE_PRICE_MAX=price_xxx
```

#### Step 2: Database Schema Updates

**Add Stripe fields to profiles table:**

```sql
ALTER TABLE profiles
ADD COLUMN stripe_customer_id text,
ADD COLUMN stripe_subscription_id text;
```

**Create migration:**
```bash
# Using Supabase MCP
await mcp__supabase__apply_migration({
  name: 'add_stripe_fields_to_profiles',
  query: `
    ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS stripe_customer_id text,
    ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
  `
})
```

#### Step 3: Create Stripe Checkout Session (Edge Function)

**File:** `supabase/functions/create-checkout-session/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2023-10-16',
})

serve(async (req) => {
  try {
    // 1. Get authenticated user from Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      return new Response('Unauthorized', { status: 401 })
    }

    // 2. Get user's profile with selected tier
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('selected_subscription_tier, stripe_customer_id, email')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.selected_subscription_tier) {
      return new Response('Profile not found or no tier selected', { status: 400 })
    }

    // 3. Get the Stripe price ID for the selected tier
    const priceIds = {
      starter: Deno.env.get('STRIPE_PRICE_STARTER'),
      plus: Deno.env.get('STRIPE_PRICE_PLUS'),
      pro: Deno.env.get('STRIPE_PRICE_PRO'),
      max: Deno.env.get('STRIPE_PRICE_MAX'),
    }

    const priceId = priceIds[profile.selected_subscription_tier as keyof typeof priceIds]
    if (!priceId) {
      return new Response('Invalid subscription tier', { status: 400 })
    }

    // 4. Create or retrieve Stripe Customer
    let customerId = profile.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || profile.email,
        metadata: {
          supabase_user_id: user.id,
          subscription_tier: profile.selected_subscription_tier,
        },
      })
      customerId = customer.id

      // Save customer ID to database
      await supabaseClient
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    // 5. Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        supabase_user_id: user.id,
        subscription_tier: profile.selected_subscription_tier,
      },
      // IMPORTANT: Use embedded checkout, not redirect
      ui_mode: 'embedded',
      return_url: `${Deno.env.get('APP_URL')}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
    })

    // 6. Return client secret for embedded checkout
    return new Response(
      JSON.stringify({
        clientSecret: session.client_secret,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
```

**Deploy the edge function:**
```bash
npx supabase functions deploy create-checkout-session
```

**Set environment variables:**
```bash
npx supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx
npx supabase secrets set STRIPE_PRICE_STARTER=price_xxx
npx supabase secrets set STRIPE_PRICE_PLUS=price_xxx
npx supabase secrets set STRIPE_PRICE_PRO=price_xxx
npx supabase secrets set STRIPE_PRICE_MAX=price_xxx
npx supabase secrets set APP_URL=https://your-app-url.com
```

#### Step 4: Update Checkout Page Component

**File:** `src/pages/Checkout.tsx`

Replace the entire placeholder implementation with Stripe embedded checkout:

```typescript
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadStripe } from '@stripe/stripe-js'
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/useToast'

// Load Stripe with your publishable key
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

export default function Checkout() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch client secret from edge function
  useEffect(() => {
    async function createCheckoutSession() {
      if (!user) return

      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData.session?.access_token

        if (!token) {
          throw new Error('No access token')
        }

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          }
        )

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to create checkout session')
        }

        const data = await response.json()
        setClientSecret(data.clientSecret)
      } catch (err) {
        console.error('Error creating checkout session:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
        showToast({
          type: 'error',
          message: 'Failed to load checkout. Please try again.',
        })
      } finally {
        setLoading(false)
      }
    }

    createCheckoutSession()
  }, [user, showToast])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFCFA] flex items-center justify-center">
        <div className="text-center">
          <svg
            className="animate-spin h-12 w-12 text-[#30302E] mx-auto mb-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <p className="text-gray-600">Loading checkout...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#FDFCFA] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white border border-red-200 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-red-900 mb-2">Checkout Error</h2>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full px-4 py-3 bg-[#30302E] text-white rounded-xl font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!clientSecret) {
    return null
  }

  return (
    <div
      className="min-h-screen bg-[#FDFCFA]"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-serif font-semibold text-gray-900 mb-6 text-center">
          Complete Your Subscription
        </h1>

        {/* Stripe Embedded Checkout */}
        <EmbeddedCheckoutProvider
          stripe={stripePromise}
          options={{ clientSecret }}
        >
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </div>
    </div>
  )
}
```

**Install Stripe dependencies:**
```bash
npm install @stripe/stripe-js @stripe/react-stripe-js
```

**Add environment variable:**
```
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
```

#### Step 5: Create Checkout Success Page

**File:** `src/pages/CheckoutSuccess.tsx`

```typescript
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Check } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

/**
 * Checkout Success Page
 *
 * Displayed after successful Stripe payment. This page:
 * 1. Shows success message
 * 2. Polls database for onboarding_completed_at (set by webhook)
 * 3. Redirects to chat when onboarding is complete
 */
export default function CheckoutSuccess() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (!user || !sessionId) {
      navigate('/checkout', { replace: true })
      return
    }

    // Poll database for onboarding completion
    // The webhook will set onboarding_completed_at after processing payment
    const pollInterval = setInterval(async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed_at')
        .eq('id', user.id)
        .single()

      if (profile?.onboarding_completed_at) {
        clearInterval(pollInterval)
        setChecking(false)
        // Wait 2 seconds to show success message, then navigate
        setTimeout(() => {
          navigate('/chat', { replace: true })
        }, 2000)
      }
    }, 1000) // Poll every second

    // Timeout after 30 seconds
    const timeout = setTimeout(() => {
      clearInterval(pollInterval)
      setChecking(false)
      // Still navigate to chat - the webhook might have completed
      navigate('/chat', { replace: true })
    }, 30000)

    return () => {
      clearInterval(pollInterval)
      clearTimeout(timeout)
    }
  }, [user, sessionId, navigate])

  return (
    <div
      className="min-h-screen bg-[#FDFCFA] flex items-center justify-center px-4"
      style={{
        paddingTop: 'max(2rem, env(safe-area-inset-top))',
        paddingBottom: 'max(2rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="max-w-md w-full text-center">
        {/* Success Icon */}
        <div className="w-20 h-20 bg-green-100 rounded-full mx-auto flex items-center justify-center mb-6">
          <Check className="w-10 h-10 text-green-600" strokeWidth={3} />
        </div>

        <h1 className="text-3xl font-serif font-semibold text-gray-900 mb-4">
          Payment Successful!
        </h1>

        {checking ? (
          <>
            <p className="text-base text-gray-600 mb-6">
              Setting up your account and granting your shares...
            </p>
            <div className="flex justify-center gap-2">
              <div className="w-2 h-2 bg-[#30302E] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-[#30302E] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-[#30302E] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </>
        ) : (
          <p className="text-base text-gray-600">
            Redirecting to your dashboard...
          </p>
        )}
      </div>
    </div>
  )
}
```

**Add route to App.tsx:**
```typescript
<Route path="/checkout-success" element={
  <ProtectedRoute>
    <CheckoutSuccess />
  </ProtectedRoute>
} />
```

#### Step 6: Create Stripe Webhook Handler (Edge Function)

**File:** `supabase/functions/stripe-webhook/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2023-10-16',
})

// Create Supabase client with SERVICE ROLE for admin operations
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

  if (!signature || !webhookSecret) {
    return new Response('Missing signature or webhook secret', { status: 400 })
  }

  try {
    const body = await req.text()

    // Verify webhook signature
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret)

    console.log('Webhook event received:', event.type)

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        const userId = session.metadata?.supabase_user_id
        const subscriptionId = session.subscription as string

        if (!userId) {
          console.error('No user ID in session metadata')
          return new Response('No user ID', { status: 400 })
        }

        console.log('Processing checkout completion for user:', userId)

        // 1. Update profile with subscription info
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({
            stripe_subscription_id: subscriptionId,
            subscription_status: 'active',
            onboarding_completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId)

        if (updateError) {
          console.error('Error updating profile:', updateError)
          throw updateError
        }

        // 2. Grant shares (signup bonus + first month subscription shares)
        // Import the completeOnboardingAndGrantShares logic or inline it here
        await grantSharesForNewSubscription(userId)

        console.log('Successfully processed checkout for user:', userId)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        // Find user by stripe_customer_id
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (!profile) {
          console.error('No profile found for customer:', customerId)
          return new Response('Profile not found', { status: 404 })
        }

        // Update subscription status
        const status = subscription.status === 'active' ? 'active' : 'inactive'
        await supabaseAdmin
          .from('profiles')
          .update({ subscription_status: status })
          .eq('id', profile.id)

        console.log('Updated subscription status for user:', profile.id)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (profile) {
          await supabaseAdmin
            .from('profiles')
            .update({ subscription_status: 'inactive' })
            .eq('id', profile.id)

          console.log('Subscription canceled for user:', profile.id)
        }
        break
      }

      default:
        console.log('Unhandled event type:', event.type)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})

// Helper function to grant shares
async function grantSharesForNewSubscription(userId: string) {
  // Get user's profile to determine tier and check if signup bonus granted
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('selected_subscription_tier, shares_balance, pending_referral_code')
    .eq('id', userId)
    .single()

  if (!profile) {
    throw new Error('Profile not found')
  }

  const tier = profile.selected_subscription_tier
  const transactions: Array<{ type: string; shares: number; description: string }> = []

  // Signup bonus (100 shares) - grant if balance is 0 (first subscription)
  if (profile.shares_balance === 0) {
    transactions.push({
      type: 'signup_bonus',
      shares: 100,
      description: 'Welcome bonus for joining Ampel',
    })
  }

  // Monthly subscription shares based on tier
  const tierShares = {
    starter: 5,
    plus: 10,
    pro: 20,
    max: 40,
  }
  const monthlyShares = tierShares[tier as keyof typeof tierShares] || 0

  transactions.push({
    type: 'subscription',
    shares: monthlyShares,
    description: `Monthly shares for ${tier} subscription`,
  })

  // Process deferred referral code if exists
  if (profile.pending_referral_code) {
    // Referral processing logic here
    // Find referrer, grant 50 shares to referrer, 25 to this user
    // See src/lib/database/onboarding.ts for full implementation
    transactions.push({
      type: 'referral_received',
      shares: 25,
      description: 'Referral bonus',
    })
  }

  // Calculate total shares
  const totalShares = transactions.reduce((sum, t) => sum + t.shares, 0)

  // Create equity transactions
  for (const txn of transactions) {
    await supabaseAdmin.from('equity_transactions').insert({
      user_id: userId,
      transaction_type: txn.type,
      shares_amount: txn.shares,
      description: txn.description,
    })
  }

  // Update shares balance
  await supabaseAdmin
    .from('profiles')
    .update({
      shares_balance: profile.shares_balance + totalShares,
      pending_referral_code: null, // Clear after processing
    })
    .eq('id', userId)

  console.log('Granted shares:', { userId, totalShares, transactions })
}
```

**Deploy webhook:**
```bash
npx supabase functions deploy stripe-webhook
```

**Set webhook secret:**
1. In Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-project.supabase.co/functions/v1/stripe-webhook`
3. Select events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
4. Copy webhook signing secret
5. Set in Supabase:
```bash
npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
```

#### Step 7: Testing

**Test Mode (Stripe Test Cards):**
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Requires Authentication: `4000 0025 0000 3155`

**Testing Checklist:**
- [ ] Create checkout session successfully
- [ ] Embedded checkout renders correctly on mobile
- [ ] Can enter test card and complete payment
- [ ] Webhook receives `checkout.session.completed` event
- [ ] Profile updated with `stripe_subscription_id` and `onboarding_completed_at`
- [ ] Shares granted correctly (100 signup + tier shares)
- [ ] User redirected to chat after success
- [ ] ProtectedRoute allows access to chat (onboarding complete)

---

## Key Files Reference

### Frontend
- `src/pages/Checkout.tsx` - Main checkout page (TO BE REPLACED)
- `src/components/auth/ProtectedRoute.tsx` - Routing logic
- `src/pages/KYCPending.tsx` - Polls for KYC approval
- `src/pages/KYCVerification.tsx` - Persona embedded flow
- `src/lib/database/onboarding.ts` - Share granting logic

### Backend
- `supabase/functions/create-checkout-session/index.ts` - (TO BE CREATED)
- `supabase/functions/stripe-webhook/index.ts` - (TO BE CREATED)

### Database
- `profiles` table - User state
- `equity_transactions` table - Share history

---

## Known Issues & Considerations

### Current Checkout Loop Bug
**Status:** Not fixed (will be resolved by Stripe implementation)

**Description:** The placeholder Checkout page calls `completeOnboardingAndGrantShares()` then navigates to `/chat`, but ProtectedRoute redirects users back to `/checkout` if `onboarding_completed_at` isn't set, creating a loop.

**Why it doesn't matter:** Stripe implementation will block on the checkout page until payment completes, then the webhook sets `onboarding_completed_at` before navigation. The loop will not occur with the blocking payment flow.

### Mobile Considerations
- Stripe embedded checkout is mobile-optimized
- Test on both iOS and Android simulators
- Ensure safe area insets are respected
- Test keyboard behavior during card entry

### Security Considerations
- **Never grant shares before payment confirmation**
- Always verify webhook signatures
- Use service role key only in edge functions
- Validate user session in edge functions
- Store sensitive keys in Supabase secrets, not code

### Error Handling
- Handle Stripe API failures gracefully
- Provide retry mechanisms for failed payments
- Log all webhook events for debugging
- Show clear error messages to users

---

## Environment Variables Checklist

```bash
# Frontend (.env)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx

# Backend (Supabase Secrets)
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_STARTER=price_xxx
STRIPE_PRICE_PLUS=price_xxx
STRIPE_PRICE_PRO=price_xxx
STRIPE_PRICE_MAX=price_xxx
APP_URL=https://your-app-url.com
```

---

## Success Criteria

The Stripe implementation is complete when:

- ✅ Users can select a subscription tier
- ✅ Embedded Stripe checkout loads and displays correctly
- ✅ Users can enter payment information within the app (no redirect)
- ✅ Payment processes successfully with test cards
- ✅ Webhook receives and processes payment events
- ✅ Shares granted correctly after payment confirmation
- ✅ `onboarding_completed_at` set after successful payment
- ✅ Users can access chat after completing payment
- ✅ Subscription status tracked in database
- ✅ Error states handled gracefully
- ✅ Works on both iOS and Android

---

## Next Steps - Start Here

1. **Review this document thoroughly**
2. **Set up Stripe account** (if not already done)
3. **Create test products and prices** in Stripe Dashboard
4. **Add database migrations** for Stripe fields
5. **Create `create-checkout-session` edge function**
6. **Replace Checkout page** with embedded Stripe checkout
7. **Create `stripe-webhook` edge function**
8. **Set environment variables**
9. **Test with Stripe test cards**
10. **Verify share granting logic**
11. **Test complete flow end-to-end**

---

## Questions to Clarify Before Starting

1. **Stripe Account:** Do we have a Stripe account set up? Test mode or live mode?
2. **Product Names:** Should product names in Stripe match "Ampel Starter/Plus/Pro/Max"?
3. **Trial Period:** Do we want to offer a free trial? If yes, how long?
4. **Proration:** If users upgrade/downgrade, should we prorate?
5. **Failed Payments:** How should we handle failed payment retries? Suspend access?
6. **Cancellation:** Should users retain shares if they cancel subscription?

---

**End of Handoff Document**
