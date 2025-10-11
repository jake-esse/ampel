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
 */
export async function signInWithOAuth(provider: OAuthProvider) {
  const isNative = Capacitor.isNativePlatform()

  if (isNative) {
    // Mobile implementation using Capacitor Browser
    return signInWithOAuthMobile(provider)
  } else {
    // Web implementation (standard redirect)
    return signInWithOAuthWeb(provider)
  }
}

/**
 * Web OAuth flow - standard redirect
 */
async function signInWithOAuthWeb(provider: OAuthProvider) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    // Web uses standard redirect to Site URL
  })

  if (error) throw error
  return data
}

/**
 * Mobile OAuth flow - uses Capacitor Browser and deep linking
 */
async function signInWithOAuthMobile(provider: OAuthProvider) {
  // Get OAuth URL with skipBrowserRedirect to prevent auto-redirect
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: 'com.ampel.app://auth/callback',
      skipBrowserRedirect: true,
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

        // Extract access_token and refresh_token from URL
        const urlParams = new URLSearchParams(url.split('#')[1])
        const accessToken = urlParams.get('access_token')
        const refreshToken = urlParams.get('refresh_token')

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
