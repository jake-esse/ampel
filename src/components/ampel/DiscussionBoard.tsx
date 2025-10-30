import { useState, useEffect } from 'react'
import { X, MessageCircle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { impact } from '@/hooks/useHaptics'
import { useKeyboardAnimation } from '@/hooks/useKeyboardAnimation'
import { supabase } from '@/lib/supabase'
import {
  createQuestion,
  listQuestions,
  respondToQuestion,
  isAdmin,
} from '@/lib/database/ampel-questions'
import type { AmpelQuestion } from '@/types/database'

/**
 * Props for the DiscussionBoard component
 */
interface DiscussionBoardProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * Discussion Board Modal Component
 *
 * A full-screen modal overlay for the Ampel discussion board.
 * Features:
 * - Users can post questions about Ampel
 * - All users can view questions and responses
 * - Admin can respond to questions
 * - Real-time updates via Supabase subscriptions
 */
export function DiscussionBoard({ isOpen, onClose }: DiscussionBoardProps) {
  const { user } = useAuth()
  const [questions, setQuestions] = useState<AmpelQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [questionInput, setQuestionInput] = useState('')
  const [submittingQuestion, setSubmittingQuestion] = useState(false)
  const [respondingTo, setRespondingTo] = useState<string | null>(null)
  const [responseInputs, setResponseInputs] = useState<Record<string, string>>(
    {}
  )
  const [submittingResponse, setSubmittingResponse] = useState<
    Record<string, boolean>
  >({})
  const [error, setError] = useState<string | null>(null)

  const userIsAdmin = user ? isAdmin(user.id) : false

  // Keyboard animation for input form
  const inputContainerRef = useKeyboardAnimation()

  // Load questions when modal opens
  useEffect(() => {
    if (!isOpen) return

    async function fetchQuestions() {
      try {
        setLoading(true)
        setError(null)
        const data = await listQuestions()
        setQuestions(data)
      } catch (err) {
        console.error('Error fetching questions:', err)
        setError('Failed to load questions. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    fetchQuestions()
  }, [isOpen])

  // Set up real-time subscription for questions
  useEffect(() => {
    if (!isOpen) return

    const subscription = supabase
      .channel('ampel_questions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ampel_questions',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            // New question added
            setQuestions((prev) => [payload.new as AmpelQuestion, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            // Question updated (response added)
            setQuestions((prev) =>
              prev.map((q) =>
                q.id === payload.new.id ? (payload.new as AmpelQuestion) : q
              )
            )
          } else if (payload.eventType === 'DELETE') {
            // Question deleted
            setQuestions((prev) => prev.filter((q) => q.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [isOpen])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const handleClose = () => {
    impact('light')
    onClose()
  }

  const handleSubmitQuestion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !questionInput.trim() || submittingQuestion) return

    setSubmittingQuestion(true)
    setError(null)

    try {
      await createQuestion(user.id, questionInput.trim())
      setQuestionInput('')
      impact('light')
      // Question will appear via real-time subscription
    } catch (err) {
      console.error('Error submitting question:', err)
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to post question. Please try again.'
      )
      impact('medium')
    } finally {
      setSubmittingQuestion(false)
    }
  }

  const handleSubmitResponse = async (questionId: string) => {
    if (!user || !userIsAdmin || !responseInputs[questionId]?.trim()) return

    setSubmittingResponse((prev) => ({ ...prev, [questionId]: true }))
    setError(null)

    try {
      await respondToQuestion(
        questionId,
        responseInputs[questionId].trim(),
        user.id
      )
      setResponseInputs((prev) => {
        const updated = { ...prev }
        delete updated[questionId]
        return updated
      })
      setRespondingTo(null)
      impact('light')
      // Response will appear via real-time subscription
    } catch (err) {
      console.error('Error submitting response:', err)
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to post response. Please try again.'
      )
      impact('medium')
    } finally {
      setSubmittingResponse((prev) => ({ ...prev, [questionId]: false }))
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 animate-in fade-in duration-200"
        onClick={handleClose}
      />

      {/* Modal Container */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div
          className="bg-white w-full h-full flex flex-col pointer-events-auto animate-in fade-in duration-200"
          style={{
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[#E5E3DD] flex-shrink-0">
            <h2 className="text-xl font-semibold text-gray-900">
              Discussion Board
            </h2>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-all duration-150 active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-900" />
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex-shrink-0">
              <p className="text-sm text-red-900">{error}</p>
            </div>
          )}

          {/* Questions List */}
          <div className="flex-1 overflow-y-auto p-4 pb-40">
            {loading ? (
              // Loading skeleton
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="bg-white border border-[#E5E3DD] rounded-xl p-4 animate-pulse"
                  >
                    <div className="h-4 bg-gray-200 rounded w-1/4 mb-2" />
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                  </div>
                ))}
              </div>
            ) : questions.length === 0 ? (
              // Empty state
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageCircle className="w-12 h-12 text-gray-300 mb-3" />
                <p className="text-base text-gray-900 font-medium mb-1">
                  No questions yet
                </p>
                <p className="text-sm text-gray-600">
                  Be the first to ask a question about Ampel
                </p>
              </div>
            ) : (
              // Questions list
              <div className="space-y-3">
                {questions.map((question) => (
                  <div
                    key={question.id}
                    className="bg-white border border-[#E5E3DD] rounded-xl p-4"
                  >
                    {/* Question Header */}
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">
                        Anonymous User
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatTimestamp(question.created_at)}
                      </span>
                    </div>

                    {/* Question Text */}
                    <p className="text-base text-gray-900 mb-3">
                      {question.question_text}
                    </p>

                    {/* Response Section */}
                    {question.response_text ? (
                      <div className="mt-3 pt-3 border-t border-[#E5E3DD]">
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-sm font-medium text-primary-600">
                            Ampel Team
                          </span>
                          {question.responded_at && (
                            <span className="text-xs text-gray-500">
                              {formatTimestamp(question.responded_at)}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700">
                          {question.response_text}
                        </p>
                      </div>
                    ) : userIsAdmin ? (
                      // Admin response form (only if no response exists)
                      respondingTo === question.id ? (
                        <div className="mt-3 pt-3 border-t border-[#E5E3DD]">
                          <textarea
                            value={responseInputs[question.id] || ''}
                            onChange={(e) =>
                              setResponseInputs((prev) => ({
                                ...prev,
                                [question.id]: e.target.value,
                              }))
                            }
                            placeholder="Write your response..."
                            maxLength={1000}
                            rows={3}
                            disabled={submittingResponse[question.id]}
                            className="w-full px-3 py-2 bg-[#F2F1ED] border border-[#E5E3DD] rounded-lg text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-600 resize-none mb-2"
                          />
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">
                              {(responseInputs[question.id] || '').length}/1000
                            </span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setRespondingTo(null)
                                  setResponseInputs((prev) => {
                                    const updated = { ...prev }
                                    delete updated[question.id]
                                    return updated
                                  })
                                }}
                                disabled={submittingResponse[question.id]}
                                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-150 active:scale-95"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSubmitResponse(question.id)}
                                disabled={
                                  !responseInputs[question.id]?.trim() ||
                                  submittingResponse[question.id]
                                }
                                className={`px-3 py-1.5 text-sm rounded-lg transition-all duration-150 ${
                                  responseInputs[question.id]?.trim() &&
                                  !submittingResponse[question.id]
                                    ? 'bg-[#30302E] text-white hover:bg-primary-700 active:scale-95'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                }`}
                              >
                                {submittingResponse[question.id]
                                  ? 'Posting...'
                                  : 'Post Response'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setRespondingTo(question.id)
                            impact('light')
                          }}
                          className="mt-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
                        >
                          Respond
                        </button>
                      )
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Question Input Form (All logged-in users) - Pinned to bottom with keyboard animation */}
          <div
            ref={inputContainerRef}
            style={{
              position: 'fixed',
              left: 0,
              width: '100%',
              transform: 'translateY(-100%)',
              paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
              transition: 'top 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)',
              willChange: 'top',
              zIndex: 1000,
            }}
          >
            {user ? (
              <form
                onSubmit={handleSubmitQuestion}
                className="p-4 border-t border-[#E5E3DD] bg-white"
              >
                <div className="space-y-2">
                  <textarea
                    value={questionInput}
                    onChange={(e) => setQuestionInput(e.target.value)}
                    placeholder="Ask a question about Ampel..."
                    maxLength={500}
                    rows={3}
                    disabled={submittingQuestion}
                    className="w-full px-4 py-3 bg-[#F2F1ED] border border-[#E5E3DD] rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-600 resize-none"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {questionInput.length}/500
                    </span>
                    <button
                      type="submit"
                      disabled={
                        !questionInput.trim() ||
                        questionInput.length > 500 ||
                        submittingQuestion
                      }
                      className={`px-4 py-2 rounded-xl font-medium text-sm transition-all duration-150 min-h-[44px] ${
                        questionInput.trim() &&
                        questionInput.length <= 500 &&
                        !submittingQuestion
                          ? 'bg-[#30302E] hover:bg-primary-700 text-white active:scale-[0.98]'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {submittingQuestion ? 'Posting...' : 'Post Question'}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="p-4 border-t border-[#E5E3DD] bg-[#F2F1ED]">
                <p className="text-sm text-gray-600 text-center">
                  Please log in to ask questions
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
