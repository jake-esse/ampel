import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Accordion } from '@/components/ui/Accordion';

const DISCLOSURE_SECTIONS = [
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
];

export function Disclosures() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [acknowledged, setAcknowledged] = useState(false);
  const [loading, setLoading] = useState(false);

  // No need to check auth here - ProtectedRoute wrapper already handles it
  // This prevents infinite redirect loops

  const handleContinue = async () => {
    if (!acknowledged || !user) return;

    setLoading(true);

    try {
      // Update the user's profile with the current timestamp
      const { error } = await supabase
        .from('profiles')
        .update({ disclosures_accepted_at: new Date().toISOString() })
        .eq('id', user.id);

      if (error) throw error;

      // Add a small delay to ensure database replication completes
      // This prevents the ProtectedRoute from fetching stale data
      await new Promise(resolve => setTimeout(resolve, 500));

      // Navigate to chat with state indicating disclosures were just accepted
      navigate('/chat', { state: { disclosuresAccepted: true } });
    } catch (error) {
      console.error('Error accepting disclosures:', error);
      // Silently handle error - user can retry by clicking continue again
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="h-screen bg-[#FDFCFA] overflow-y-auto"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-serif font-semibold text-gray-900 mb-2 text-center">
            Please review the below information to receive your shares.
          </h1>
        </div>

        {/* Accordion Sections */}
        <div className="mb-6">
          <Accordion items={DISCLOSURE_SECTIONS} />
        </div>

        {/* Acknowledgment Checkbox */}
        <div className="bg-white border border-[#E5E3DD] rounded-xl p-4 mb-4">
          <label className="flex items-start gap-3 cursor-pointer min-h-[44px]">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-2 focus:ring-primary-600 focus:ring-offset-0 cursor-pointer flex-shrink-0"
            />
            <span className="text-sm text-gray-900 leading-relaxed select-none font-semibold">
              I have reviewed and understand the above information
            </span>
          </label>
        </div>

        {/* Continue Button */}
        <button
          onClick={handleContinue}
          disabled={!acknowledged || loading}
          className={`w-full px-4 py-3 rounded-xl font-medium text-base transition-all duration-150 min-h-[48px] ${
            acknowledged && !loading
              ? 'bg-[#30302E] hover:bg-primary-700 text-white active:scale-[0.98]'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {loading ? 'Saving...' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
