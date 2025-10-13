import { Capacitor } from '@capacitor/core'

/**
 * Platform detection utilities
 * Returns information about the current platform (iOS, Android, or Web)
 */

export type Platform = 'ios' | 'android' | 'web'

/**
 * Get the current platform
 * @returns 'ios' | 'android' | 'web'
 */
export function getPlatform(): Platform {
  const platform = Capacitor.getPlatform()
  if (platform === 'ios') return 'ios'
  if (platform === 'android') return 'android'
  return 'web'
}

/**
 * Check if running on a native platform (iOS or Android)
 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform()
}

/**
 * Check if running on iOS
 */
export function isIOS(): boolean {
  return getPlatform() === 'ios'
}

/**
 * Check if running on Android
 */
export function isAndroid(): boolean {
  return getPlatform() === 'android'
}

/**
 * Check if running on web/browser
 */
export function isWeb(): boolean {
  return getPlatform() === 'web'
}

/**
 * Hook for accessing platform information
 * Returns platform detection utilities
 */
export function usePlatform() {
  return {
    platform: getPlatform(),
    isNative: isNativePlatform(),
    isIOS: isIOS(),
    isAndroid: isAndroid(),
    isWeb: isWeb(),
  }
}
