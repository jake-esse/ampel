# Parallel Search API Integration - Implementation Plan

**Project:** Replace Grok's built-in search with Parallel Search API  
**Owner:** Claude Code (Developer)  
**PM:** Claude PM  
**Created:** October 30, 2025  
**Estimated Duration:** 4-6 hours

---

## PROJECT OVERVIEW

### What We're Building
Integration of Parallel's Search API to provide web search capabilities when users enable the "Web Search" toggle in Ampel's chat interface.

### Why We're Doing This
- **Cost Reduction:** 80-85% savings ($25/1k → $4/1k for search requests)
- **Better Control:** Separate search retrieval from LLM generation
- **Improved Architecture:** Clean separation of concerns
- **Performance:** Parallel returns compressed excerpts optimized for LLM consumption

### Success Metrics
- Search costs reduced by >80%
- No degradation in response quality
- Search latency <2 seconds added to total response time
- Zero breaking changes to existing non-search functionality

---

## CONTEXT & BACKGROUND

### Current Architecture

**Flow when user sends message with webSearch enabled:**
1. Client calls Supabase Edge Function: `POST /functions/v1/chat`
2. Request includes: `{ messages, reasoning, webSearch }`
3. Edge Function uses Vercel AI SDK to call Grok API
4. Grok handles search internally (expensive)
5. Response streams back to client
6. Client displays streamed response

**Current Cost:** $25 per 1,000 sources returned by Grok's search

### New Architecture

**Flow when user sends message with webSearch enabled:**
1. Client calls Supabase Edge Function: `POST /functions/v1/chat`
2. Request includes: `{ messages, reasoning, webSearch }`
3. **NEW:** If webSearch=true, Edge Function calls Parallel Search API first
4. **NEW:** Search results formatted and injected into Grok's system prompt
5. Edge Function uses Vercel AI SDK to call Grok API (with enhanced context)
6. Response streams back to client **with citation URLs appended**
7. **NEW:** Client parses citations and displays as source links

**New Cost:** $4 per 1,000 search requests + Grok inference cost

### Key Technical Details

**Where the work happens:**
- Backend: Supabase Edge Function at `supabase/functions/chat/index.ts`
- Frontend: React components in `src/components/chat/` and `src/lib/ai.ts`
- Database: Add `citations` column to `messages` table

**What stays the same:**
- Grok models (grok-2-fast-non-reasoning, grok-2-fast-reasoning)
- Streaming response mechanism
- Client-side message handling
- All non-search chat functionality

**What changes:**
- Edge Function adds Parallel Search API call before Grok
- Response stream includes citation URLs
- Client parses and displays citations
- Messages table stores citation URLs

---

## REQUIREMENTS

### Functional Requirements

**FR1: Search Integration**
- When webSearch=true, call Parallel Search API before calling Grok
- Use user's latest message as the search query
- Return 5 search results (default, cost-effective)
- Each result should return up to 2000 characters of excerpt

**FR2: Context Enhancement**
- Format search results into structured text for LLM
- Inject formatted results into Grok's system prompt
- Include instructions for Grok to cite sources using [Source N] format
- Maintain separate prompts for reasoning vs. non-reasoning modes

**FR3: Citation Delivery**
- Return citation URLs to client via stream markers
- Format: `__TOKENS__:N__CITATIONS__:["url1","url2",...]`
- Preserve existing `__TOKENS__:N` functionality
- Handle case where no citations exist (webSearch=false)

**FR4: Citation Display**
- Parse citation URLs from stream
- Store citations in message object
- Save citations to database with message
- Display citations as clickable source links below assistant messages
- Show domain name (not full URL) for better UX

**FR5: Error Handling**
- If Parallel Search API fails, continue without search results
- Log search API errors for monitoring
- Never crash entire chat request due to search failure
- Show user-friendly error if needed

**FR6: Backward Compatibility**
- All existing functionality must work unchanged
- Messages without citations display normally
- Historical conversations load correctly
- Non-search messages cost/behave identically to current

### Non-Functional Requirements

**NFR1: Performance**
- Search API call must complete in <5 seconds (Parallel's guarantee)
- Total latency increase <2 seconds when search enabled
- No performance impact when webSearch=false

**NFR2: Cost**
- Target: Reduce search costs by >80%
- Only call Parallel API when webSearch=true
- Use "base" processor (cost-effective for MVP)

**NFR3: Security**
- Store Parallel API key in Supabase secrets
- Never expose API key to client
- Citation links must open with security attributes (noopener, noreferrer)

**NFR4: Maintainability**
- Clean separation: search logic isolated from core chat logic
- Graceful degradation if search unavailable
- Easy to swap Parallel for alternative provider later

---

## IMPLEMENTATION PHASES

### PHASE 1: Backend - Supabase Edge Function Update
**Duration:** 2-3 hours  
**Files:** `supabase/functions/chat/index.ts`, `supabase/functions/chat/deno.json`

#### Step 1.1: Environment Setup
**Task:** Add Parallel API credentials to Supabase project

**What to do:**
1. Get Parallel API key from environment (will be provided separately)
2. Add to Supabase Edge Function secrets via dashboard or CLI
3. Verify secret is accessible in Edge Function

**Requirements:**
- Secret name: `PARALLEL_API_KEY`
- Verify existing secrets still work (XAI_API_KEY, etc.)

**Success criteria:**
- [ ] Parallel API key stored in Supabase secrets
- [ ] Edge Function can read PARALLEL_API_KEY from Deno.env

#### Step 1.2: Install Parallel SDK
**Task:** Add Parallel Web SDK to Edge Function dependencies

**What to do:**
1. Add `parallel-web` npm package to Edge Function's deno.json imports
2. Verify import works in Edge Function
3. Test that SDK initializes with API key

**Requirements:**
- Use latest stable version of `parallel-web` package
- Follow Deno Edge Function best practices for npm imports
- SDK should initialize once per function invocation (not per request)

**Success criteria:**
- [ ] parallel-web package imported successfully
- [ ] No dependency conflicts
- [ ] Edge Function deploys successfully with new dependency

#### Step 1.3: Implement Search Logic
**Task:** Add Parallel Search API call when webSearch=true

**What to do:**
1. Extract user's latest question from messages array
2. Call Parallel Search API with query
3. Format search results into structured text for LLM
4. Handle errors gracefully (continue without search if API fails)

**Requirements:**
- Only call search API when `webSearch: true` in request body
- Search query should be last user message content
- Use Parallel Search API settings:
  - `processor: "base"`
  - `max_results: 5`
  - `max_chars_per_result: 2000`
  - `objective: <user_query>` (natural language)
  - `search_queries: []` (let Parallel generate)
- Timeout: 10 seconds (fail gracefully after)
- Error handling: Log error, continue without search results

**Search result formatting:**
Format results as numbered list for LLM context:
```
[1] <title>
URL: <url>
<excerpts joined with spaces>

---

[2] <title>
URL: <url>
<excerpts>

...
```

**Success criteria:**
- [ ] Search API called only when webSearch=true
- [ ] User query extracted correctly from messages
- [ ] API returns 5 results with excerpts
- [ ] Results formatted as numbered list
- [ ] Errors logged but don't crash request
- [ ] Timeout prevents hanging requests

#### Step 1.4: Enhance System Prompt
**Task:** Inject search results into Grok's system prompt

**What to do:**
1. Determine which base prompt to use (reasoning vs. standard)
2. If search results exist, append them to system prompt
3. Add citation instructions for Grok
4. Ensure system message is first in messages array sent to Grok

**Requirements:**
- Base prompts:
  - Standard: "You are a helpful AI assistant. Be concise and accurate."
  - Reasoning: "You are an AI assistant that uses step-by-step reasoning. Think through problems carefully before answering."
- If search results exist, append:
  ```
  WEB SEARCH RESULTS:
  <formatted_results>
  
  Use these search results to inform your response. Cite sources using [Source N] format where N corresponds to the numbered sources above.
  ```
- System message must be role="system", first in array
- Remove any existing system messages from conversation history before adding new one

**Success criteria:**
- [ ] Correct base prompt selected based on reasoning flag
- [ ] Search results appended when present
- [ ] Citation instructions included
- [ ] System message positioned correctly in array
- [ ] No duplicate system messages

#### Step 1.5: Append Citations to Response Stream
**Task:** Add citation URLs to end of response stream

**What to do:**
1. After Grok's response completes streaming, append citation marker
2. Format: `__TOKENS__:N__CITATIONS__:["url1","url2",...]`
3. Maintain existing token count functionality
4. Handle case where no citations exist

**Requirements:**
- Current stream format: `<text>__TOKENS__:N`
- New format: `<text>__TOKENS__:N__CITATIONS__:["url1","url2",...]`
- If no search results: `<text>__TOKENS__:N` (unchanged)
- Citations must be valid JSON array of strings
- Citations should be URLs from Parallel search results
- Preserve exact order of search results (matches [Source N] numbers)

**Implementation notes:**
- Token marker comes first, then citations marker
- No newlines between markers
- Citations array should be compact JSON (no pretty printing)

**Success criteria:**
- [ ] Token count still extracted correctly
- [ ] Citations appended when search results exist
- [ ] Valid JSON format for citations array
- [ ] Citation URLs match search result URLs in order
- [ ] No citations marker when webSearch=false

#### Step 1.6: Testing & Validation
**Task:** Test Edge Function with various scenarios

**Test cases:**
1. **Standard chat (no search):**
   - Request: `{ messages: [...], reasoning: false, webSearch: false }`
   - Expected: Normal response, no Parallel API call, no citations marker
   
2. **Chat with search:**
   - Request: `{ messages: [...], reasoning: false, webSearch: true }`
   - Expected: Parallel API called, search context in prompt, citations returned
   
3. **Reasoning mode with search:**
   - Request: `{ messages: [...], reasoning: true, webSearch: true }`
   - Expected: Reasoning prompt + search context, citations returned
   
4. **Search API failure:**
   - Scenario: Parallel API returns error or times out
   - Expected: Chat continues without search, error logged
   
5. **Empty search results:**
   - Scenario: Parallel returns 0 results for query
   - Expected: Chat continues, no citations marker

**Success criteria:**
- [ ] All test cases pass
- [ ] No regressions in existing functionality
- [ ] Logs show Parallel API calls with timing
- [ ] Error handling works as expected
- [ ] Response format correct in all cases

---

### PHASE 2: Frontend - Client Updates
**Duration:** 2-3 hours  
**Files:** `src/lib/ai.ts`, `src/types/chat.ts`, `src/components/chat/ChatInterface.tsx`, `src/components/chat/MessageBubble.tsx`

#### Step 2.1: Update Type Definitions
**Task:** Add citations to Message type

**What to do:**
1. Open `src/types/chat.ts`
2. Add `citations` field to Message interface
3. Make it optional (for backward compatibility)
4. Add explicit `tokenCount` field (currently implicit)

**Requirements:**
- `citations?: string[]` - array of URL strings
- `tokenCount?: number` - make explicit
- Fields should be optional (not all messages have them)

**Success criteria:**
- [ ] TypeScript compiles with new fields
- [ ] No breaking changes to existing Message usage
- [ ] Types accurately reflect new data structure

#### Step 2.2: Update Stream Parsing
**Task:** Parse citations from stream markers

**What to do:**
1. Open `src/lib/ai.ts`
2. Update `StreamChatResult` interface to include citations promise
3. Modify stream parsing logic to extract citations marker
4. Handle cases: token only, token + citations, neither

**Requirements:**
- New return type: `{ textStream, tokenUsage, citations }`
- `citations` should be a Promise that resolves to string array
- Parse format: `__TOKENS__:N__CITATIONS__:["url1","url2"]`
- Handle missing citations marker (return empty array)
- Handle JSON parse errors gracefully (return empty array)
- Don't break if format is unexpected

**Parsing logic:**
1. Look for `__TOKENS__:` marker (existing)
2. Extract content after marker
3. Check if `__CITATIONS__:` exists in that content
4. If yes: split on citations marker, parse JSON
5. If no: return empty array for citations

**Success criteria:**
- [ ] Citations extracted correctly when present
- [ ] Empty array returned when citations absent
- [ ] Token parsing still works correctly
- [ ] Invalid JSON handled gracefully
- [ ] No crashes on malformed stream

#### Step 2.3: Handle Citations in ChatInterface
**Task:** Store and save citations with messages

**What to do:**
1. Open `src/components/chat/ChatInterface.tsx`
2. Destructure `citations` from `streamChatResponse` return value
3. Wait for citations promise to resolve after streaming
4. Update assistant message state with citations
5. Pass citations to `saveMessage` function

**Requirements:**
- Await both `tokenUsage` and `citations` promises after streaming
- Update message object with citations only if array is non-empty
- Pass citations to database save function
- Handle case where citations is empty array (don't add to message)

**Success criteria:**
- [ ] Citations received from stream
- [ ] Citations stored in message state
- [ ] Citations passed to save function
- [ ] Empty citations arrays not stored (undefined instead)
- [ ] No errors when citations missing

#### Step 2.4: Create Citations Display Component
**Task:** Build reusable component to show source links

**What to do:**
1. Create new file: `src/components/chat/MessageCitations.tsx`
2. Component should accept `citations: string[]` prop
3. Display each URL as clickable link
4. Extract and show domain name (not full URL)
5. Add appropriate icon (ExternalLink from lucide-react)
6. Style for mobile-first UX

**Requirements:**
- Return null if citations array is empty or undefined
- Show "Sources" label above links
- Each citation on its own line
- Links open in new tab with security attributes: `target="_blank" rel="noopener noreferrer"`
- Display domain name only (extract from URL)
- Handle invalid URLs gracefully
- Mobile-friendly: 44px min touch target height

**Visual design:**
- Section separated by top border (border-gray-100)
- Label: text-xs, gray-500, "Sources"
- Links: text-xs, primary-600, ExternalLink icon
- Hover state: underline, darker color
- Truncate long domain names with ellipsis

**Success criteria:**
- [ ] Component renders citations list
- [ ] Links are clickable and work correctly
- [ ] Domain names extracted and displayed
- [ ] Proper security attributes on links
- [ ] Mobile-friendly touch targets
- [ ] Graceful handling of invalid URLs
- [ ] Component is reusable

#### Step 2.5: Integrate Citations into MessageBubble
**Task:** Display citations below assistant messages

**What to do:**
1. Open `src/components/chat/MessageBubble.tsx`
2. Import MessageCitations component
3. Render citations below message content (only for assistant messages)
4. Only render if message has citations

**Requirements:**
- Citations only shown for assistant role messages
- Rendered after message content, before any metadata
- Only rendered if `message.citations` exists and is non-empty
- Proper spacing/padding between content and citations

**Success criteria:**
- [ ] Citations display below assistant messages
- [ ] Not shown for user messages
- [ ] Not shown when citations undefined/empty
- [ ] Proper visual hierarchy and spacing
- [ ] No layout shifts or jumps

#### Step 2.6: Testing & Validation
**Task:** Test citation display with various scenarios

**Test cases:**
1. **Message without search:**
   - Send message with webSearch=false
   - Expected: No citations displayed
   
2. **Message with search:**
   - Send message with webSearch=true
   - Expected: Citations displayed below response with clickable links
   
3. **Multiple citations:**
   - Verify all URLs rendered as separate links
   - Expected: 5 source links (matching search results)
   
4. **Citation click:**
   - Click citation link
   - Expected: Opens in new tab, correct URL
   
5. **Mobile display:**
   - View on mobile device / narrow viewport
   - Expected: Citations responsive, proper touch targets
   
6. **Historical messages:**
   - Load conversation with existing citations
   - Expected: Citations display correctly from database

**Success criteria:**
- [ ] All test cases pass
- [ ] Citations display correctly
- [ ] Links work as expected
- [ ] Mobile UX is good
- [ ] No layout issues

---

### PHASE 3: Database - Schema Update
**Duration:** 30 minutes  
**Files:** New migration in `supabase/migrations/`

#### Step 3.1: Create Migration
**Task:** Add citations column to messages table

**What to do:**
1. Create new migration file in `supabase/migrations/`
2. Add `citations` column to `messages` table
3. Make column nullable (backward compatibility)
4. Add GIN index for array queries (optional, for future search)

**Requirements:**
- Column name: `citations`
- Type: `TEXT[]` (PostgreSQL text array)
- Nullable: `DEFAULT NULL`
- No default value needed
- Index: Consider adding for performance if querying by citations later

**Migration should be safe:**
- Non-blocking (nullable column)
- Backward compatible (existing rows have null)
- No data migration needed

**Success criteria:**
- [ ] Migration file created
- [ ] Migration runs successfully on local Supabase
- [ ] Existing data unaffected
- [ ] New column accessible from Edge Function

#### Step 3.2: Update saveMessage Function
**Task:** Save citations to database

**What to do:**
1. Open `src/lib/database/messages.ts`
2. Add `citations` parameter to `saveMessage` function
3. Include citations in database insert
4. Update return type if needed

**Requirements:**
- New parameter: `citations?: string[]`
- Optional parameter (default undefined)
- Insert null if citations undefined or empty array
- Otherwise insert array as-is

**Success criteria:**
- [ ] Function accepts citations parameter
- [ ] Citations saved to database correctly
- [ ] Null saved when citations empty/undefined
- [ ] Function still works when citations not provided

#### Step 3.3: Update loadMessages / Conversion
**Task:** Load citations from database

**What to do:**
1. Open `src/lib/database/messages.ts`
2. Update `convertDbMessageToFrontend` function
3. Map database citations to Message type
4. Handle null values

**Requirements:**
- Database citations column may be null or TEXT[]
- Convert null to undefined (for TypeScript)
- Convert TEXT[] to string[]
- Preserve array order

**Success criteria:**
- [ ] Citations loaded from database
- [ ] Null values handled correctly
- [ ] Array values converted properly
- [ ] Message type matches expectations

---

## PROGRESS TRACKING

### Implementation Checklist

**PHASE 1: Backend (Edge Function)**
- [ ] 1.1: Parallel API key added to Supabase secrets
- [ ] 1.2: parallel-web package installed and imported
- [ ] 1.3: Search logic implemented and tested
- [ ] 1.4: System prompt enhancement working
- [ ] 1.5: Citations appended to stream correctly
- [ ] 1.6: All backend test cases pass

**PHASE 2: Frontend (React Client)**
- [ ] 2.1: Message type updated with citations field
- [ ] 2.2: Stream parsing extracts citations
- [ ] 2.3: ChatInterface handles citations
- [ ] 2.4: MessageCitations component created
- [ ] 2.5: Citations integrated into MessageBubble
- [ ] 2.6: All frontend test cases pass

**PHASE 3: Database**
- [ ] 3.1: Migration created and applied
- [ ] 3.2: saveMessage updated to accept citations
- [ ] 3.3: loadMessages returns citations correctly

**FINAL VALIDATION**
- [ ] End-to-end test: search → stream → save → display
- [ ] No regressions in existing functionality
- [ ] Performance targets met (<2s added latency)
- [ ] Error handling verified
- [ ] Mobile UX tested
- [ ] Ready for production deployment

### Notes & Issues Log

Use this section to track any issues, decisions, or notes during implementation:

```
Date: 
Issue: 
Resolution: 
---
```

---

## TESTING & VALIDATION

### Test Environments

**Local Development:**
- Test against local Supabase instance
- Use Parallel API test key (if available) or production key
- Test on browser and iOS simulator

**Production Validation:**
- Deploy to staging environment first
- Test with real API keys
- Monitor costs in Parallel dashboard

### Critical Test Scenarios

**1. Basic Functionality**
- [ ] Chat without search works (no regression)
- [ ] Chat with search works (new functionality)
- [ ] Citations display correctly
- [ ] Citations are clickable and open correct URLs

**2. Edge Cases**
- [ ] Empty search results handled
- [ ] Parallel API timeout/error handled
- [ ] Malformed stream parsing handled
- [ ] Very long URLs display correctly
- [ ] Special characters in URLs work

**3. Performance**
- [ ] Search adds <2s to response time
- [ ] No memory leaks in long conversations
- [ ] Mobile device performance acceptable

**4. Cost Validation**
- [ ] Parallel API only called when webSearch=true
- [ ] Request count matches expectations
- [ ] Parallel dashboard shows correct usage

**5. User Experience**
- [ ] Citations visually clear and readable
- [ ] Mobile touch targets work well
- [ ] Loading states are clear
- [ ] Error messages user-friendly

### Acceptance Criteria (Final Sign-off)

Before considering this complete:
- [ ] All checklist items completed
- [ ] All test scenarios pass
- [ ] Cost savings verified (>80% reduction)
- [ ] No performance degradation
- [ ] Mobile UX approved
- [ ] Error handling robust
- [ ] Code reviewed and clean
- [ ] Documentation updated

---

## TECHNICAL REFERENCE

### Parallel Search API Documentation

**Base URL:** `https://api.parallel.ai/v1beta/search`

**Authentication:** Header `x-api-key: YOUR_API_KEY`

**Rate Limits:** 600 requests per minute (beta)

**Request Format:**
```json
{
  "objective": "Natural language search objective",
  "search_queries": ["optional", "keyword", "queries"],
  "processor": "base",
  "max_results": 5,
  "max_chars_per_result": 2000
}
```

**Response Format:**
```json
{
  "search_id": "search_abc123",
  "results": [
    {
      "url": "https://example.com/page",
      "title": "Page Title",
      "excerpts": [
        "Relevant excerpt 1...",
        "Relevant excerpt 2..."
      ]
    }
  ]
}
```

**TypeScript SDK Example:**
```typescript
import Parallel from "parallel-web"

const client = new Parallel({ apiKey: process.env.PARALLEL_API_KEY })

const search = await client.beta.search({
  objective: "When was the United Nations established?",
  processor: "base",
  max_results: 5,
  max_chars_per_result: 2000
})

// Returns array of results with url, title, excerpts
```

**Error Handling:**
- 401: Invalid API key
- 429: Rate limit exceeded
- 500: Server error
- Timeout: No response after 10 seconds

**Best Practices:**
- Use natural language for `objective` field
- Leave `search_queries` empty to let Parallel optimize
- Use "base" processor for cost-effective searches
- Handle errors gracefully (don't crash on search failure)

### Current System Architecture

**Tech Stack:**
- Frontend: Vite + React 19 + TypeScript
- Mobile: Capacitor 7
- Backend: Supabase (Edge Functions, Database)
- AI: Grok models via Vercel AI SDK (@ai-sdk/xai)

**Key Files:**
- `supabase/functions/chat/index.ts` - Edge Function handling chat requests
- `src/lib/ai.ts` - Client-side streaming logic
- `src/lib/database/messages.ts` - Message persistence
- `src/components/chat/ChatInterface.tsx` - Main chat component
- `src/components/chat/MessageBubble.tsx` - Individual message display

**Current Grok Models:**
- Standard: `grok-2-fast-non-reasoning`
- Reasoning: `grok-2-fast-reasoning`

**Environment Variables:**
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key (client-side)
- `XAI_API_KEY` - xAI API key (Edge Function)
- `PARALLEL_API_KEY` - Parallel API key (Edge Function) - NEW

**Database Schema (messages table):**
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  tokens INTEGER,
  citations TEXT[],  -- NEW
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Stream Format Specification

**Current Format (no search):**
```
Hello, I can help you with that.<streaming continues>

Some more text here.

__TOKENS__:142
```

**New Format (with search):**
```
Based on the sources, the UN was founded in 1945 [Source 1].<streaming continues>

Additional information from [Source 2].

__TOKENS__:142__CITATIONS__:["https://un.org/history","https://history.state.gov/un"]
```

**Parsing Rules:**
1. Stream text until you encounter `__TOKENS__:`
2. Everything before marker is message content
3. Extract integer after `__TOKENS__:` for token count
4. Check if `__CITATIONS__:` follows
5. If yes, parse JSON array after `__CITATIONS__:`
6. If no, citations are empty array

**Important:** Markers have no newlines between them, they're concatenated directly.

### Component Design Requirements

**MessageCitations Component:**
- Props: `{ citations: string[] }`
- Renders: List of source links with icons
- Behavior: Opens links in new tab
- Style: Mobile-first, proper touch targets
- Accessibility: Proper link semantics

**Display Specifications:**
- Border top: 1px, gray-100
- Padding top: 12px
- Margin top: 12px
- Label: "Sources", text-xs, gray-500
- Links: text-xs, primary-600, ExternalLink icon
- Link hover: underline, primary-700
- Gap between links: 6px
- Extract domain from URL for display
- Truncate long domains with ellipsis

### Error Messages

**User-Facing Errors:**
- Search unavailable: "Web search is temporarily unavailable. Answering based on my knowledge."
- API error: "Unable to search the web right now. I'll answer based on what I know."

**Logged Errors (not shown to user):**
- "Parallel Search API error: [status] [message]"
- "Search API timeout after 10s"
- "Failed to parse citations from stream: [error]"

### Performance Targets

**Latency:**
- Search API call: <5 seconds (Parallel guarantee)
- Total added latency: <2 seconds to user-perceived response time
- First token still arrives quickly (while search runs)

**Memory:**
- No memory leaks in stream parsing
- Citations stored efficiently (small arrays of strings)
- No impact on large conversation histories

**Cost:**
- Target: >80% cost reduction vs. current
- Parallel Search: $4 per 1,000 requests
- Monitor actual costs in Parallel dashboard

### Rollout Plan

**Phase 1: Development** (this plan)
- Implement on local development environment
- Test thoroughly with various scenarios
- Validate cost savings with small test set

**Phase 2: Staging**
- Deploy to staging Supabase project
- Test with real API keys
- Monitor performance and costs
- QA on actual mobile devices

**Phase 3: Production**
- Deploy to production
- Monitor error rates and latency
- Track cost metrics
- Gradual rollout if possible (feature flag?)

**Rollback Plan:**
- Keep feature flag to disable search if needed
- Can revert Edge Function deployment
- Database column is additive (safe to keep)

### Support & Resources

**Parallel Documentation:**
- Search API: https://docs.parallel.ai/search-api/search-quickstart
- API Reference: https://docs.parallel.ai/

**Parallel Support:**
- Email: support@parallel.ai
- Dashboard: https://platform.parallel.ai/

**Internal Resources:**
- PM: Claude PM
- Code reviews: [Process TBD]
- Deployment: [Process TBD]

---

## GETTING STARTED

**To begin implementation:**

1. Read this entire document thoroughly
2. Set up Parallel API credentials
3. Start with Phase 1, Step 1.1
4. Check off items in Progress Tracking as you complete them
5. Run tests after each phase
6. Document any issues or decisions in Notes & Issues Log
7. Request review after Phase 1 complete, before moving to Phase 2

**Questions or blockers?**
- Document in Notes & Issues Log
- Escalate to PM if blocking progress

---

**END OF IMPLEMENTATION PLAN**