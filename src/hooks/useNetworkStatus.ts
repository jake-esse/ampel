import { useState, useEffect } from 'react'
import { Network } from '@capacitor/network'
import { isNativePlatform } from './usePlatform'
import { useToast } from './useToast'

/**
 * Hook to monitor network connectivity status
 * Shows toast notifications when connection is lost or restored
 * Uses Capacitor Network plugin on native, browser API on web
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const { showToast } = useToast()

  useEffect(() => {
    let hasShownOfflineToast = false

    async function initializeNetworkMonitoring() {
      if (isNativePlatform()) {
        // Use Capacitor Network plugin on native platforms
        try {
          // Get initial status
          const status = await Network.getStatus()
          setIsOnline(status.connected)

          // Listen for network status changes
          const listener = await Network.addListener('networkStatusChange', (status) => {
            setIsOnline(status.connected)

            if (!status.connected && !hasShownOfflineToast) {
              // Just went offline
              showToast({
                type: 'warning',
                message: "You're offline. Some features may not work."
              })
              hasShownOfflineToast = true
            } else if (status.connected && hasShownOfflineToast) {
              // Just came back online
              showToast({
                type: 'info',
                message: "You're back online"
              })
              hasShownOfflineToast = false
            }
          })

          return () => {
            listener.remove()
          }
        } catch (error) {
          console.debug('Failed to initialize network monitoring:', error)
        }
      } else {
        // Use browser API on web
        const handleOnline = () => {
          setIsOnline(true)
          if (hasShownOfflineToast) {
            showToast({
              type: 'info',
              message: "You're back online"
            })
            hasShownOfflineToast = false
          }
        }

        const handleOffline = () => {
          setIsOnline(false)
          showToast({
            type: 'warning',
            message: "You're offline. Some features may not work."
          })
          hasShownOfflineToast = true
        }

        // Set initial status
        setIsOnline(navigator.onLine)

        // Listen for online/offline events
        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        return () => {
          window.removeEventListener('online', handleOnline)
          window.removeEventListener('offline', handleOffline)
        }
      }
    }

    const cleanup = initializeNetworkMonitoring()

    return () => {
      cleanup?.then((fn) => fn?.())
    }
  }, [showToast])

  return { isOnline }
}
