// Database types will be generated from Supabase
export type Profile = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  auth_provider: 'email' | 'apple' | 'google'
  created_at: string
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
  created_at: string
}

export type DeveloperWaitlist = {
  id: string
  email: string
  created_at: string
}
