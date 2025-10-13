import { supabase } from '../supabase'

/**
 * Generate a short, descriptive title for a conversation
 * using the user's first message
 * @param firstMessage - The first user message in the conversation
 * @returns A 5-word or less title describing the conversation
 */
export async function generateConversationTitle(
  firstMessage: string
): Promise<string> {
  try {
    // Get current user session for auth
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      throw new Error('Not authenticated')
    }

    // Get Supabase URL from environment
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    if (!supabaseUrl) {
      throw new Error('Supabase URL not configured')
    }

    // Truncate first message if too long (avoid huge prompts)
    const truncatedMessage = firstMessage.slice(0, 200)

    // Call Edge Function to generate title
    const response = await fetch(`${supabaseUrl}/functions/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content:
              'You are a title generator. Generate short, descriptive titles for conversations. Respond with only the title text, maximum 5 words, no quotes, no punctuation.',
          },
          {
            role: 'user',
            content: `Generate a title for a conversation that starts with: "${truncatedMessage}"`,
          },
        ],
        reasoning: false,
        webSearch: false,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    // Read the streamed response
    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      throw new Error('No response body')
    }

    let fullText = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value, { stream: true })
        // Stop if we hit the token marker
        if (text.includes('__TOKENS__')) {
          const beforeMarker = text.split('__TOKENS__')[0]
          fullText += beforeMarker
          break
        }
        fullText += text
      }
    } finally {
      reader.releaseLock()
    }

    // Clean up the title
    let title = fullText.trim()

    // Remove quotes if present
    title = title.replace(/^["']|["']$/g, '')

    // Truncate to 5 words maximum
    const words = title.split(/\s+/)
    if (words.length > 5) {
      title = words.slice(0, 5).join(' ')
    }

    // Fallback if title is empty or too short
    if (!title || title.length < 3) {
      return 'New Chat'
    }

    // Limit to 50 characters (database constraint)
    if (title.length > 50) {
      title = title.slice(0, 47) + '...'
    }

    return title
  } catch (error) {
    console.error('Error generating conversation title:', error)
    // Fallback to a safe default
    return 'New Chat'
  }
}
