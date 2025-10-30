import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { App } from '@capacitor/app'
import { supabase } from '../supabase'

export type OAuthProvider = 'apple' | 'google'

/**
 * Sign in with OAuth provider (Apple or Google)
 *
 * On web: Opens OAuth in same window with standard redirect
 * On mobile: Opens OAuth in in-app browser, handles deep link callback
 *
 * Profile will be created automatically by database trigger
 *
 * @param provider - OAuth provider (apple or google)
 * @param referralCode - Optional referral code to persist through OAuth (Phase 4: Tier 2 fallback)
 */
export async function signInWithOAuth(provider: OAuthProvider, referralCode?: string) {
  const isNative = Capacitor.isNativePlatform()

  if (isNative) {
    // Mobile implementation using Capacitor Browser
    return signInWithOAuthMobile(provider, referralCode)
  } else {
    // Web implementation (standard redirect)
    return signInWithOAuthWeb(provider, referralCode)
  }
}

/**
 * Web OAuth flow - standard redirect
 * Encodes referral code in state parameter as Tier 2 fallback
 */
async function signInWithOAuthWeb(provider: OAuthProvider, referralCode?: string) {
  // Encode referral code in state parameter (Tier 2 persistence)
  const stateData = referralCode ? { referralCode } : {}
  const state = btoa(JSON.stringify(stateData)) // Base64 encode for URL safety

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      // Pass state parameter with referral code
      ...(referralCode && { queryParams: { state } }),
    }
  })

  if (error) throw error
  return data
}

/**
 * Mobile OAuth flow - uses Capacitor Browser and deep linking
 * Encodes referral code in state parameter as Tier 2 fallback
 */
async function signInWithOAuthMobile(provider: OAuthProvider, referralCode?: string) {
  // Encode referral code in state parameter (Tier 2 persistence)
  const stateData = referralCode ? { referralCode } : {}
  const state = btoa(JSON.stringify(stateData)) // Base64 encode for URL safety

  // Get OAuth URL with skipBrowserRedirect to prevent auto-redirect
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: 'com.ampel.app://auth/callback',
      skipBrowserRedirect: true,
      // Pass state parameter with referral code
      ...(referralCode && { queryParams: { state } }),
    },
  })

  if (error) throw error
  if (!data.url) throw new Error('No OAuth URL returned')

  // Open OAuth URL in in-app browser
  await Browser.open({
    url: data.url,
    windowName: '_self',
  })

  // Listen for deep link callback
  return new Promise(async (resolve, reject) => {
    // Set up deep link listener
    const listener = await App.addListener('appUrlOpen', async ({ url }) => {
      try {
        // Close the in-app browser
        await Browser.close()

        // Extract access_token, refresh_token, and state from URL
        const urlParams = new URLSearchParams(url.split('#')[1])
        const accessToken = urlParams.get('access_token')
        const refreshToken = urlParams.get('refresh_token')
        const returnedState = urlParams.get('state')

        // Decode and store referral code from state parameter (Tier 2 fallback)
        // Only store if localStorage doesn't already have it (Tier 1 takes precedence)
        if (returnedState) {
          try {
            const decodedState = JSON.parse(atob(returnedState))
            if (decodedState.referralCode && !localStorage.getItem('ampel_referral_code')) {
              localStorage.setItem('ampel_referral_code', decodedState.referralCode)
              console.log('Referral code restored from OAuth state (Tier 2)')
            }
          } catch (decodeError) {
            console.error('Failed to decode OAuth state:', decodeError)
            // Continue with auth even if state decoding fails
          }
        }

        if (accessToken && refreshToken) {
          // Set the session using the tokens
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (sessionError) {
            reject(sessionError)
          } else {
            resolve({ session: sessionData.session, user: sessionData.user })
          }
        } else {
          reject(new Error('No tokens found in callback URL'))
        }
      } catch (err) {
        reject(err)
      } finally {
        // Clean up listener
        listener.remove()
      }
    })

    // Timeout after 5 minutes
    setTimeout(() => {
      listener.remove()
      reject(new Error('OAuth timeout'))
    }, 5 * 60 * 1000)
  })
}
