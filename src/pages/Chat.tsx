import { useAuth } from '@/hooks/useAuth'
import { ChatInterface } from '@/components/chat/ChatInterface'

export default function Chat() {
  const { user, signOut } = useAuth()

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Header with logout */}
      <header className="border-b border-gray-800 p-4 flex-shrink-0">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <h1 className="text-xl font-bold text-white">Ampel Chat</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">{user?.email}</span>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition text-sm"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Chat interface */}
      <main className="flex-1 overflow-hidden">
        <ChatInterface />
      </main>
    </div>
  )
}
