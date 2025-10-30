interface MessageCitationsProps {
  citations: string[]
}

/**
 * Displays citation source links below AI messages
 * Compact horizontal chip design with numbered badges
 */
export function MessageCitations({ citations }: MessageCitationsProps) {
  // Return null if no citations provided
  if (!citations || citations.length === 0) {
    return null
  }

  /**
   * Extract clean domain name from URL for display
   * Removes www. and common TLDs (.com, .org, .net, etc.)
   */
  function getDomainFromUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      let domain = urlObj.hostname.replace('www.', '')

      // Remove common TLDs for cleaner display
      domain = domain.replace(/\.(com|org|net|edu|gov|co\.uk|io|ai|dev)$/, '')

      return domain
    } catch {
      // Invalid URL, return truncated version
      return url.length > 30 ? url.substring(0, 30) + '...' : url
    }
  }

  return (
    <div className="mt-4 pt-3 border-t border-[#E5E3DD]">
      {/* Sources label - smaller and more subtle */}
      <div className="text-xs font-medium text-gray-500 mb-2">Sources</div>

      {/* Citation chips - horizontal flow layout */}
      <div className="flex flex-wrap gap-2">
        {citations.map((url, index) => (
          <a
            key={index}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F2F1ED] hover:bg-[#E8E6E1] border border-[#E5E3DD] rounded-full transition-all duration-150 active:scale-95"
          >
            {/* Numbered badge */}
            <span className="flex items-center justify-center w-4 h-4 text-[10px] font-semibold text-white bg-primary-600 rounded-full flex-shrink-0">
              {index + 1}
            </span>

            {/* Domain name */}
            <span className="text-xs text-gray-700 font-semibold max-w-[140px] truncate">
              {getDomainFromUrl(url)}
            </span>
          </a>
        ))}
      </div>
    </div>
  )
}
