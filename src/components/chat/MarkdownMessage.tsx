import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { markdownComponents } from '@/lib/markdown'

interface MarkdownMessageProps {
  content: string
  citations?: string[]
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

/**
 * Convert citation references like "[Source 1]" or "[1]" to markdown links
 * Uses domain names from URLs for more natural inline citations
 */
function preprocessCitations(content: string, citations?: string[]): string {
  if (!citations || citations.length === 0) {
    return content
  }

  // Replace patterns like [Source 1], [Source 2], etc. with markdown links showing domain
  let processed = content.replace(
    /\[Source (\d+)\]/g,
    (match, num) => {
      const index = parseInt(num, 10) - 1
      if (index >= 0 && index < citations.length) {
        const domain = getDomainFromUrl(citations[index])
        return `[${domain}](${citations[index]})`
      }
      return match // Keep original if invalid index
    }
  )

  // Also replace patterns like [1], [2] that are likely citation references
  // But be careful not to replace list items or other bracket numbers
  // Only replace if preceded by space or punctuation
  processed = processed.replace(
    /(\s|^)\[(\d+)\](?!\()/g,
    (match, prefix, num) => {
      const index = parseInt(num, 10) - 1
      if (index >= 0 && index < citations.length) {
        const domain = getDomainFromUrl(citations[index])
        return `${prefix}[${domain}](${citations[index]})`
      }
      return match // Keep original if invalid index
    }
  )

  return processed
}

/**
 * Renders markdown content with simple formatting
 * Used for displaying AI assistant messages with rich formatting
 * Automatically converts citation references to clickable links
 */
export function MarkdownMessage({ content, citations }: MarkdownMessageProps) {
  // Preprocess content to convert citation references to markdown links
  const processedContent = preprocessCitations(content, citations)

  return (
    <div className="markdown-content text-xl">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={markdownComponents}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  )
}
