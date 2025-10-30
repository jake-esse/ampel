import { useState, useEffect, useCallback, useRef } from 'react'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { streamChatResponse, getErrorMessage } from '@/lib/ai'
import { createConversation, updateConversationTitle } from '@/lib/database/conversations'
import {
  saveMessage,
  loadMessages,
  convertDbMessagesToFrontend,
} from '@/lib/database/messages'
import { streamConversationTitle } from '@/lib/ai/streaming-titles'
import { useToast } from '@/hooks/useToast'
import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { useConversations } from '@/hooks/useConversations'
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

  // Toast notifications for errors
  const { showToast } = useToast()

  // Get user and navigation for creating new conversations
  const { user } = useAuth()
  const navigate = useNavigate()
  const { addConversation } = useConversations()

  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true)

  // Track component lifecycle and manage mounted state
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

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

  // Internal function to send message to AI (defined before useEffect that uses it)
  const sendMessageToAI = useCallback(async (
    activeConversationId: string,
    content: string,
    currentMessages?: Message[]  // Optional parameter to pass current messages
  ) => {
    // Check if component is still mounted
    if (!isMountedRef.current) {
      return
    }

    // Use passed messages or fall back to state (for direct calls)
    // When currentMessages is explicitly passed (including empty array), use it
    // Otherwise use messages from state
    const messagesToUse = currentMessages !== undefined ? currentMessages : messages

    // Check if this is the first message (for title generation)
    const isFirstMessage = messagesToUse.length === 0

    try {
      // Add user message to UI immediately (optimistic update)
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content,
        timestamp: new Date(),
      }

      // Check mounted before state update
      if (!isMountedRef.current) {
        return
      }

      setMessages((prev) => [...prev, userMessage])

      // Save user message to database (don't await - background operation)
      saveMessage(activeConversationId, 'user', content, null).catch((err) => {
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
            await updateConversationTitle(activeConversationId, finalTitle)

            // Notify parent of completion
            onTitleComplete?.(finalTitle)
          } catch (err) {
            console.error('Failed to generate/save conversation title:', err)
            // Fallback to default title
            const fallbackTitle = 'New Chat'
            await updateConversationTitle(activeConversationId, fallbackTitle)
            onTitleComplete?.(fallbackTitle)
          }
        })()
      }

      // Check mounted before adding assistant message
      if (!isMountedRef.current) {
        return
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

      // Stream response from AI - use the messages we determined above
      const { textStream, tokenUsage, citations } = streamChatResponse({
        messages: [...messagesToUse, userMessage],
        reasoning,
        webSearch,
      })

      let fullContent = ''
      let isFirstChunk = true

      for await (const token of textStream) {
        // Check if component is still mounted before updating state
        if (!isMountedRef.current) {
          break
        }

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

      // Check mounted before final updates
      if (!isMountedRef.current) {
        return
      }

      // Get token usage and citations
      const tokens = await tokenUsage
      const citationUrls = await citations

      // Mark streaming as complete and add citations to message
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                isStreaming: false,
                timestamp: new Date(),
                tokenCount: tokens ?? undefined,
                citations: citationUrls.length > 0 ? citationUrls : undefined,
              }
            : msg
        )
      )

      setStreamingStatus('idle')

      // Save assistant message to database with citations
      saveMessage(
        activeConversationId,
        'assistant',
        fullContent,
        tokens,
        citationUrls.length > 0 ? citationUrls : undefined
      ).catch((err) => {
        console.error('Failed to save assistant message:', err)
        // Don't show error to user - message is already displayed
      })
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
  }, [messages, reasoning, webSearch, onTitleStreaming, onTitleComplete, showToast])

  // Handle sending a message (creates conversation if needed)
  const handleSendMessage = async (content: string) => {
    // If conversation already exists, send directly
    if (conversationId) {
      // Don't pass messages parameter here - let it use the current state
      await sendMessageToAI(conversationId, content)
      return
    }

    // No conversation exists, create one first
    if (!user) {
      showToast({
        type: 'error',
        message: 'You must be logged in to start a conversation'
      })
      return
    }

    try {
      // Create a new conversation
      const newConversation = await createConversation(user.id)

      // Add to context for real-time updates
      addConversation(newConversation)

      // CRITICAL FIX: Send the message IMMEDIATELY after creating conversation
      // This eliminates the race condition with navigation and component remounting
      // The message will be saved to DB and appear when the new route loads
      await sendMessageToAI(newConversation.id, content, [])

      // Navigate to the new conversation URL WITHOUT pending message
      // The message is already being processed, so no need for state passing
      navigate(`/chat/${newConversation.id}`, {
        replace: true
      })
    } catch (err) {
      console.error('Error creating conversation:', err)
      showToast({
        type: 'error',
        message: 'Failed to start a new conversation. Please try again.'
      })
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Message list - takes up available space */}
      <MessageList messages={messages} />

      {/* Input area - now position: fixed, floats above content */}
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