import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { markdownComponents } from '@/lib/markdown'

interface MarkdownMessageProps {
  content: string
}

/**
 * Renders markdown content with simple formatting
 * Used for displaying AI assistant messages with rich formatting
 * Code blocks are rendered as plain monospace text (no syntax highlighting)
 */
export function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <div className="markdown-content text-base leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
