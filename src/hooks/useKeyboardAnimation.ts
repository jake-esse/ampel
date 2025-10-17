import { useState, useEffect } from 'react'
import { Keyboard } from '@capacitor/keyboard'
import { isNativePlatform } from './usePlatform'

/**
 * Hook to provide smooth keyboard animations
 *
 * With KeyboardResize.None, we manually handle keyboard appearance
 * and provide the height for smooth transform animations.
 */
export function useKeyboardAnimation() {
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  useEffect(() => {
    // Only set up on native platforms
    if (!isNativePlatform()) {
      return
    }

    let showListener: any = null
    let hideListener: any = null

    const setupListeners = async () => {
      // Listen for keyboard will show - this fires BEFORE keyboard appears
      // We use this to trigger our smooth animation
      showListener = await Keyboard.addListener('keyboardWillShow', (info) => {
        setKeyboardHeight(info.keyboardHeight)
      })

      // Listen for keyboard will hide
      hideListener = await Keyboard.addListener('keyboardWillHide', () => {
        setKeyboardHeight(0)
      })
    }

    setupListeners()

    // Cleanup
    return () => {
      if (showListener) {
        showListener.remove()
      }
      if (hideListener) {
        hideListener.remove()
      }
    }
  }, [])

  return {
    keyboardHeight,
    // For backwards compatibility with App.tsx wrapper
    wrapperStyle: {
      height: '100%',
      // No animation needed in wrapper anymore
    }
  }
}