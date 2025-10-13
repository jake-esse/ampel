import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { isIOS } from './usePlatform'

/**
 * Haptic feedback utilities for iOS
 * Provides a simple interface for triggering haptic feedback
 *
 * Note: Haptics are iOS-only. On Android and web, these functions are no-ops.
 */

export type HapticImpact = 'light' | 'medium' | 'heavy'
export type HapticNotification = 'success' | 'warning' | 'error'

/**
 * Trigger impact haptic feedback
 * @param style - 'light' | 'medium' | 'heavy'
 *
 * Usage:
 * - Light: Subtle feedback for minor actions
 * - Medium: Standard feedback for regular actions (default)
 * - Heavy: Strong feedback for important actions
 */
export async function impact(style: HapticImpact = 'medium'): Promise<void> {
  // Only trigger haptics on iOS
  if (!isIOS()) return

  try {
    let impactStyle: ImpactStyle
    switch (style) {
      case 'light':
        impactStyle = ImpactStyle.Light
        break
      case 'heavy':
        impactStyle = ImpactStyle.Heavy
        break
      case 'medium':
      default:
        impactStyle = ImpactStyle.Medium
    }

    await Haptics.impact({ style: impactStyle })
  } catch (error) {
    // Silently fail - haptics are not critical
    console.debug('Haptics not available:', error)
  }
}

/**
 * Trigger selection haptic feedback
 * Used when the selection changes (e.g., long-press menu appears)
 */
export async function selection(): Promise<void> {
  // Only trigger haptics on iOS
  if (!isIOS()) return

  try {
    await Haptics.selectionStart()
  } catch (error) {
    // Silently fail
    console.debug('Haptics not available:', error)
  }
}

/**
 * Trigger notification haptic feedback
 * @param type - 'success' | 'warning' | 'error'
 *
 * Used for completion states or alerts
 */
export async function notification(
  type: HapticNotification = 'success'
): Promise<void> {
  // Only trigger haptics on iOS
  if (!isIOS()) return

  try {
    let notificationType: NotificationType
    switch (type) {
      case 'success':
        notificationType = NotificationType.Success
        break
      case 'warning':
        notificationType = NotificationType.Warning
        break
      case 'error':
        notificationType = NotificationType.Error
        break
    }

    await Haptics.notification({ type: notificationType })
  } catch (error) {
    // Silently fail
    console.debug('Haptics not available:', error)
  }
}

/**
 * Hook for accessing haptic feedback functions
 * Returns haptic utilities that automatically check platform
 */
export function useHaptics() {
  return {
    impact,
    selection,
    notification,
  }
}
