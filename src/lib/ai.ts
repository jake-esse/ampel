import { supabase } from './supabase'
import type { Message } from '@/types/chat'

/**
 * AI client for streaming chat responses from xAI Grok models
 * via Supabase Edge Function
 */

interface StreamChatOptions {
  messages: Message[]
  reasoning: boolean
  webSearch: boolean
}

export interface StreamChatResult {
  textStream: AsyncGenerator<string, void, unknown>
  tokenUsage: Promise<number | null>
  citations: Promise<string[]>
}

/**
 * Stream chat response from xAI API via Supabase Edge Function
 * Returns an object with the text stream and token usage
 */
export function streamChatResponse(
  options: StreamChatOptions
): StreamChatResult {
  const { messages, reasoning, webSearch } = options

  // Store token usage and citations from the stream
  let resolveTokens: (tokens: number | null) => void
  const tokenUsagePromise = new Promise<number | null>((resolve) => {
    resolveTokens = resolve
  })

  let resolveCitations: (citations: string[]) => void
  const citationsPromise = new Promise<string[]>((resolve) => {
    resolveCitations = resolve
  })

  // Create the async generator for streaming text
  async function* generateStream(): AsyncGenerator<string, void, unknown> {
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

      // Call Edge Function with streaming
      const response = await fetch(`${supabaseUrl}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          reasoning,
          webSearch,
        }),
      })

      if (!response.ok) {
        // Handle HTTP errors
        const errorText = await response.text()
        let errorMessage = 'Failed to get AI response'

        try {
          const errorJson = JSON.parse(errorText)
          errorMessage = errorJson.error || errorMessage
        } catch {
          // Error response wasn't JSON, use default message
        }

        if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.')
        } else if (response.status === 429) {
          throw new Error(
            'Too many requests. Please wait a moment and try again.'
          )
        } else if (response.status >= 500) {
          throw new Error('Server error. Please try again later.')
        } else {
          throw new Error(errorMessage)
        }
      }

      // Stream the response body
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response body')
      }

      try {
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            break
          }

          // Decode the chunk
          const text = decoder.decode(value, { stream: true })
          buffer += text

          // Check if buffer contains the token marker
          const tokenMarkerIndex = buffer.indexOf('\n\n__TOKENS__:')

          if (tokenMarkerIndex !== -1) {
            // Extract text before marker
            const textContent = buffer.substring(0, tokenMarkerIndex)
            if (textContent) {
              yield textContent
            }

            // Extract markers content (everything after __TOKENS__:)
            const markerStart = tokenMarkerIndex + '\n\n__TOKENS__:'.length
            const markersContent = buffer.substring(markerStart)

            // Check if citations marker exists
            const citationsMarkerIndex = markersContent.indexOf('__CITATIONS__:')

            if (citationsMarkerIndex !== -1) {
              // Extract token count (before citations marker)
              const tokenStr = markersContent.substring(0, citationsMarkerIndex)
              const tokenCount = parseInt(tokenStr, 10)

              if (!isNaN(tokenCount)) {
                resolveTokens(tokenCount)
              } else {
                resolveTokens(null)
              }

              // Extract and parse citations JSON
              const citationsStart = citationsMarkerIndex + '__CITATIONS__:'.length
              const citationsJson = markersContent.substring(citationsStart)

              try {
                const citations = JSON.parse(citationsJson)
                if (Array.isArray(citations)) {
                  resolveCitations(citations)
                } else {
                  resolveCitations([])
                }
              } catch (error) {
                console.error('Failed to parse citations:', error)
                resolveCitations([])
              }
            } else {
              // No citations marker, just token count
              const tokenStr = markersContent
              const tokenCount = parseInt(tokenStr, 10)

              if (!isNaN(tokenCount)) {
                resolveTokens(tokenCount)
              } else {
                resolveTokens(null)
              }

              resolveCitations([])
            }

            buffer = ''
            break
          } else {
            // Yield accumulated text (keep last part in buffer in case it's partial marker)
            const safeLength = Math.max(0, buffer.length - 20) // Keep last 20 chars in buffer
            if (safeLength > 0) {
              const textToYield = buffer.substring(0, safeLength)
              yield textToYield
              buffer = buffer.substring(safeLength)
            }
          }
        }

        // Yield any remaining buffer (shouldn't happen normally)
        if (buffer) {
          yield buffer
        }

        // If we never found a token marker, resolve with null/empty
        if (resolveTokens) {
          resolveTokens(null)
        }
        if (resolveCitations) {
          resolveCitations([])
        }
      } finally {
        reader.releaseLock()
      }
    } catch (error) {
      // Resolve tokens and citations with null/empty on error
      resolveTokens(null)
      resolveCitations([])

      // Re-throw with user-friendly message
      if (error instanceof Error) {
        throw error
      } else {
        throw new Error('An unexpected error occurred')
      }
    }
  }

  return {
    textStream: generateStream(),
    tokenUsage: tokenUsagePromise,
    citations: citationsPromise,
  }
}

/**
 * Get user-friendly error message from error object
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return 'An unexpected error occurred'
}
