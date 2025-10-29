import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { StatusBar, Style } from '@capacitor/status-bar'
import { App as CapacitorApp } from '@capacitor/app'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { ConversationProvider } from './contexts/ConversationContext'
import { ToastProvider } from './contexts/ToastContext'
import { ToastContainer } from './components/ui/ToastContainer'
import { isNativePlatform, isAndroid } from './hooks/usePlatform'
import { useNetworkStatus } from './hooks/useNetworkStatus'
import { useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Chat from './pages/Chat'
import Apps from './pages/Apps'
import AppsAmpel from './pages/AppsAmpel'
import EquityIntro from './pages/EquityIntro'
import PlanSelection from './pages/PlanSelection'
import { Disclosures } from './pages/Disclosures'
import KYCVerification from './pages/KYCVerification'
import KYCPending from './pages/KYCPending'
import KYCDeclined from './pages/KYCDeclined'
import Checkout from './pages/Checkout'
import CheckoutSuccess from './pages/CheckoutSuccess'

/**
 * Inner app component with network monitoring
 * Must be inside ToastProvider to use toast notifications
 */
function AppContent() {
  // Initialize network status monitoring (shows toasts on connection changes)
  useNetworkStatus()

  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading: authLoading } = useAuth()

  // Force navigation to /chat for authenticated users when app launches
  // This ensures users always start fresh, even if the browser cached a different route
  useEffect(() => {
    // Check if this is a fresh app launch (not just a navigation)
    const isAppLaunch = !sessionStorage.getItem('appLaunched')

    if (isAppLaunch) {
      sessionStorage.setItem('appLaunched', 'true')

      // Wait for auth to load
      if (authLoading) return

      // Only redirect authenticated users who are on a chat-related page with a conversation ID
      if (user && location.pathname.startsWith('/chat/')) {
        // Force navigate to fresh chat on app launch
        navigate('/chat', { replace: true })
      }
    }
  }, [authLoading, user]) // Watch auth changes to ensure redirect happens when user loads

  // Clear session storage when app goes to background (for fresh start next time)
  useEffect(() => {
    if (!isNativePlatform()) return

    let listener: any

    const setupListener = async () => {
      listener = await CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) {
          // App went to background - clear the session storage
          sessionStorage.removeItem('appLaunched')
        }
      })
    }

    setupListener()

    return () => {
      if (listener) {
        listener.remove()
      }
    }
  }, [])

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

        {/* Onboarding routes - New user flow */}
        <Route
          path="/onboarding/equity"
          element={
            <ProtectedRoute>
              <EquityIntro />
            </ProtectedRoute>
          }
        />
        <Route
          path="/onboarding/plans"
          element={
            <ProtectedRoute>
              <PlanSelection />
            </ProtectedRoute>
          }
        />

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

        {/* Checkout route - After KYC approval */}
        <Route
          path="/checkout"
          element={
            <ProtectedRoute>
              <Checkout />
            </ProtectedRoute>
          }
        />

        {/* Checkout success route - After payment completion */}
        <Route
          path="/checkout-success"
          element={
            <ProtectedRoute>
              <CheckoutSuccess />
            </ProtectedRoute>
          }
        />

        {/* Protected routes (require auth + disclosures + KYC approval + onboarding completion) */}
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
        <Route
          path="/apps"
          element={
            <ProtectedRoute>
              <Apps />
            </ProtectedRoute>
          }
        />
        <Route
          path="/apps/ampel"
          element={
            <ProtectedRoute>
              <AppsAmpel />
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
