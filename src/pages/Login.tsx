import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sprout } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'

type AuthMode = 'signin' | 'signup'

export default function Login() {
  const navigate = useNavigate()
  const { user, signIn, signUp, signInWithProvider } = useAuth()
  const { showToast } = useToast()

  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingType, setLoadingType] = useState<'email' | 'apple' | 'google' | null>(null)
  const [emailFocused, setEmailFocused] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  // Redirect to appropriate page if already authenticated
  // Don't redirect to /chat directly - let ProtectedRoute handle onboarding flow
  useEffect(() => {
    if (user) {
      // Navigate to /onboarding/equity and let ProtectedRoute determine the correct destination
      // This prevents redirect loops and ensures proper onboarding flow
      navigate('/onboarding/equity', { replace: true })
    }
  }, [user, navigate])

  // Handle email focus - scroll form into view and expand
  const handleEmailFocus = () => {
    setEmailFocused(true)

    // Scroll the form into view after a short delay to ensure smooth expansion
    // Use 'start' to position form at top of viewport, ensuring it's visible above keyboard
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      }
    }, 150)
  }

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const validatePassword = (password: string): boolean => {
    return password.length >= 6
  }

  const validateReferralCode = (code: string): boolean => {
    if (!code || code.trim().length === 0) return true // Optional field
    // Alphanumeric, 6-8 characters
    const referralRegex = /^[A-Z0-9]{6,8}$/i
    return referralRegex.test(code)
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!validateEmail(email)) {
      showToast({
        type: 'error',
        message: 'Please enter a valid email address'
      })
      return
    }

    if (!validatePassword(password)) {
      showToast({
        type: 'error',
        message: 'Password must be at least 6 characters'
      })
      return
    }

    // Validate referral code if provided (only for signup)
    if (mode === 'signup' && referralCode && !validateReferralCode(referralCode)) {
      showToast({
        type: 'error',
        message: 'Referral code must be 6-8 alphanumeric characters'
      })
      return
    }

    setLoading(true)
    setLoadingType('email')

    try {
      if (mode === 'signup') {
        await signUp({
          email,
          password,
          referralCode: referralCode.trim() || undefined
        })
        showToast({
          type: 'info',
          message: 'Check your email to confirm your account'
        })
      } else {
        await signIn({ email, password })
      }
    } catch (err) {
      if (err instanceof Error) {
        // Make error messages user-friendly
        if (err.message.includes('Invalid login credentials')) {
          showToast({
            type: 'error',
            message: 'Invalid email or password'
          })
        } else if (err.message.includes('already registered')) {
          showToast({
            type: 'error',
            message: 'This email is already registered. Try signing in instead.'
          })
        } else if (err.message.includes('Email not confirmed')) {
          showToast({
            type: 'info',
            message: 'Please check your email to confirm your account'
          })
        } else {
          showToast({
            type: 'error',
            message: err.message
          })
        }
      } else {
        showToast({
          type: 'error',
          message: 'Something went wrong. Please try again.'
        })
      }
      console.error('Auth error:', err)
    } finally {
      setLoading(false)
      setLoadingType(null)
    }
  }

  const handleOAuthSignIn = async (provider: 'apple' | 'google') => {
    setLoading(true)
    setLoadingType(provider)

    try {
      await signInWithProvider(provider)
      // On mobile, session is set by the OAuth callback
      // On web, the page will redirect
      // useAuth will detect the session change and redirect to /chat
      setLoading(false)
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('network')) {
          showToast({
            type: 'error',
            message: 'No internet connection. Please check your network.'
          })
        } else if (err.message.includes('timeout')) {
          showToast({
            type: 'error',
            message: 'Sign in timed out. Please try again.'
          })
        } else {
          showToast({
            type: 'error',
            message: `Failed to sign in with ${provider === 'apple' ? 'Apple' : 'Google'}. Please try again.`
          })
        }
      } else {
        showToast({
          type: 'error',
          message: 'Something went wrong. Please try again.'
        })
      }
      console.error('OAuth error:', err)
      setLoading(false)
      setLoadingType(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#FDFCFA] px-4 overflow-y-auto flex items-center justify-center">
      <div
        className="w-full max-w-md transition-all duration-300"
        style={{
          paddingBottom: emailFocused ? '400px' : '0',
          marginTop: emailFocused ? '100px' : '0',
        }}
      >
        {/* Logo/Branding - Collapses when email is focused */}
        <div
          className="flex flex-col items-center mt-8 overflow-hidden transition-all duration-300"
          style={{
            maxHeight: emailFocused ? '0' : '200px',
            marginBottom: emailFocused ? '0' : '1.5rem',
            opacity: emailFocused ? 0 : 1,
          }}
        >
          <div className="flex items-end gap-1 mb-3">
            <Sprout
              className="w-12 h-12 text-gray-900"
              style={{ transform: 'translateY(-6px)' }}
            />
            <h1 className="text-5xl font-medium font-sans text-gray-900 tracking-tight -ml-1">Ampel</h1>
          </div>
          <p className="text-gray-600 text-lg">Your AI Company</p>
        </div>

        {/* Social Auth Buttons */}
        <div className="space-y-3 mb-4">
          <button
            onClick={() => handleOAuthSignIn('apple')}
            disabled={loading}
            className="w-full min-h-[56px] px-6 py-4 bg-[#30302E] text-white rounded-2xl font-medium flex items-center justify-center gap-3 hover:bg-[#404040] transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {loading && loadingType === 'apple' ? (
              <>
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
                <span>Continue with Apple</span>
              </>
            )}
          </button>

          <button
            onClick={() => handleOAuthSignIn('google')}
            disabled={loading}
            className="w-full min-h-[56px] px-6 py-4 bg-white text-gray-900 rounded-2xl font-medium flex items-center justify-center gap-3 hover:bg-gray-50 transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm border border-[#E5E3DD]"
          >
            {loading && loadingType === 'google' ? (
              <>
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>
        </div>

        {/* Divider */}
        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#E5E3DD]"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-3 bg-[#FDFCFA] text-gray-600">or</span>
          </div>
        </div>

        {/* Email/Password Form */}
        <form ref={formRef} onSubmit={handleEmailAuth} className="bg-white rounded-2xl shadow-sm border border-[#E5E3DD] overflow-hidden">
          {/* Email Input - Always visible */}
          <div className="p-4">
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={handleEmailFocus}
              disabled={loading}
              className="w-full px-4 py-3 bg-[#F2F1ED] border-0 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-50 text-base"
              placeholder="Email"
              required
            />
          </div>

          {/* Password and Submit - Expands when email is focused */}
          <div
            className="transition-all duration-300 ease-in-out overflow-hidden"
            style={{
              maxHeight: emailFocused ? '300px' : '0',
              opacity: emailFocused ? 1 : 0,
            }}
          >
            <div className="px-4 pb-4 space-y-3">
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-3 bg-[#F2F1ED] border-0 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-50 text-base"
                placeholder="Password"
                required
              />

              {/* Referral Code - Only show for signup */}
              {mode === 'signup' && (
                <input
                  id="referralCode"
                  type="text"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  disabled={loading}
                  className="w-full px-4 py-3 bg-[#F2F1ED] border-0 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-50 text-base"
                  placeholder="Referral code (optional)"
                  maxLength={8}
                />
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[48px] px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading && loadingType === 'email' ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Signing in...</span>
                  </>
                ) : (
                  mode === 'signin' ? 'Sign In' : 'Sign Up'
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Mode Toggle */}
        <div className="text-center mt-6">
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin')
            }}
            disabled={loading}
            className="text-sm text-gray-600 hover:text-gray-900 transition-all duration-150 active:opacity-70 disabled:opacity-50"
          >
            {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}
