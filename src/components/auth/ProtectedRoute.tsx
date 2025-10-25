import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/database'

interface ProtectedRouteProps {
  children: React.ReactNode
}

/**
 * Wrapper component that protects routes requiring authentication
 * Redirects to login page if user is not authenticated
 * Redirects to disclosures page if user hasn't completed disclosures
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth()
  const location = useLocation()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)

  // Fetch user profile when authenticated or when location changes
  // This ensures we have fresh profile data after updates (e.g., accepting disclosures)
  useEffect(() => {
    async function fetchProfile() {
      if (!user) {
        setProfileLoading(false)
        return
      }

      setProfileLoading(true)

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (error) {
          console.error('Error fetching profile:', error)
        } else {
          setProfile(data)
        }
      } catch (error) {
        console.error('Error fetching profile:', error)
      } finally {
        setProfileLoading(false)
      }
    }

    fetchProfile()
  }, [user, location.pathname])

  // Show loading spinner while checking auth status or profile
  if (authLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#FDFCFA]">
        <svg
          className="animate-spin h-8 w-8 text-[#30302E]"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      </div>
    )
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/" replace />
  }

  // Check if user needs to complete disclosures
  const needsDisclosures = profile && !profile.disclosures_accepted_at
  const isOnDisclosuresPage = location.pathname === '/disclosures'

  // Redirect to disclosures if needed (and not already there)
  if (needsDisclosures && !isOnDisclosuresPage) {
    return <Navigate to="/disclosures" replace />
  }

  // User is authenticated and has completed disclosures (or is on disclosures page), render the protected content
  return <>{children}</>
}
