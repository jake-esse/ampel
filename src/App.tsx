import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { StatusBar, Style } from '@capacitor/status-bar'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { ConversationProvider } from './contexts/ConversationContext'
import { ToastProvider } from './contexts/ToastContext'
import { ToastContainer } from './components/ui/ToastContainer'
import { isNativePlatform, isAndroid } from './hooks/usePlatform'
import { useNetworkStatus } from './hooks/useNetworkStatus'
import { useKeyboardAnimation } from './hooks/useKeyboardAnimation'
import Login from './pages/Login'
import Chat from './pages/Chat'

/**
 * Inner app component with network monitoring
 * Must be inside ToastProvider to use toast notifications
 */
function AppContent() {
  // Initialize network status monitoring (shows toasts on connection changes)
  useNetworkStatus()

  // Get keyboard animation wrapper style
  const { wrapperStyle } = useKeyboardAnimation()

  // Initialize status bar on mount
  useEffect(() => {
    async function initializeStatusBar() {
      // Only configure status bar on native platforms
      if (!isNativePlatform()) return

      try {
        // Set status bar content to light (white icons/text)
        // This works well with our dark theme (gray-900 background)
        await StatusBar.setStyle({ style: Style.Light })

        // On Android, also set the background color to match our theme
        if (isAndroid()) {
          await StatusBar.setBackgroundColor({ color: '#111827' }) // gray-900
        }
      } catch (error) {
        // Status bar configuration is not critical, just log the error
        console.debug('Failed to configure status bar:', error)
      }
    }

    initializeStatusBar()
  }, [])

  return (
    <ConversationProvider>
      {/* Wrapper div for smooth keyboard animations */}
      <div className="keyboard-animation-wrapper" style={wrapperStyle}>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <Chat />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat/:conversationId"
            element={
              <ProtectedRoute>
                <Chat />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        {/* Toast notifications */}
        <ToastContainer />
      </div>
    </ConversationProvider>
  )
}

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </BrowserRouter>
  )
}

export default App
