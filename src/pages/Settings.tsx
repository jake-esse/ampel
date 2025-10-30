import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, LogOut, Apple, Copy, Check } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { impact } from '@/hooks/useHaptics'
import { getUserInitials } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { applyReferralCode, validateReferralCode } from '@/lib/database/subscriptions'
import type { Profile } from '@/types/database'

/**
 * Settings page
 * Displays user profile information, referral code management, and sign out functionality
 */
export default function Settings() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { showToast } = useToast()
  const [signingOut, setSigningOut] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)

  // Referral code management
  const [copiedOwnCode, setCopiedOwnCode] = useState(false)
  const [referralCodeInput, setReferralCodeInput] = useState('')
  const [applyingCode, setApplyingCode] = useState(false)

  // Fetch user profile
  useEffect(() => {
    async function fetchProfile() {
      if (!user?.id) {
        setProfileLoading(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (error) throw error
        setProfile(data)
      } catch (error) {
        console.error('Error fetching profile:', error)
        showToast({
          type: 'error',
          message: 'Failed to load profile'
        })
      } finally {
        setProfileLoading(false)
      }
    }

    fetchProfile()
  }, [user?.id, showToast])

  const handleSignOut = async () => {
    try {
      setSigningOut(true)
      await impact('medium')
      await signOut()
      navigate('/login', { replace: true })
    } catch (error) {
      console.error('Sign out error:', error)
      showToast({
        type: 'error',
        message: 'Failed to sign out. Please try again.'
      })
      setSigningOut(false)
    }
  }

  const handleBack = async () => {
    await impact('light')
    navigate(-1)
  }

  const handleCopyOwnCode = async () => {
    if (!profile?.referral_code) return

    try {
      await navigator.clipboard.writeText(profile.referral_code)
      await impact('light')
      setCopiedOwnCode(true)
      showToast({
        type: 'info',
        message: 'Referral code copied!'
      })
      setTimeout(() => setCopiedOwnCode(false), 2000)
    } catch (error) {
      console.error('Failed to copy code:', error)
      showToast({
        type: 'error',
        message: 'Failed to copy code'
      })
    }
  }

  const handleApplyReferralCode = async () => {
    if (!user?.id || !referralCodeInput.trim()) return

    // Validate format
    const codeRegex = /^[A-Z0-9]{6,8}$/i
    if (!codeRegex.test(referralCodeInput.trim())) {
      showToast({
        type: 'error',
        message: 'Code must be 6-8 alphanumeric characters'
      })
      return
    }

    setApplyingCode(true)

    try {
      // Validate code exists
      const isValid = await validateReferralCode(referralCodeInput.trim())
      if (!isValid) {
        showToast({
          type: 'error',
          message: 'Invalid referral code'
        })
        setApplyingCode(false)
        return
      }

      // Apply code
      await applyReferralCode(user.id, referralCodeInput.trim())
      await impact('medium')

      // Refresh profile to show updated data
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) throw error
      setProfile(data)

      setReferralCodeInput('')
      showToast({
        type: 'info',
        message: 'Referral code applied! You received 25 shares.'
      })
    } catch (error) {
      console.error('Error applying referral code:', error)
      const message = error instanceof Error ? error.message : 'Failed to apply referral code'
      showToast({
        type: 'error',
        message
      })
    } finally {
      setApplyingCode(false)
    }
  }

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-[#FDFCFA] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-600">Loading settings...</p>
        </div>
      </div>
    )
  }

  const tierDisplay = profile?.selected_subscription_tier
    ? profile.selected_subscription_tier.charAt(0).toUpperCase() + profile.selected_subscription_tier.slice(1)
    : 'Not selected'

  const providerIcon = profile?.auth_provider === 'apple' ? (
    <Apple className="w-4 h-4" />
  ) : (
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )

  const providerName = profile?.auth_provider === 'apple' ? 'Apple' : 'Google'

  return (
    <div className="min-h-screen bg-[#FDFCFA] flex flex-col">
      {/* Header */}
      <header
        className="bg-white border-b-[0.5px] border-[#E5E3DD]"
        style={{
          paddingTop: 'max(1rem, env(safe-area-inset-top))'
        }}
      >
        <div className="flex items-center justify-between px-4 pb-4">
          <button
            onClick={handleBack}
            className="p-2.5 hover:bg-gray-100 rounded-lg transition-all duration-150 active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-900" />
          </button>
          <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
          <div className="w-11" /> {/* Spacer for centering */}
        </div>
      </header>

      {/* Content */}
      <main
        className="flex-1 px-4 py-6 space-y-6"
        style={{
          paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))'
        }}
      >
        {/* Profile Card */}
        <div className="bg-white border border-[#E5E3DD] rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0 bg-[#30302E]">
              <span className="text-lg font-semibold text-white">
                {getUserInitials(profile?.display_name, user?.email)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-medium text-gray-900 truncate">
                {user?.email}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {providerIcon}
                <span className="text-sm text-gray-600">Signed in with {providerName}</span>
              </div>
            </div>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#F2F1ED] rounded-lg p-4">
              <p className="text-xs text-gray-600 mb-1">Plan</p>
              <p className="text-base font-semibold text-gray-900">{tierDisplay}</p>
            </div>
            <div className="bg-[#F2F1ED] rounded-lg p-4">
              <p className="text-xs text-gray-600 mb-1">Shares</p>
              <p className="text-base font-semibold text-gray-900">
                {profile?.shares_balance?.toLocaleString() || '0'}
              </p>
            </div>
          </div>
        </div>

        {/* Your Referral Code */}
        <div className="bg-white border border-[#E5E3DD] rounded-xl p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Your Referral Code</h2>
          <p className="text-sm text-gray-600 mb-4">
            Share this code with friends. You'll receive 50 shares for each referral!
          </p>
          <div className="flex items-center gap-3">
            <div className="flex-1 px-4 py-3 bg-[#F2F1ED] rounded-lg">
              <p className="text-lg font-mono font-semibold text-gray-900 text-center tracking-wider">
                {profile?.referral_code || '---'}
              </p>
            </div>
            <button
              onClick={handleCopyOwnCode}
              className="p-3 bg-[#30302E] hover:bg-primary-700 text-white rounded-lg transition-all duration-150 active:scale-95 min-h-[48px] min-w-[48px] flex items-center justify-center"
              aria-label="Copy referral code"
            >
              {copiedOwnCode ? (
                <Check className="w-5 h-5" />
              ) : (
                <Copy className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Code Used (if applicable) */}
        {profile?.referral_code_used && (
          <div className="bg-white border border-[#E5E3DD] rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900 mb-3">Code Used</h2>
            <div className="px-4 py-3 bg-[#F2F1ED] rounded-lg">
              <p className="text-base font-mono font-semibold text-gray-900 text-center tracking-wider">
                {profile.referral_code_used}
              </p>
            </div>
            <p className="text-sm text-gray-600 mt-3 text-center">
              You received 25 shares from this referral
            </p>
          </div>
        )}

        {/* Enter Referral Code (if no code used yet) */}
        {!profile?.referral_code_used && (
          <div className="bg-white border border-[#E5E3DD] rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900 mb-3">Have a Referral Code?</h2>
            <p className="text-sm text-gray-600 mb-4">
              Enter a referral code to receive 25 bonus shares!
            </p>
            <div className="space-y-3">
              <input
                type="text"
                value={referralCodeInput}
                onChange={(e) => setReferralCodeInput(e.target.value.toUpperCase())}
                disabled={applyingCode}
                className="w-full px-4 py-3 bg-[#F2F1ED] border border-[#E5E3DD] rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-50 text-base font-mono tracking-wider text-center"
                placeholder="Enter code (e.g., ABC123)"
                maxLength={8}
              />
              <button
                onClick={handleApplyReferralCode}
                disabled={applyingCode || !referralCodeInput.trim()}
                className="w-full min-h-[48px] px-6 py-3 bg-[#30302E] hover:bg-primary-700 text-white rounded-xl font-medium transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {applyingCode ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Applying...</span>
                  </>
                ) : (
                  'Apply Code'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Sign Out Button */}
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full min-h-[56px] px-6 py-4 bg-white hover:bg-gray-50 text-red-600 rounded-xl font-medium flex items-center justify-center gap-3 transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed border border-[#E5E3DD]"
        >
          {signingOut ? (
            <>
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Signing out...</span>
            </>
          ) : (
            <>
              <LogOut className="w-5 h-5" />
              <span>Sign Out</span>
            </>
          )}
        </button>
      </main>
    </div>
  )
}
