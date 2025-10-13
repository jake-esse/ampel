import { useState, useEffect } from 'react'
import { Keyboard } from '@capacitor/keyboard'
import { isNativePlatform } from './usePlatform'

/**
 * Keyboard state hook
 * Provides keyboard visibility, height, and control utilities
 *
 * Only activates on native platforms (iOS/Android)
 * On web, returns default values (keyboard not visible, height 0)
 */

interface KeyboardState {
  /**
   * Whether the keyboard is currently visible
   */
  isVisible: boolean

  /**
   * Height of the keyboard in pixels
   * Includes keyboard toolbar (predictive text) on iOS
   */
  keyboardHeight: number

  /**
   * Programmatically hide the keyboard
   */
  hideKeyboard: () => Promise<void>
}

export function useKeyboard(): KeyboardState {
  const [isVisible, setIsVisible] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  useEffect(() => {
    // Only set up listeners on native platforms
    if (!isNativePlatform()) {
      return
    }

    let showListener: any = null
    let hideListener: any = null

    // Set up keyboard event listeners
    const setupListeners = async () => {
      // Listen for keyboard appearance
      // Using keyboardWillShow to trigger layout changes before animation starts
      // This allows our transitions to sync with native keyboard animation
      showListener = await Keyboard.addListener('keyboardWillShow', (info) => {
        setIsVisible(true)
        // info.keyboardHeight is in pixels, includes toolbar on iOS
        setKeyboardHeight(info.keyboardHeight)
      })

      // Listen for keyboard dismissal
      hideListener = await Keyboard.addListener('keyboardWillHide', () => {
        setIsVisible(false)
        setKeyboardHeight(0)
      })
    }

    setupListeners()

    // Cleanup listeners on unmount
    return () => {
      if (showListener) {
        showListener.remove()
      }
      if (hideListener) {
        hideListener.remove()
      }
    }
  }, [])

  // Utility to programmatically hide keyboard
  const hideKeyboard = async () => {
    if (isNativePlatform()) {
      try {
        await Keyboard.hide()
      } catch (error) {
        console.debug('Failed to hide keyboard:', error)
      }
    } else {
      // On web, blur the active element
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
    }
  }

  return {
    isVisible,
    keyboardHeight,
    hideKeyboard,
  }
}
