import { useState, useEffect } from 'react'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { streamChatResponse, getErrorMessage } from '@/lib/ai'
import { updateConversationTitle } from '@/lib/database/conversations'
import {
  saveMessage,
  loadMessages,
  convertDbMessagesToFrontend,
} from '@/lib/database/messages'
import { generateConversationTitle } from '@/lib/ai/titles'
import type { Message, StreamingStatus } from '@/types/chat'

interface ChatInterfaceProps {
  conversationId: string | null
  onTitleGenerated?: () => void
}

/**
 * Main chat interface component
 * Manages message state, streaming, AI configuration toggles, and persistence
 */
export function ChatInterface({
  conversationId,
  onTitleGenerated,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [reasoning, setReasoning] = useState(false)
  const [webSearch, setWebSearch] = useState(false)
  const [streamingStatus, setStreamingStatus] = useState<StreamingStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  // Load messages when conversationId changes
  useEffect(() => {
    async function loadConversationMessages() {
      if (!conversationId) {
        // No conversation selected, show empty state
        setMessages([])
        setIsLoadingHistory(false)
        return
      }

      try {
        setIsLoadingHistory(true)
        const dbMessages = await loadMessages(conversationId)
        const frontendMessages = convertDbMessagesToFrontend(dbMessages)
        setMessages(frontendMessages)
      } catch (err) {
        console.error('Error loading messages:', err)
        setMessages([])
      } finally {
        setIsLoadingHistory(false)
      }
    }

    loadConversationMessages()
  }, [conversationId])

  const handleSendMessage = async (content: string) => {
    // Conversation must exist before sending messages
    if (!conversationId) {
      setError('No conversation selected')
      return
    }

    // Clear any previous errors
    setError(null)

    // Check if this is the first message (for title generation)
    const isFirstMessage = messages.length === 0

    try {

      // Add user message to UI immediately (optimistic update)
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, userMessage])

      // Save user message to database (don't await - background operation)
      saveMessage(conversationId, 'user', content, null).catch((err) => {
        console.error('Failed to save user message:', err)
        // Don't show error to user - message is already displayed
      })

      // Generate conversation title if this is the first message
      if (isFirstMessage) {
        generateConversationTitle(content)
          .then((title) => {
            return updateConversationTitle(conversationId, title)
          })
          .then(() => {
            // Notify parent that title was generated
            onTitleGenerated?.()
          })
          .catch((err) => {
            console.error('Failed to generate/save conversation title:', err)
            // Don't show error to user - title generation is a background task
          })
      }

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
      saveMessage(conversationId, 'assistant', fullContent, tokens).catch(
        (err) => {
          console.error('Failed to save assistant message:', err)
          // Don't show error to user - message is already displayed
        }
      )
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

      {/* Input area with integrated controls */}
      <ChatInput
        onSend={handleSendMessage}
        disabled={streamingStatus !== 'idle' || isLoadingHistory}
        reasoning={reasoning}
        webSearch={webSearch}
        onReasoningToggle={() => setReasoning(!reasoning)}
        onWebSearchToggle={() => setWebSearch(!webSearch)}
        autoFocus={messages.length === 0}
        placeholder={messages.length === 0 ? 'How can I help?' : 'Type a message...'}
      />
    </div>
  )
}
