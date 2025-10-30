/**
 * Markdown rendering configuration for chat messages
 * Configures react-markdown with syntax highlighting and security
 */

import type { Components } from 'react-markdown'
import { ExternalLink } from 'lucide-react'

/**
 * Custom components for markdown rendering
 * Configures links to open in new tab and adds security attributes
 */
export const markdownComponents: Components = {
  // Links should open in new tab with security attributes
  // Citation links (short domain names) are styled as chips
  // Regular links have underline with external icon
  a: ({ node, ...props }) => {
    // Check if this looks like a citation link (short domain name)
    const linkText = String(props.children || '')
    const isCitation =
      linkText.length > 0 &&
      linkText.length < 30 &&
      !linkText.includes(' ') &&
      !linkText.startsWith('http')

    if (isCitation) {
      // Citation link - styled as compact chip
      return (
        <a
          {...props}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 bg-[#F2F1ED] hover:bg-[#E8E6E1] border border-[#E5E3DD] rounded-full transition-all duration-150 active:scale-95 text-xs font-semibold text-gray-700 no-underline whitespace-nowrap align-middle"
        >
          {props.children}
        </a>
      )
    }

    // Regular markdown link - underlined with icon
    return (
      <a
        {...props}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-baseline gap-1 text-primary-600 hover:text-primary-700 underline underline-offset-2 decoration-1 hover:decoration-2 transition-all duration-150 break-words font-medium"
      >
        {props.children}
        <ExternalLink className="inline-block w-3.5 h-3.5 flex-shrink-0 mb-0.5" />
      </a>
    )
  },

  // Pre blocks - filter out indented code blocks, only allow fenced blocks
  pre: ({ node, children, ...props }) => {
    // Check if this pre contains a code element with a language class
    // Fenced code blocks have: <pre><code className="language-xxx">
    // Indented code blocks have: <pre><code> (no language class)

    const codeChild = children as any
    const hasLanguageClass =
      codeChild?.props?.className?.startsWith('language-')

    // If no language class, this is an indented code block - render as plain text
    if (!hasLanguageClass) {
      return <div className="whitespace-pre-wrap">{children}</div>
    }

    // This is a fenced code block - render as code
    return (
      <pre {...props} className="bg-gray-100 text-gray-800 p-4 rounded-lg my-3 overflow-x-auto">
        {children}
      </pre>
    )
  },

  // Code - inline only (block code is handled by pre)
  code: ({ node, className, children, ...props }) => {
    // If it has a language class, it's a fenced code block (render as-is for pre wrapper)
    if (className?.startsWith('language-')) {
      return (
        <code {...props} className="font-mono text-sm">
          {children}
        </code>
      )
    }

    // Otherwise it's inline code
    return (
      <code
        {...props}
        className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono"
      >
        {children}
      </code>
    )
  },

  // Paragraphs
  p: ({ node, ...props }) => (
    <p {...props} className="mb-3 last:mb-0 leading-relaxed" />
  ),

  // Headings
  h1: ({ node, ...props }) => (
    <h1 {...props} className="text-3xl font-serif font-bold mb-4 mt-5 first:mt-0" />
  ),
  h2: ({ node, ...props }) => (
    <h2 {...props} className="text-2xl font-serif font-semibold mb-3 mt-4 first:mt-0" />
  ),
  h3: ({ node, ...props }) => (
    <h3 {...props} className="text-xl font-serif font-semibold mb-3 mt-4 first:mt-0" />
  ),
  h4: ({ node, ...props }) => (
    <h4 {...props} className="text-lg font-sans font-semibold mb-2 mt-3 first:mt-0" />
  ),
  h5: ({ node, ...props }) => (
    <h5 {...props} className="text-base font-sans font-semibold mb-2 mt-3 first:mt-0" />
  ),
  h6: ({ node, ...props }) => (
    <h6 {...props} className="text-sm font-sans font-medium mb-2 mt-2 first:mt-0" />
  ),

  // Lists
  ul: ({ node, ...props }) => (
    <ul {...props} className="list-disc list-inside mb-3 space-y-1" />
  ),
  ol: ({ node, ...props }) => (
    <ol {...props} className="list-decimal list-inside mb-3 space-y-1" />
  ),
  li: ({ node, ...props }) => <li {...props} className="leading-relaxed" />,

  // Block quotes
  blockquote: ({ node, ...props }) => (
    <blockquote
      {...props}
      className="border-l-4 border-gray-600 pl-4 py-1 my-3 italic font-serif text-gray-600"
    />
  ),

  // Horizontal rule
  hr: ({ node, ...props }) => (
    <hr {...props} className="border-gray-700 my-4" />
  ),

  // Tables
  table: ({ node, ...props }) => (
    <div className="overflow-x-auto mb-3">
      <table {...props} className="min-w-full border-collapse" />
    </div>
  ),
  thead: ({ node, ...props }) => (
    <thead {...props} className="bg-gray-800" />
  ),
  tbody: ({ node, ...props }) => <tbody {...props} />,
  tr: ({ node, ...props }) => (
    <tr {...props} className="border-b border-gray-700" />
  ),
  th: ({ node, ...props }) => (
    <th {...props} className="px-3 py-2 text-left font-semibold" />
  ),
  td: ({ node, ...props }) => <td {...props} className="px-3 py-2" />,

  // Strong (bold)
  strong: ({ node, ...props }) => <strong {...props} className="font-semibold" />,

  // Emphasis (italic)
  em: ({ node, ...props }) => <em {...props} className="italic font-serif" />,
}
