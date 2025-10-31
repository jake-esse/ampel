import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, MessageCircle, Sprout } from 'lucide-react'
import { impact } from '@/hooks/useHaptics'
import { Accordion } from '@/components/ui/Accordion'
import { DiscussionBoard } from '@/components/ampel/DiscussionBoard'

/**
 * Ampel app detail page
 * Shows information about the Ampel app and its equity-sharing model
 * Includes ownership incentives, disclosures, and discussion board
 */
export default function AppsAmpel() {
  const navigate = useNavigate()
  const [isDiscussionOpen, setIsDiscussionOpen] = useState(false)

  // Ownership incentive cards data
  const ownershipIncentives = [
    {
      title: 'Sign Up',
      shares: 100,
      description: 'Welcome bonus for joining Ampel',
    },
    {
      title: 'Monthly Subscription',
      shares: '5-40',
      description: 'Earn shares every month based on your plan',
    },
    {
      title: 'Refer a Friend',
      shares: 50,
      description: 'Get shares for each person you invite',
    },
    {
      title: 'Get Referred',
      shares: 25,
      description: 'Bonus shares for using a referral code',
    },
  ]

  // Disclosure sections data
  const disclosureSections = [
    {
      title: 'Offering Process',
      content: `This offering is conducted pursuant to Section 4(a)(6) of the Securities Act of 1933, as amended (Regulation Crowdfunding).

Loupt Portal LLC, a funding portal registered with the SEC and FINRA, serves as the intermediary for this offering.`,
    },
    {
      title: 'Company Information',
      content: `Entity: [Insert legal entity name]
Address: [Insert physical address]
Website: ampel.ai
Principal: James Esse, Founder & Chief Executive Officer
Business Description: Ampel operates a consumer-facing artificial intelligence platform providing user ownership opportunities. The Company intends to enable third-party developer integrations and facilitate ownership offerings through its platform. Planned revenue streams include user subscriptions, transaction fees from third-party developers, and additional products and services for both users and developers.
Current Headcount: 1`,
    },
    {
      title: 'Financial Terms',
      content: `Securities are offered at par value, established at offering commencement.
Offering Amount: 5,000,000 shares
Minimum Target: $0
Offering Deadline: March 31, 2026
No additional shares will be issued under the described incentive program.
Offering Purpose: Community building and early user engagement`,
    },
    {
      title: 'Risk Factors',
      content: `The Company is pre-revenue with no operating history, liquidity, or material capital resources. This offering aims to fund initial operations.

Material risks include: user acquisition and retention failure, developer adoption failure, inability to achieve positive cash flow, future fundraising challenges, regulatory uncertainty, cybersecurity vulnerabilities, and key person dependency.`,
    },
    {
      title: 'Securities Description',
      content: `Offered Securities: Non-voting common stock
Existing Securities: Voting common stock (held solely by Founder)
The non-voting common stock may be amended to include voting rights; no current plans exist to do so.
Valuation: Par value, determined at offering commencement
Future Dilution: Both share classes are subject to dilution through a future equity incentive plan and potential capital raises.
Transfer Restrictions: Securities are subject to a one-year transfer restriction under Regulation Crowdfunding. No liquid market is anticipated post-restriction period.`,
    },
    {
      title: 'Intermediary Details',
      content: `Funding Portal: Loupt Portal LLC
SEC File Number: [Insert number]
CRD Number: [Insert number]`,
    },
    {
      title: 'Investor Rights',
      content: `Cancellation: Investment commitments may be canceled until 48 hours prior to offering completion.
Material Changes: Investors will receive notice of material changes and must reconfirm their commitments.
Progress Updates: Notifications will be provided at 50% and 100% completion milestones.
Deadline Changes: Investors will be notified of any accelerated offering deadlines.`,
    },
  ]

  const handleOpenDiscussion = () => {
    impact('light')
    setIsDiscussionOpen(true)
  }

  const handleCloseDiscussion = () => {
    setIsDiscussionOpen(false)
  }

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

          {/* Right: Discussion board icon */}
          <button
            onClick={handleOpenDiscussion}
            className="p-2.5 hover:bg-gray-100 rounded-lg transition-all duration-150 active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Discussion Board"
          >
            <MessageCircle className="w-6 h-6 text-gray-900" />
          </button>
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
              <Sprout className="w-11 h-11 text-white" />
            </div>

            {/* App Info */}
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">Ampel</h1>
              <p className="text-base text-gray-600">Your AI Company</p>
            </div>
          </div>

          {/* Description Section - Condensed */}
          <div>
            <p className="text-base text-gray-700 leading-relaxed">
              Ampel is a user-owned AI company. We've reserved 50% of our
              equity to share with users who help us grow by using our product,
              building a future where users meaningfully engage with and own the
              companies they help create value for.
            </p>
          </div>

          {/* Ownership Incentives Section */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Ownership Incentives
            </h2>
            <div className="space-y-3">
              {ownershipIncentives.map((card) => (
                <div
                  key={card.title}
                  className="bg-white border border-[#E5E3DD] rounded-xl p-4 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    {/* Left: Title and description */}
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {card.title}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {card.description}
                      </p>
                    </div>

                    {/* Right: Share numbers */}
                    <div className="flex-shrink-0 text-right">
                      <div className="text-3xl font-bold text-gray-900 leading-tight">
                        {card.shares}
                      </div>
                      <div className="text-xs text-gray-600 -mt-1">shares</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Disclosures Section */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">Disclosures</h2>
            <Accordion items={disclosureSections} />
          </div>
        </div>
      </main>

      {/* Discussion Board Modal */}
      <DiscussionBoard
        isOpen={isDiscussionOpen}
        onClose={handleCloseDiscussion}
      />
    </div>
  )
}
