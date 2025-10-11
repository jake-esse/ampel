import { useState, useEffect } from 'react'
import { Brain, Globe } from 'lucide-react'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { streamChatResponse, getErrorMessage } from '@/lib/ai'
import { createConversation } from '@/lib/database/conversations'
import { saveMessage } from '@/lib/database/messages'
import { supabase } from '@/lib/supabase'
import type { Message, StreamingStatus } from '@/types/chat'
import { cn } from '@/lib/utils'

/**
 * Main chat interface component
 * Manages message state, streaming, AI configuration toggles, and persistence
 */
export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [reasoning, setReasoning] = useState(false)
  const [webSearch, setWebSearch] = useState(false)
  const [streamingStatus, setStreamingStatus] = useState<StreamingStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  // Load conversation history on mount
  useEffect(() => {
    async function loadConversationHistory() {
      try {
        // Get current user
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          setIsLoadingHistory(false)
          return
        }

        // For now, we start with a fresh conversation
        // In Phase 4, we'll load the most recent conversation or let user select
        setIsLoadingHistory(false)
      } catch (err) {
        console.error('Error loading conversation history:', err)
        setIsLoadingHistory(false)
      }
    }

    loadConversationHistory()
  }, [])

  const handleSendMessage = async (content: string) => {
    // Clear any previous errors
    setError(null)

    try {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError('You must be logged in to send messages')
        return
      }

      // Create conversation if this is the first message
      let currentConversationId = conversationId
      if (!currentConversationId) {
        const conversation = await createConversation(user.id)
        currentConversationId = conversation.id
        setConversationId(currentConversationId)
      }

      // Add user message to UI immediately (optimistic update)
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, userMessage])

      // Save user message to database (don't await - background operation)
      saveMessage(currentConversationId, 'user', content, null).catch((err) => {
        console.error('Failed to save user message:', err)
        // Don't show error to user - message is already displayed
      })

      // Create placeholder for assistant message
      const assistantMessageId = (Date.now() + 1).toString()
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      }
      setMessages((prev) => [...prev, assistantMessage])

      // Set streaming status
      setStreamingStatus('loading')

      // Stream response from AI
      const { textStream, tokenUsage } = streamChatResponse({
        messages: [...messages, userMessage],
        reasoning,
        webSearch,
      })

      let fullContent = ''
      let isFirstChunk = true

      for await (const token of textStream) {
        if (isFirstChunk) {
          setStreamingStatus('streaming')
          isFirstChunk = false
        }

        fullContent += token

        // Update the assistant message with accumulated content
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: fullContent }
              : msg
          )
        )
      }

      // Mark streaming as complete
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, isStreaming: false, timestamp: new Date() }
            : msg
        )
      )

      setStreamingStatus('idle')

      // Get token usage and save assistant message to database
      const tokens = await tokenUsage
      saveMessage(
        currentConversationId,
        'assistant',
        fullContent,
        tokens
      ).catch((err) => {
        console.error('Failed to save assistant message:', err)
        // Don't show error to user - message is already displayed
      })
    } catch (err) {
      console.error('Streaming error:', err)
      const errorMsg = getErrorMessage(err)
      setError(errorMsg)
      setStreamingStatus('error')

      // Remove the placeholder message on error
      setMessages((prev) =>
        prev.filter((msg) => !msg.isStreaming)
      )
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Controls toolbar */}
      <div className="border-b border-gray-800 bg-gray-900 px-4 py-3">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          {/* Reasoning toggle */}
          <button
            onClick={() => setReasoning(!reasoning)}
            disabled={streamingStatus !== 'idle'}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-full transition-all',
              'text-sm font-medium',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              reasoning
                ? 'bg-primary-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            )}
            aria-label="Toggle reasoning mode"
          >
            <Brain className="w-4 h-4" />
            <span>Reasoning</span>
          </button>

          {/* Web search toggle */}
          <button
            onClick={() => setWebSearch(!webSearch)}
            disabled={streamingStatus !== 'idle'}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-full transition-all',
              'text-sm font-medium',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              webSearch
                ? 'bg-primary-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            )}
            aria-label="Toggle web search"
          >
            <Globe className="w-4 h-4" />
            <span>Web Search</span>
          </button>

          {/* Status indicator */}
          {streamingStatus === 'streaming' && (
            <span className="text-xs text-gray-500 ml-auto">AI is responding...</span>
          )}
          {streamingStatus === 'loading' && (
            <span className="text-xs text-gray-500 ml-auto">Loading...</span>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-900/20 border-b border-red-900 px-4 py-3">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <p className="text-sm text-red-400">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-300 text-sm font-medium"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Message list */}
      <MessageList messages={messages} />

      {/* Input area */}
      <ChatInput
        onSend={handleSendMessage}
        disabled={streamingStatus !== 'idle' || isLoadingHistory}
      />
    </div>
  )
}
