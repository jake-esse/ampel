import { useState, useEffect, useRef } from 'react'
import { Keyboard } from '@capacitor/keyboard'
import { isNativePlatform } from './usePlatform'

/**
 * Hook to provide smooth keyboard animations
 *
 * When KeyboardResize.Body mode is used, Capacitor instantly modifies
 * document.body.style.height. This hook uses keyboard events to
 * anticipate these changes and apply smooth animations.
 */
export function useKeyboardAnimation() {
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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
        setIsAnimating(true)
        setKeyboardHeight(info.keyboardHeight)

        // Clear any existing timeout
        if (animationTimeoutRef.current) {
          clearTimeout(animationTimeoutRef.current)
        }

        // Mark animation as complete after the duration
        animationTimeoutRef.current = setTimeout(() => {
          setIsAnimating(false)
        }, 250) // Match our animation duration
      })

      // Listen for keyboard will hide
      hideListener = await Keyboard.addListener('keyboardWillHide', () => {
        setIsAnimating(true)
        setKeyboardHeight(0)

        // Clear any existing timeout
        if (animationTimeoutRef.current) {
          clearTimeout(animationTimeoutRef.current)
        }

        // Mark animation as complete after the duration
        animationTimeoutRef.current = setTimeout(() => {
          setIsAnimating(false)
        }, 250) // Match our animation duration
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
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current)
      }
    }
  }, [])

  return {
    keyboardHeight,
    isAnimating,
    // Provide style object for wrapper
    // The trick: we apply padding-bottom that transitions smoothly
    // This creates space that pushes content up smoothly
    wrapperStyle: {
      height: '100%',
      paddingBottom: `${keyboardHeight}px`,
      // iOS native keyboard animation timing
      // Using a longer duration for smoother feel
      transition: 'padding-bottom 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      // Ensure content stays within bounds
      boxSizing: 'border-box' as const
    }
  }
}