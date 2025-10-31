// Database types will be generated from Supabase
export type Profile = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  auth_provider: 'apple' | 'google'
  created_at: string
  disclosures_accepted_at: string | null
  kyc_status: 'not_started' | 'pending' | 'approved' | 'declined' | 'needs_review'
  kyc_completed_at: string | null
  kyc_declined_reason: string | null
  persona_inquiry_id: string | null
  persona_account_id: string | null
  persona_reference_id: string | null
  updated_at: string
  // Subscription and equity fields
  selected_subscription_tier: 'starter' | 'plus' | 'pro' | 'max' | null
  subscription_status: 'inactive' | 'active' | 'cancelled' | 'past_due'
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  shares_balance: number
  referral_code: string
  referred_by: string | null
  referral_code_used: string | null
  onboarding_completed_at: string | null
}

export type Conversation = {
  id: string
  user_id: string
  title: string
  created_at: string
  updated_at: string
}

export type Message = {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  tokens_used: number | null
  citations: string[] | null
  created_at: string
}

export type DeveloperWaitlist = {
  id: string
  email: string
  created_at: string
}

export type EquityTransaction = {
  id: string
  user_id: string
  transaction_type: 'signup' | 'subscription' | 'referral_given' | 'referral_received'
  shares_amount: number
  description: string | null
  metadata: Record<string, any> | null
  created_at: string
}

export type AmpelQuestion = {
  id: string
  user_id: string
  question_text: string
  response_text: string | null
  responded_at: string | null
  responded_by: string | null
  created_at: string
  updated_at: string
}

export type UsageTracking = {
  id: string
  user_id: string
  billing_period_start: string
  billing_period_end: string
  messages_used: number
  web_searches_used: number
  reasoning_queries_used: number
  effective_tier: 'starter' | 'plus' | 'pro' | 'max' | null
  last_reset_at: string | null
  created_at: string
  updated_at: string
}
