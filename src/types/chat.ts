/**
 * Message type definitions for chat interface
 */

export type MessageRole = 'user' | 'assistant'

export interface Message {
  id: string
  role: MessageRole
  content: string
  timestamp: Date
  isStreaming?: boolean // Indicates if message is currently being streamed
  tokenCount?: number // Token usage for this message (from LLM API)
  citations?: string[] // Source URLs from web search (only for assistant messages)
}

export type StreamingStatus = 'idle' | 'loading' | 'streaming' | 'error'
