import { useEffect, useRef, useCallback } from 'react'
import { Keyboard } from '@capacitor/keyboard'
import { isNativePlatform } from './usePlatform'

/**
 * Smooth keyboard animation hook using DIRECT DOM MANIPULATION
 *
 * This hook bypasses React's state/render cycle to avoid animation delays.
 * Instead of setState → re-render → CSS update, we directly manipulate the
 * element's style.top property in real-time as the keyboard animates.
 *
 * How it works:
 * 1. Returns a ref callback that receives the DOM element
 * 2. Listens to visualViewport resize events (updates during keyboard animation)
 * 3. Directly sets element.style.top = `${vv.height}px` (no React re-render)
 * 4. CSS transition on 'top' property creates smooth animation
 * 5. Element appears to rise smoothly with keyboard
 *
 * Usage:
 * ```tsx
 * const inputRef = useKeyboardAnimation()
 * return <div ref={inputRef} style={{ position: 'fixed', transform: 'translateY(-100%)' }}>
 * ```
 *
 * Why this approach works:
 * - Visual Viewport API updates DURING keyboard animation (not after)
 * - Direct DOM manipulation is instant (no setState delay)
 * - CSS transition handles the smooth animation
 * - Zero React re-renders = zero lag
 *
 * iOS 18 note: visualViewport has bugs but is still better than alternatives.
 * Falls back to Capacitor events if visualViewport unavailable.
 */

export function useKeyboardAnimation() {
  // Store the DOM element reference
  const elementRef = useRef<HTMLElement | null>(null)

  // Track animation frame ID for cleanup
  const rafId = useRef<number | null>(null)
  const pendingUpdate = useRef(false)

  // Store initial element height to handle translateY(-100%)
  const elementHeight = useRef<number>(0)

  /**
   * Ref callback - called when component mounts/unmounts
   * This is where we receive the actual DOM element
   */
  const refCallback = useCallback((element: HTMLElement | null) => {
    console.log('[useKeyboardAnimation] Ref callback called with element:', element)
    elementRef.current = element

    if (element) {
      // Store element height for calculations
      elementHeight.current = element.offsetHeight
      console.log('[useKeyboardAnimation] Element height:', elementHeight.current)

      // Initialize position
      const initialTop = typeof window !== 'undefined' && window.visualViewport
        ? window.visualViewport.height
        : window.innerHeight

      console.log('[useKeyboardAnimation] Setting initial top:', initialTop)
      element.style.top = `${initialTop}px`
    }
  }, [])

  useEffect(() => {
    console.log('[useKeyboardAnimation] useEffect running')
    console.log('[useKeyboardAnimation] isNativePlatform:', isNativePlatform())

    // TEMPORARY: Force Capacitor keyboard events since we see them firing
    // Skip Visual Viewport API for now
    const FORCE_CAPACITOR_EVENTS = true

    if (FORCE_CAPACITOR_EVENTS || !isNativePlatform()) {
      console.log('[useKeyboardAnimation] Using FORCED Capacitor keyboard events')

      let showListener: any = null
      let hideListener: any = null

      const setupListeners = async () => {
        console.log('[useKeyboardAnimation] Setting up Capacitor listeners')

        showListener = await Keyboard.addListener('keyboardWillShow', (info) => {
          console.log('[useKeyboardAnimation] keyboardWillShow fired, height:', info.keyboardHeight)
          if (!elementRef.current) {
            console.log('[useKeyboardAnimation] No element ref in keyboardWillShow')
            return
          }

          // Calculate new top position
          // window.innerHeight - keyboardHeight = visible area height
          // Add offset to bring input closer to keyboard (higher value = closer to keyboard)
          const OFFSET = 25 // pixels to bring input down
          const visibleHeight = window.innerHeight - info.keyboardHeight + OFFSET
          console.log('[useKeyboardAnimation] Setting top to:', visibleHeight)

          // Directly set top position (no setState)
          elementRef.current.style.top = `${visibleHeight}px`
        })

        hideListener = await Keyboard.addListener('keyboardWillHide', () => {
          console.log('[useKeyboardAnimation] keyboardWillHide fired')
          if (!elementRef.current) return

          // Reset to full height
          const fullHeight = window.innerHeight
          console.log('[useKeyboardAnimation] Resetting top to:', fullHeight)
          elementRef.current.style.top = `${fullHeight}px`
        })
      }

      setupListeners()

      return () => {
        console.log('[useKeyboardAnimation] Cleaning up Capacitor listeners')
        if (showListener) showListener.remove()
        if (hideListener) hideListener.remove()
        if (rafId.current) {
          cancelAnimationFrame(rafId.current)
        }
      }
    }

    // Check if Visual Viewport API is available
    const hasVisualViewport = typeof window !== 'undefined' &&
                               'visualViewport' in window &&
                               window.visualViewport !== null

    console.log('[useKeyboardAnimation] hasVisualViewport:', hasVisualViewport)

    if (hasVisualViewport) {
      const visualViewport = window.visualViewport!
      console.log('[useKeyboardAnimation] Initial viewport height:', visualViewport.height)

      /**
       * Update element position based on viewport height
       * This runs during keyboard animation for smooth movement
       */
      const updatePosition = () => {
        if (!elementRef.current) {
          console.log('[useKeyboardAnimation] updatePosition called but no element ref')
          return
        }
        if (pendingUpdate.current) return

        pendingUpdate.current = true

        rafId.current = requestAnimationFrame(() => {
          pendingUpdate.current = false

          if (!elementRef.current) return

          // Set top position to viewport height
          // Combined with transform: translateY(-100%), this keeps element at bottom
          // As keyboard rises, viewport height decreases, top decreases, element moves up
          const newTop = visualViewport.height

          console.log('[useKeyboardAnimation] Updating top to:', newTop)

          // Directly manipulate DOM (no React re-render)
          elementRef.current.style.top = `${newTop}px`
        })
      }

      // Listen to viewport changes (fires during keyboard animation)
      console.log('[useKeyboardAnimation] Adding visualViewport listeners')
      visualViewport.addEventListener('resize', updatePosition)
      visualViewport.addEventListener('scroll', updatePosition)

      // Initial position
      console.log('[useKeyboardAnimation] Calling initial updatePosition')
      updatePosition()

      return () => {
        visualViewport.removeEventListener('resize', updatePosition)
        visualViewport.removeEventListener('scroll', updatePosition)
        if (rafId.current) {
          cancelAnimationFrame(rafId.current)
        }
      }
    } else {
      // Fallback: Capacitor keyboard events
      // Less smooth but works on older iOS versions
      console.log('[useKeyboardAnimation] Using Capacitor keyboard events fallback')
      let showListener: any = null
      let hideListener: any = null

      const setupListeners = async () => {
        console.log('[useKeyboardAnimation] Setting up Capacitor listeners')

        showListener = await Keyboard.addListener('keyboardWillShow', (info) => {
          console.log('[useKeyboardAnimation] keyboardWillShow fired, height:', info.keyboardHeight)
          if (!elementRef.current) {
            console.log('[useKeyboardAnimation] No element ref in keyboardWillShow')
            return
          }

          // Calculate new top position
          // window.innerHeight - keyboardHeight = visible area height
          // Add offset to bring input closer to keyboard (higher value = closer to keyboard)
          const OFFSET = 25 // pixels to bring input down
          const visibleHeight = window.innerHeight - info.keyboardHeight + OFFSET
          console.log('[useKeyboardAnimation] Setting top to:', visibleHeight)

          // Directly set top position (no setState)
          elementRef.current.style.top = `${visibleHeight}px`
        })

        hideListener = await Keyboard.addListener('keyboardWillHide', () => {
          console.log('[useKeyboardAnimation] keyboardWillHide fired')
          if (!elementRef.current) return

          // Reset to full height
          const fullHeight = window.innerHeight
          console.log('[useKeyboardAnimation] Resetting top to:', fullHeight)
          elementRef.current.style.top = `${fullHeight}px`
        })
      }

      setupListeners()

      return () => {
        if (showListener) showListener.remove()
        if (hideListener) hideListener.remove()
        if (rafId.current) {
          cancelAnimationFrame(rafId.current)
        }
      }
    }
  }, [])

  return refCallback
}
