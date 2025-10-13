import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { ConversationProvider } from './contexts/ConversationContext'
import Login from './pages/Login'
import Chat from './pages/Chat'

function App() {
  return (
    <BrowserRouter>
      <ConversationProvider>
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
      </ConversationProvider>
    </BrowserRouter>
  )
}

export default App
