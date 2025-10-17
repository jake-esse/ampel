import { useState, useEffect, useRef } from 'react'
import { Keyboard } from '@capacitor/keyboard'
import { isNativePlatform } from './usePlatform'

/**
 * Hook for smooth keyboard animations with KeyboardResize.Body mode
 *
 * This hook creates smooth animations by applying a counter-transform
 * during the instant body resize, then smoothly animating back to normal.
 *
 * How it works:
 * 1. When keyboard will show, we get the height it will be
 * 2. We immediately apply a negative transform to counter the body resize
 * 3. We smoothly animate the transform to 0 over the same duration as keyboard animation
 * 4. Result: visually smooth rise to correct position
 */
export function useKeyboardSmooth() {
  const [offsetY, setOffsetY] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const keyboardHeightRef = useRef(0)
  const animationFrameRef = useRef<number | undefined>(undefined)
  const startTimeRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    // Only set up on native platforms
    if (!isNativePlatform()) {
      return
    }

    let showListener: any = null
    let hideListener: any = null
    let didShowListener: any = null
    let didHideListener: any = null

    const setupListeners = async () => {
      // Listen for keyboard WILL show - this fires BEFORE keyboard appears
      showListener = await Keyboard.addListener('keyboardWillShow', (info) => {
        const keyboardHeight = info.keyboardHeight
        keyboardHeightRef.current = keyboardHeight

        // Start with full offset to counter the instant body resize
        setOffsetY(keyboardHeight)
        setIsAnimating(true)

        // Start animation to gradually reduce offset to 0
        startTimeRef.current = Date.now()
        animateToZero()
      })

      // Listen for keyboard DID show - animation complete
      didShowListener = await Keyboard.addListener('keyboardDidShow', () => {
        // Ensure we're at final position
        setOffsetY(0)
        setIsAnimating(false)
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
        }
      })

      // Listen for keyboard WILL hide
      hideListener = await Keyboard.addListener('keyboardWillHide', () => {
        const currentHeight = keyboardHeightRef.current

        // Start from 0 and animate to full offset as body grows
        setOffsetY(0)
        setIsAnimating(true)

        startTimeRef.current = Date.now()
        animateToHeight(currentHeight)
      })

      // Listen for keyboard DID hide - animation complete
      didHideListener = await Keyboard.addListener('keyboardDidHide', () => {
        // Reset everything
        setOffsetY(0)
        setIsAnimating(false)
        keyboardHeightRef.current = 0
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
        }
      })
    }

    // Animation function to smoothly go to zero (keyboard showing)
    const animateToZero = () => {
      const animate = () => {
        if (!startTimeRef.current) return

        const elapsed = Date.now() - startTimeRef.current
        const duration = 250 // iOS keyboard animation duration
        const progress = Math.min(elapsed / duration, 1)

        // Ease-out cubic for smooth deceleration
        const eased = 1 - Math.pow(1 - progress, 3)
        const currentOffset = keyboardHeightRef.current * (1 - eased)

        setOffsetY(currentOffset)

        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(animate)
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate)
    }

    // Animation function to smoothly go to height (keyboard hiding)
    const animateToHeight = (height: number) => {
      const animate = () => {
        if (!startTimeRef.current) return

        const elapsed = Date.now() - startTimeRef.current
        const duration = 250 // iOS keyboard animation duration
        const progress = Math.min(elapsed / duration, 1)

        // Ease-out cubic for smooth deceleration
        const eased = 1 - Math.pow(1 - progress, 3)
        const currentOffset = height * eased

        setOffsetY(currentOffset)

        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(animate)
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate)
    }

    setupListeners()

    // Cleanup
    return () => {
      if (showListener) showListener.remove()
      if (hideListener) hideListener.remove()
      if (didShowListener) didShowListener.remove()
      if (didHideListener) didHideListener.remove()
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  return {
    // The offset to apply to counter body resize
    offsetY,
    // Whether we're currently animating
    isAnimating,
    // Style object for the wrapper
    wrapperStyle: {
      transform: `translateY(${offsetY}px)`,
      // Only apply transition when NOT animating (we handle animation with RAF)
      transition: isAnimating ? 'none' : 'transform 0.25s ease-out',
    }
  }
}