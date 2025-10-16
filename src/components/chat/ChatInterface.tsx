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
import { streamConversationTitle } from '@/lib/ai/streaming-titles'
import { useKeyboard } from '@/hooks/useKeyboard'
import { useToast } from '@/hooks/useToast'
import type { Message, StreamingStatus } from '@/types/chat'

interface ChatInterfaceProps {
  conversationId: string | null
  onTitleStreaming?: (partialTitle: string) => void
  onTitleComplete?: (finalTitle: string) => void
}

/**
 * Main chat interface component
 * Manages message state, streaming, AI configuration toggles, and persistence
 */
export function ChatInterface({
  conversationId,
  onTitleStreaming,
  onTitleComplete,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [reasoning, setReasoning] = useState(false)
  const [webSearch, setWebSearch] = useState(false)
  const [streamingStatus, setStreamingStatus] = useState<StreamingStatus>('idle')

  // Keyboard handling for smooth layout adjustment
  const { isVisible: keyboardVisible, keyboardHeight } = useKeyboard()

  // Toast notifications for errors
  const { showToast } = useToast()

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
      showToast({
        type: 'error',
        message: 'No conversation selected'
      })
      return
    }

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

      // Generate conversation title if this is the first message (with streaming)
      if (isFirstMessage) {
        // Run title generation in background
        ;(async () => {
          try {
            let accumulatedTitle = ''

            // Stream title generation
            for await (const token of streamConversationTitle(content)) {
              accumulatedTitle += token
              // Notify parent of streaming progress
              onTitleStreaming?.(accumulatedTitle)
            }

            // At this point, accumulatedTitle contains the final cleaned title
            const finalTitle = accumulatedTitle

            // Save final title to database
            await updateConversationTitle(conversationId, finalTitle)

            // Notify parent of completion
            onTitleComplete?.(finalTitle)
          } catch (err) {
            console.error('Failed to generate/save conversation title:', err)
            // Fallback to default title
            const fallbackTitle = 'New Chat'
            await updateConversationTitle(conversationId, fallbackTitle)
            onTitleComplete?.(fallbackTitle)
          }
        })()
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

      // Show error toast
      showToast({
        type: 'error',
        message: errorMsg
      })

      setStreamingStatus('error')

      // Remove the placeholder message on error
      setMessages((prev) =>
        prev.filter((msg) => !msg.isStreaming)
      )
    }
  }

  return (
    <div
      className="flex flex-col h-full"
      style={{
        // Reduce available height when keyboard is open
        paddingBottom: `${keyboardHeight}px`,
        // Smooth transition matching iOS native keyboard timing
        transition: 'padding-bottom 0.25s ease-out',
      }}
    >
      {/* Message list */}
      <MessageList messages={messages} keyboardVisible={keyboardVisible} />

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
