import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { impact } from '@/hooks/useHaptics'

/**
 * Ampel app detail page
 * Shows information about the Ampel app and its equity-sharing model
 */
export default function AppsAmpel() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <header
        className="border-b-[0.5px] border-[#E5E3DD] p-4 flex-shrink-0"
        style={{
          // iOS safe area support for top (notch/Dynamic Island)
          paddingTop: 'max(1rem, env(safe-area-inset-top))',
        }}
      >
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          {/* Left: Back button */}
          <button
            onClick={() => {
              impact('light')
              navigate(-1)
            }}
            className="p-2.5 hover:bg-gray-100 rounded-lg transition-all duration-150 active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Back"
          >
            <ChevronLeft className="w-6 h-6 text-gray-900" />
          </button>

          {/* Center: Empty */}
          <div />

          {/* Right: Empty space for symmetry */}
          <div className="min-w-[44px]" />
        </div>
      </header>

      {/* Main content */}
      <main
        className="flex-1 overflow-y-auto p-6"
        style={{
          // iOS safe area support for bottom (home indicator)
          paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
        }}
      >
        <div className="max-w-4xl mx-auto space-y-6">
          {/* App Icon and Title Section */}
          <div className="flex items-center gap-4">
            {/* App Icon */}
            <div className="w-20 h-20 bg-[#30302E] rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-4xl">🌱</span>
            </div>

            {/* App Info */}
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">Ampel</h1>
              <p className="text-base text-gray-600">Your AI Company</p>
            </div>
          </div>

          {/* Description Section */}
          <div className="space-y-4">
            <p className="text-base text-gray-700 leading-relaxed">
              Ampel is a new kind of company, one owned by the users. We've set
              aside 50% of the company's equity at launch to share with users in
              return for helping to grow our company by using our product.
            </p>

            <p className="text-base text-gray-700 leading-relaxed">
              We're building a future where everyone engages more meaningfully
              with the companies we help create value for, where the value
              created by AI is shared with those who create it, and where the
              founders of tomorrow determined to build the next big AI company
              can acquire and engage users without spending so much on paid
              marketing by offering equity to users as well.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
