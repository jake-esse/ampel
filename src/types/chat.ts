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
}

export type StreamingStatus = 'idle' | 'loading' | 'streaming' | 'error'
