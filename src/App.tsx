import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { StatusBar, Style } from '@capacitor/status-bar'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { KYCGuard } from './components/auth/KYCGuard'
import { ConversationProvider } from './contexts/ConversationContext'
import { ToastProvider } from './contexts/ToastContext'
import { ToastContainer } from './components/ui/ToastContainer'
import { isNativePlatform, isAndroid } from './hooks/usePlatform'
import { useNetworkStatus } from './hooks/useNetworkStatus'
import Login from './pages/Login'
import Chat from './pages/Chat'
import Apps from './pages/Apps'
import AppsAmpel from './pages/AppsAmpel'
import { Disclosures } from './pages/Disclosures'
import KYCVerification from './pages/KYCVerification'
import KYCPending from './pages/KYCPending'
import KYCDeclined from './pages/KYCDeclined'

/**
 * Inner app component with network monitoring
 * Must be inside ToastProvider to use toast notifications
 */
function AppContent() {
  // Initialize network status monitoring (shows toasts on connection changes)
  useNetworkStatus()

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
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Login />} />

        {/* Auth-required routes (no KYC required) */}
        <Route
          path="/disclosures"
          element={
            <ProtectedRoute>
              <Disclosures />
            </ProtectedRoute>
          }
        />
        <Route
          path="/kyc"
          element={
            <ProtectedRoute>
              <KYCVerification />
            </ProtectedRoute>
          }
        />
        <Route
          path="/kyc-pending"
          element={
            <ProtectedRoute>
              <KYCPending />
            </ProtectedRoute>
          }
        />
        <Route
          path="/kyc-declined"
          element={
            <ProtectedRoute>
              <KYCDeclined />
            </ProtectedRoute>
          }
        />

        {/* Protected routes (require auth + disclosures + KYC approval) */}
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <KYCGuard>
                <Chat />
              </KYCGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat/:conversationId"
          element={
            <ProtectedRoute>
              <KYCGuard>
                <Chat />
              </KYCGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/apps"
          element={
            <ProtectedRoute>
              <KYCGuard>
                <Apps />
              </KYCGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/apps/ampel"
          element={
            <ProtectedRoute>
              <KYCGuard>
                <AppsAmpel />
              </KYCGuard>
            </ProtectedRoute>
          }
        />

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Toast notifications */}
      <ToastContainer />
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
