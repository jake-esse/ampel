import { useEffect } from 'react'
import { App } from '@capacitor/app'
import { isAndroid } from './usePlatform'

/**
 * Android back button handling
 * Manages back button behavior in the app:
 * - Closes drawer if open
 * - Navigates back through conversation history
 * - Exits app when at root level
 *
 * Only active on Android platform
 */

interface UseBackButtonOptions {
  /**
   * Whether the drawer is currently open
   * If true, back button will close the drawer instead of navigating
   */
  drawerOpen?: boolean

  /**
   * Callback to close the drawer
   */
  onCloseDrawer?: () => void

  /**
   * Whether we're currently viewing a specific conversation
   * If true, back button will navigate to chat home
   */
  inConversation?: boolean

  /**
   * Callback to navigate back
   * Should navigate to chat home or previous screen
   */
  onNavigateBack?: () => void

  /**
   * Whether we're at the root level of the app (chat home or login)
   * If true, back button will exit the app
   */
  atRootLevel?: boolean
}

export function useBackButton(options: UseBackButtonOptions = {}) {
  const {
    drawerOpen = false,
    onCloseDrawer,
    inConversation = false,
    onNavigateBack,
    atRootLevel = false,
  } = options

  useEffect(() => {
    // Only set up back button listener on Android
    if (!isAndroid()) return

    let listener: any = null

    // Set up listener
    const setupListener = async () => {
      listener = await App.addListener('backButton', ({ canGoBack }) => {
        // Priority 1: Close drawer if open
        if (drawerOpen && onCloseDrawer) {
          onCloseDrawer()
          return
        }

        // Priority 2: Navigate back if in a conversation
        if (inConversation && onNavigateBack) {
          onNavigateBack()
          return
        }

        // Priority 3: Exit app if at root level
        if (atRootLevel) {
          App.exitApp()
          return
        }

        // Default: Use browser history if available
        if (canGoBack) {
          window.history.back()
        } else {
          App.exitApp()
        }
      })
    }

    setupListener()

    // Cleanup listener on unmount
    return () => {
      if (listener) {
        listener.remove()
      }
    }
  }, [
    drawerOpen,
    onCloseDrawer,
    inConversation,
    onNavigateBack,
    atRootLevel,
  ])
}
