# Simplify Authentication: Social-Only with Referral Code Persistence

**STATUS:** 🟡 Not Started  
**PRIORITY:** High - MVP Critical  
**ESTIMATED TIME:** 4-6 hours  
**ASSIGNED TO:** Claude Code

---

## 📋 Implementation Progress Tracker

**INSTRUCTIONS FOR CLAUDE CODE:**
After completing each phase, update the checkboxes below and add completion notes with timestamps.

### Phase 1: Simplify Login UI (Social-Only)
- [ ] Remove email/password form from Login.tsx
- [ ] Remove sign in/sign up mode toggle
- [ ] Remove email focus animation logic
- [ ] Keep referral code input (make always visible)
- [ ] Update layout to mobile-first social buttons
- [ ] Test: Login page renders with social buttons + referral field

**Completion Notes:**
```
[Add timestamp and any notes after completion]
```

---

### Phase 2: Implement Referral Code Persistence (Tier 1)
- [ ] Add localStorage save before OAuth redirect
- [ ] Add error handling for localStorage failures
- [ ] Add user feedback if localStorage fails
- [ ] Test: Referral code survives OAuth redirect
- [ ] Test: localStorage is cleaned up after processing

**Completion Notes:**
```
[Add timestamp and any notes after completion]
```

---

### Phase 3: Process Referral Code Post-Auth (Tier 1)
- [ ] Update useAuth.ts to listen for SIGNED_IN event
- [ ] Retrieve referral code from localStorage after auth
- [ ] Update profile with referral_code_used
- [ ] Clean up localStorage after processing
- [ ] Add error handling (graceful failure)
- [ ] Test: Code applied to profile after OAuth
- [ ] Test: Works for both new users and returning users

**Completion Notes:**
```
[Add timestamp and any notes after completion]
```

---

### Phase 4: Add URL Parameter Fallback (Tier 2)
- [ ] Update signInWithOAuth to accept referralCode option
- [ ] Encode referral code in OAuth state parameter
- [ ] Decode state parameter in auth callback
- [ ] Use state parameter as fallback if localStorage failed
- [ ] Test: Fallback works when localStorage disabled
- [ ] Test: localStorage takes precedence when both exist

**Completion Notes:**
```
[Add timestamp and any notes after completion]
```

---

### Phase 5: Remove Email Auth Infrastructure
- [ ] Delete src/lib/auth/email.ts file
- [ ] Remove email auth imports from useAuth.ts
- [ ] Remove signUp and signIn methods from useAuth hook
- [ ] Update UseAuthReturn interface
- [ ] Test: OAuth still works after cleanup
- [ ] Test: No TypeScript errors

**Completion Notes:**
```
[Add timestamp and any notes after completion]
```

---

### Phase 6: Create Settings Page
- [ ] Create src/pages/Settings.tsx
- [ ] Add route to App.tsx
- [ ] Wire settings button in Drawer.tsx
- [ ] Fetch user profile data
- [ ] Display user email and auth provider
- [ ] Display subscription tier
- [ ] Display shares balance
- [ ] Add sign out button
- [ ] Test: Navigation to/from settings works
- [ ] Test: Data loads correctly

**Completion Notes:**
```
[Add timestamp and any notes after completion]
```

---

### Phase 7: Add Referral Code Management to Settings
- [ ] Add read-only "Your Referral Code" section
- [ ] Add "Code You Used" section (conditional display)
- [ ] Add "Enter Referral Code" section (conditional on no code used)
- [ ] Implement referral code submission
- [ ] Add validation for referral code format
- [ ] Call applyReferralCode() function
- [ ] Show success/error feedback
- [ ] Update UI after successful submission
- [ ] Test: Can view own referral code
- [ ] Test: Can enter code if none used
- [ ] Test: Shows used code after entry
- [ ] Test: Validation works correctly
- [ ] Test: Error handling works

**Completion Notes:**
```
[Add timestamp and any notes after completion]
```

---

### Phase 8: Update Type Definitions
- [ ] Update auth_provider type in database.ts
- [ ] Remove 'email' from union type
- [ ] Test: TypeScript compiles without errors
- [ ] Test: No type errors in codebase

**Completion Notes:**
```
[Add timestamp and any notes after completion]
```

---

### Phase 9: Cross-Platform Testing
- [ ] Test OAuth without referral (iOS)
- [ ] Test OAuth with referral (iOS)
- [ ] Test OAuth without referral (Android)
- [ ] Test OAuth with referral (Android)
- [ ] Test OAuth without referral (Web)
- [ ] Test OAuth with referral (Web)
- [ ] Test settings page (all platforms)
- [ ] Test referral code entry (all platforms)
- [ ] Test localStorage failure scenario
- [ ] Test returning user flow

**Completion Notes:**
```
[Add timestamp and any notes after completion]
```

---

## 🎯 Project Context

### What We're Building
Ampel is a native mobile AI chat application built with Vite + React + TypeScript + Capacitor 7. We're currently in Phase 5 (UI refinement) preparing for MVP launch.

### Current Authentication State
**What Exists:**
- ✅ Email/password authentication (fully implemented)
- ✅ Apple + Google OAuth (working with native Capacitor plugins)
- ✅ Referral code field in signup form
- ✅ Onboarding flow that processes referral codes
- ✅ Equity/shares system tied to referrals

**What's Wrong:**
- ❌ Email auth requires email verification setup (Resend/SendGrid)
- ❌ Email auth adds 6-8 hours of setup + testing
- ❌ Email auth is worse UX on mobile (typing passwords)
- ❌ Referral code gets lost during OAuth redirects

### Why We're Changing This
1. **Faster to Ship:** Remove 6-8 hours of email verification work
2. **Better Mobile UX:** One-tap native sign-in with Face ID/Touch ID
3. **Simpler Codebase:** Less auth code to maintain
4. **Industry Standard:** Most mobile apps are social-only
5. **Referral Code Reliability:** Persist codes through OAuth with fallback

---

## 📊 Technical Architecture

### Tech Stack
- **Frontend:** Vite 7 (Rolldown) + React 19 + TypeScript
- **Native Shell:** Capacitor 7
- **Backend:** Supabase (auth, database, realtime)
- **Styling:** Tailwind CSS

### Database Schema (Profiles Table)
```typescript
type Profile = {
  id: string                          // FK to auth.users
  username: string | null
  display_name: string | null
  avatar_url: string | null
  auth_provider: 'email' | 'apple' | 'google'  // Will change to remove 'email'
  created_at: string
  
  // Referral fields
  referral_code: string               // User's own code (auto-generated)
  referred_by: string | null          // ID of user who referred them
  referral_code_used: string | null   // Code they entered
  
  // Other fields...
  shares_balance: number
  selected_subscription_tier: string | null
  onboarding_completed_at: string | null
}
```

### File Structure
```
src/
├── pages/
│   ├── Login.tsx              # Auth entry point - MODIFY
│   └── Settings.tsx           # New settings page - CREATE
├── lib/
│   └── auth/
│       ├── email.ts           # Email auth functions - DELETE
│       ├── oauth.ts           # OAuth functions - MODIFY
│       └── profile.ts         # Profile management - USE
├── hooks/
│   └── useAuth.ts             # Auth hook - MODIFY
├── components/
│   └── layout/
│       └── Drawer.tsx         # Navigation drawer - MODIFY
├── types/
│   └── database.ts            # Type definitions - MODIFY
└── App.tsx                    # Route configuration - MODIFY
```

---

## 🔧 Technical Approach: Referral Code Persistence

### The Challenge
OAuth redirects cause the page to leave and return, losing React state. The referral code entered before OAuth must survive this redirect.

### The Solution: Two-Tier Approach

#### **Tier 1: localStorage (Primary Method)**
- Covers 95%+ of use cases
- Simple, proven pattern
- Works on web and native (Capacitor)

**Flow:**
```
1. User enters referral code on login page
2. User clicks "Sign in with Apple"
3. → Save code to localStorage
4. → OAuth redirect happens (page leaves)
5. → User authenticates with Apple
6. → Redirect back to app
7. → useAuth detects SIGNED_IN event
8. → Retrieve code from localStorage
9. → Apply to profile (referral_code_used)
10. → Clean up localStorage
```

#### **Tier 2: URL State Parameter (Fallback)**
- Covers edge cases where localStorage fails
- Adds ~4% reliability
- Uses OAuth state parameter

**Flow:**
```
1. User enters referral code
2. User clicks "Sign in with Apple"
3. → Try localStorage (may fail)
4. → ALSO encode code in OAuth state parameter
5. → OAuth redirect with state
6. → Return with state in callback
7. → Decode state parameter
8. → Use state as fallback if localStorage failed
9. → Apply to profile
```

**Combined Reliability: 99%+**

### Settings Page Referral Management
For the remaining ~1% and for users who skip it initially:

**Settings Page Features:**
1. **Display User's Own Code:** Show referral_code (read-only, shareable)
2. **Show Code Used:** Display referral_code_used if exists
3. **Enter Code (Conditional):** Only show if referral_code_used is null
4. **Manual Entry:** Call applyReferralCode() function (already exists)

This ensures **100% of users can get referral benefits.**

---

## 📝 Detailed Requirements

### Phase 1: Simplify Login UI

**OBJECTIVE:** Transform login page from email+social to social-only

**Current Login.tsx Structure:**
```
[Logo/Branding with collapse animation]
[Social buttons: Apple + Google]
[Divider: "or"]
[Email/Password Form with expansion]
  - Email input (always visible)
  - Password input (expands on email focus)
  - Referral code (only for signup mode)
  - Submit button
[Mode toggle: Sign in ↔ Sign up]
```

**New Structure:**
```
[Logo/Branding]
[Referral Code Input] (always visible, optional)
[Sign in with Apple]
[Sign in with Google]
```

**Specific Changes:**

1. **Remove:**
   - Email input field
   - Password input field
   - Form submission handler (`handleEmailAuth`)
   - Email focus handler (`handleEmailFocus`)
   - Email focus animation state
   - Form expansion animation logic
   - Sign in/Sign up mode state
   - Mode toggle button
   - Divider ("or" text)

2. **Keep:**
   - Logo/branding section
   - Social auth buttons (Apple + Google)
   - OAuth handler (`handleOAuthSignIn`)
   - Loading states
   - Error handling

3. **Modify:**
   - Referral code input: Always visible (not conditional on mode)
   - Referral code input: Keep validation logic
   - Layout: Clean, centered, mobile-first

**UI/UX Requirements:**
- Maintain current design language (cream background #FDFCFA, rounded buttons)
- Keep haptic feedback on button presses
- Preserve loading spinners and states
- Maintain accessibility (min-height 44px for touch targets)
- Use existing typography (DM Sans)

---

### Phase 2: Implement Referral Code Persistence (Tier 1)

**OBJECTIVE:** Save referral code to localStorage before OAuth redirect

**File:** `src/pages/Login.tsx`

**Implementation Points:**

1. **Before OAuth Redirect:**
   - Check if referralCode has a value
   - Trim and uppercase the code
   - Save to localStorage with key: `pending_referral_code`
   - Add try/catch for storage errors

2. **Error Handling:**
   - Catch localStorage failures (private browsing, quota exceeded, disabled)
   - Show toast notification if save fails
   - Continue with OAuth anyway (don't block auth)

3. **User Feedback:**
   - Success: No message (silent)
   - Failure: Toast warning: "Note: Referral code may not be saved. You can enter it in Settings later."

**Pseudocode Structure:**
```typescript
const handleOAuthSignIn = async (provider) => {
  setLoading(true)
  
  // Save referral code if provided
  if (referralCode && referralCode.trim()) {
    try {
      const code = referralCode.trim().toUpperCase()
      localStorage.setItem('pending_referral_code', code)
    } catch (error) {
      console.error('localStorage failed:', error)
      showToast({ 
        type: 'warning', 
        message: 'Note: Referral code may not be saved...' 
      })
    }
  }
  
  // Proceed with OAuth (Tier 2 will add referralCode parameter)
  await signInWithProvider(provider)
}
```

---

### Phase 3: Process Referral Code Post-Auth (Tier 1)

**OBJECTIVE:** Retrieve code from localStorage after OAuth and apply to profile

**File:** `src/hooks/useAuth.ts`

**Implementation Points:**

1. **Listen for Sign-In Event:**
   - In onAuthStateChange subscription
   - Check if event === 'SIGNED_IN'
   - Check if session and user exist

2. **Retrieve Code:**
   - Get code from localStorage: `pending_referral_code`
   - Check if code exists and is not empty

3. **Apply to Profile:**
   - Update profiles table
   - Set `referral_code_used` = retrieved code
   - Filter by user.id

4. **Clean Up:**
   - Remove code from localStorage after processing
   - Do this in finally block (always clean up)

5. **Error Handling:**
   - Catch profile update errors
   - Log error but don't throw
   - Auth succeeded, referral can be handled manually later
   - Don't show error to user (graceful failure)

**Pseudocode Structure:**
```typescript
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
      
      // NEW: Process pending referral code
      if (event === 'SIGNED_IN' && session?.user) {
        const pendingCode = localStorage.getItem('pending_referral_code')
        
        if (pendingCode) {
          try {
            // Apply to profile
            await supabase
              .from('profiles')
              .update({ referral_code_used: pendingCode })
              .eq('id', session.user.id)
            
            console.log('Referral code applied:', pendingCode)
          } catch (error) {
            console.error('Error applying referral code:', error)
            // Don't throw - auth succeeded
          } finally {
            // ALWAYS clean up
            localStorage.removeItem('pending_referral_code')
          }
        }
      }
    }
  )
  
  return () => subscription.unsubscribe()
}, [])
```

**IMPORTANT NOTES:**
- This runs automatically on every sign-in
- Works for both new users and returning users
- Returning users without code: Nothing happens (no code to apply)
- New users with code: Code applied once
- If user signs out and back in: Code already applied, nothing happens

---

### Phase 4: Add URL Parameter Fallback (Tier 2)

**OBJECTIVE:** Use OAuth state parameter as fallback when localStorage fails

**Files:** 
- `src/pages/Login.tsx` (modify handleOAuthSignIn)
- `src/lib/auth/oauth.ts` (modify signInWithOAuth)
- `src/hooks/useAuth.ts` (modify retrieval logic)

**Implementation Points:**

1. **Update OAuth Function Signature:**
   - Add optional parameter: `options?: { referralCode?: string }`
   - Encode referral code in state parameter
   - Use base64 encoding for safety

2. **Encode State:**
   - Create object: `{ ref: referralCode }`
   - JSON stringify and base64 encode
   - Pass as state in OAuth options

3. **Update Login Handler:**
   - Pass referral code to signInWithProvider
   - Do this in addition to localStorage save

4. **Decode in Callback:**
   - Check session.user.user_metadata.state
   - Base64 decode and JSON parse
   - Use as fallback if localStorage is empty

5. **Priority Order:**
   - First: Check localStorage
   - Second: Check state parameter
   - Third: No code (that's okay)

**Pseudocode for oauth.ts:**
```typescript
export async function signInWithOAuth(
  provider: OAuthProvider,
  options?: { referralCode?: string }
) {
  const state = options?.referralCode
    ? btoa(JSON.stringify({ ref: options.referralCode }))
    : undefined
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: 'com.ampel.app://auth/callback',
      skipBrowserRedirect: true,
      ...(state && { state })
    }
  })
  
  // ... rest of OAuth flow
}
```

**Pseudocode for useAuth.ts retrieval:**
```typescript
if (event === 'SIGNED_IN' && session?.user) {
  let referralCode = localStorage.getItem('pending_referral_code')
  
  // Fallback to state parameter
  if (!referralCode && session.user.user_metadata?.state) {
    try {
      const state = JSON.parse(atob(session.user.user_metadata.state))
      referralCode = state.ref
    } catch (error) {
      console.error('Failed to parse state parameter')
    }
  }
  
  if (referralCode) {
    // Apply to profile...
  }
}
```

---

### Phase 5: Remove Email Auth Infrastructure

**OBJECTIVE:** Clean up unused email authentication code

**Changes:**

1. **Delete File:**
   - `src/lib/auth/email.ts` (entire file)

2. **Update useAuth.ts:**
   - Remove imports: `signUpWithEmail`, `signInWithEmail`, `SignUpData`, `SignInData`
   - Remove methods from hook: `signUp`, `signIn`
   - Update interface: Remove from `UseAuthReturn`

3. **Final Interface:**
```typescript
interface UseAuthReturn {
  user: User | null
  session: Session | null
  loading: boolean
  signInWithProvider: (provider: OAuthProvider) => Promise<void>
  signOut: () => Promise<void>
  // REMOVED: signUp, signIn
}
```

**Verification:**
- Run TypeScript compiler: `npm run build`
- Ensure no import errors
- Ensure no type errors
- Check that OAuth still works

---

### Phase 6: Create Settings Page

**OBJECTIVE:** Create a basic settings page accessible from the drawer

**File to Create:** `src/pages/Settings.tsx`

**Page Structure:**
```
[Header with back button]
[User Info Section]
  - Email
  - Auth provider (Apple/Google icon)
  - Subscription tier
  - Shares balance
[Account Actions]
  - Sign Out button
[Referral Section] ← Phase 7
```

**Functional Requirements:**

1. **Header:**
   - Title: "Settings"
   - Back button (uses native back button behavior)
   - Safe area insets for iOS notch

2. **User Info Section:**
   - Display email from profile or user.email
   - Show auth provider with icon (Apple logo or Google logo)
   - Show selected_subscription_tier (formatted)
   - Show shares_balance

3. **Sign Out Button:**
   - Calls useAuth().signOut()
   - Shows loading state during sign out
   - Redirects to login after success

4. **Data Loading:**
   - Fetch profile on mount
   - Show loading skeleton while fetching
   - Handle errors gracefully

5. **Styling:**
   - Match app design language
   - Use existing colors (#FDFCFA background, #30302E text)
   - Card-based layout with rounded corners
   - Proper touch targets (min 44px)

**Files to Modify:**

1. **App.tsx:**
   - Add route: `<Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />`

2. **Drawer.tsx:**
   - Add onClick to settings button: `onClick={() => { navigate('/settings'); onClose(); }}`
   - Import useNavigate hook

**Design Reference:**
- Look at other pages for styling consistency
- Use same header pattern as Chat.tsx
- Use same card styling as PlanSelection.tsx

---

### Phase 7: Add Referral Code Management to Settings

**OBJECTIVE:** Allow users to view and enter referral codes in settings

**File to Modify:** `src/pages/Settings.tsx`

**New Section: Referral Code Management**

**UI Structure:**
```
[Referral Section Header: "Referral Program"]

[Card 1: Your Referral Code]
  - Label: "Your Code"
  - Large display of user's referral_code
  - Copy button
  - Explanation: "Share this code with friends"

[Card 2: Code You Used] (conditional)
  - Label: "Code You Used"
  - Display referral_code_used
  - Shows referred_by user (if available)
  - Only show if referral_code_used is not null

[Card 3: Enter Referral Code] (conditional)
  - Label: "Have a referral code?"
  - Input field
  - Submit button
  - Only show if referral_code_used is null
```

**Functional Requirements:**

1. **Display Own Code:**
   - Show profile.referral_code (read-only)
   - Add copy-to-clipboard functionality
   - Show success toast on copy

2. **Display Used Code (Conditional):**
   - Check if profile.referral_code_used exists
   - If yes: Show the code in read-only card
   - If no: Hide this card

3. **Enter Code (Conditional):**
   - Check if profile.referral_code_used is null
   - If yes: Show input + submit button
   - If no: Hide this card

4. **Code Submission:**
   - Validate format: 6-8 alphanumeric characters
   - Show loading state on button
   - Call `applyReferralCode(userId, code)` from subscriptions.ts
   - Handle success: Show toast, refresh profile, hide input card
   - Handle errors: Show error toast with message

5. **Validation:**
   - Client-side: Check format matches /^[A-Z0-9]{6,8}$/i
   - Server-side: applyReferralCode validates code exists
   - Prevent self-referral (handled by applyReferralCode)

**Import Required Functions:**
```typescript
import { applyReferralCode, validateReferralCode } from '@/lib/database/subscriptions'
import { getProfile, updateProfile } from '@/lib/auth/profile'
```

**User Flows:**

**New User Who Skipped Code:**
1. Signs in with Google (no code entered)
2. Completes onboarding
3. Opens Settings
4. Sees "Enter Referral Code" card
5. Enters friend's code
6. Submits
7. Code applied, shares granted
8. Card switches to "Code You Used"

**User Who Used Code at Signup:**
1. Signs in with Apple (code entered: "ABC123")
2. Completes onboarding
3. Opens Settings
4. Sees "Code You Used: ABC123"
5. No input field visible

**Error Handling:**
- Invalid format: "Referral code must be 6-8 characters"
- Code doesn't exist: "Invalid referral code"
- Self-referral: "You cannot use your own code"
- Network error: "Failed to apply code. Try again."

---

### Phase 8: Update Type Definitions

**OBJECTIVE:** Remove 'email' from auth_provider type

**File:** `src/types/database.ts`

**Change:**
```typescript
// BEFORE:
auth_provider: 'email' | 'apple' | 'google'

// AFTER:
auth_provider: 'apple' | 'google'
```

**Verification:**
- Run TypeScript: `npm run build`
- Check for errors in files referencing auth_provider
- Should only be in type definitions and profile display

---

### Phase 9: Cross-Platform Testing

**OBJECTIVE:** Verify all functionality works on iOS, Android, and Web

**Test Matrix:**

| Test Case | iOS | Android | Web | Notes |
|-----------|-----|---------|-----|-------|
| OAuth without code | [ ] | [ ] | [ ] | Clean auth flow |
| OAuth with code | [ ] | [ ] | [ ] | Code persists & applies |
| localStorage failure | [ ] | [ ] | [ ] | Falls back to state param |
| Settings navigation | [ ] | [ ] | [ ] | Drawer → Settings → Back |
| View own code | [ ] | [ ] | [ ] | Copy to clipboard works |
| Enter code (new user) | [ ] | [ ] | [ ] | Shows input, accepts code |
| View used code | [ ] | [ ] | [ ] | Shows read-only after entry |
| Invalid code entry | [ ] | [ ] | [ ] | Shows error |
| Sign out | [ ] | [ ] | [ ] | Returns to login |
| Returning user flow | [ ] | [ ] | [ ] | No code prompt after used |

**Specific Scenarios:**

1. **Test OAuth Without Referral Code:**
   - Clear localStorage
   - Click "Sign in with Apple"
   - Complete auth
   - Verify profile.referral_code_used is null
   - Verify no errors in console

2. **Test OAuth With Referral Code:**
   - Enter code: "TEST123"
   - Check localStorage before OAuth
   - Click "Sign in with Google"
   - Complete auth
   - Check localStorage after (should be cleared)
   - Verify profile.referral_code_used = "TEST123"
   - Verify shares granted

3. **Test localStorage Failure:**
   - Open browser dev tools
   - Disable localStorage (set quota to 0 or block)
   - Enter referral code
   - Click OAuth
   - Verify toast warning shown
   - Complete auth
   - Verify code still applied (via state parameter)

4. **Test Settings Referral Management:**
   - Create account with no code
   - Open Settings
   - Verify "Enter Code" card visible
   - Enter friend's code
   - Submit
   - Verify success toast
   - Verify card changes to "Code You Used"
   - Close and reopen Settings
   - Verify persistence

**Platform-Specific Tests:**

**iOS:**
- Face ID/Touch ID works for Apple Sign In
- Status bar style correct
- Safe areas respected
- Haptic feedback on button presses
- Back button navigates correctly

**Android:**
- Google Sign In works
- Status bar color correct
- Navigation gestures work
- Keyboard behavior correct
- Material Design patterns followed

**Web:**
- OAuth redirects work
- localStorage works
- Responsive design
- Keyboard navigation
- No console errors

---

## ✅ Acceptance Criteria

**Phase 1-5 (Core Auth Changes):**
- [ ] Login page only shows social buttons + optional referral field
- [ ] No email/password inputs visible
- [ ] Referral code saves to localStorage before OAuth
- [ ] Referral code applies to profile after OAuth
- [ ] Fallback to state parameter works if localStorage fails
- [ ] Email auth code completely removed
- [ ] TypeScript compiles with no errors
- [ ] OAuth works on iOS, Android, and Web

**Phase 6-7 (Settings Page):**
- [ ] Settings accessible from drawer
- [ ] User info displays correctly
- [ ] Sign out works
- [ ] Own referral code displays with copy button
- [ ] Used code displays when exists
- [ ] Enter code field shows when no code used
- [ ] Code submission works and validates
- [ ] UI updates after code submission
- [ ] Error handling works for invalid codes

**Phase 8-9 (Cleanup & Testing):**
- [ ] Type definitions updated
- [ ] All platforms tested
- [ ] Edge cases handled
- [ ] No regressions in existing features
- [ ] Performance acceptable (no delays)

---

## 🧪 Testing Plan

### Unit Testing (Manual)

**Functions to Test:**
1. `localStorage.setItem('pending_referral_code', code)` - success & failure
2. `localStorage.getItem('pending_referral_code')` - retrieval
3. Supabase profile update with referral_code_used
4. `applyReferralCode(userId, code)` - from settings page
5. OAuth state parameter encoding/decoding

### Integration Testing

**Flows to Test:**
1. **New User with Referral (Happy Path):**
   - Enter code → OAuth → Code applies → Onboarding → Settings shows used code

2. **New User without Referral:**
   - OAuth (no code) → Onboarding → Settings allows entry

3. **Returning User:**
   - Sign in → No code prompt → Chat interface

4. **Error Recovery:**
   - localStorage fails → State parameter works → Code still applies
   - Invalid code in settings → Error shown → Can retry
   - Network error during code apply → Graceful failure

### Cross-Platform Testing

**Devices to Test:**
- iOS Simulator (iPhone 15)
- Android Emulator (Pixel 8)
- Web Browser (Chrome, Safari)

**Test Each Platform:**
- OAuth flow (both providers)
- Referral code persistence
- Settings page functionality
- Navigation
- Error states

---

## 🚨 Edge Cases & Error Handling

### Known Edge Cases

1. **localStorage Disabled (Private Browsing):**
   - **Solution:** Fall back to state parameter
   - **User Impact:** None (transparent fallback)

2. **User Cancels OAuth:**
   - **Behavior:** Code stays in localStorage
   - **Impact:** Can retry with same code

3. **OAuth Fails (Network Error):**
   - **Behavior:** Show error toast, code persists
   - **Impact:** Can retry

4. **Invalid Referral Code:**
   - **Behavior:** Show validation error
   - **Impact:** User can correct and resubmit

5. **Self-Referral Attempt:**
   - **Behavior:** Backend blocks, show error
   - **Impact:** User informed, can enter different code

6. **Code Already Used:**
   - **Behavior:** Settings shows read-only used code
   - **Impact:** Cannot enter another code

7. **Rapid OAuth Retries:**
   - **Behavior:** Loading state prevents double-submission
   - **Impact:** Code applies once only

### Error Messages

**localStorage Failure:**
- "Note: Referral code may not be saved. You can enter it in Settings later."

**Invalid Code Format:**
- "Referral code must be 6-8 alphanumeric characters"

**Code Doesn't Exist:**
- "Invalid referral code. Please check and try again."

**Self-Referral:**
- "You cannot use your own referral code"

**Network Error:**
- "Failed to apply code. Please check your connection and try again."

**Success:**
- "Referral code applied successfully! ✓"

---

## 📚 Reference Documentation

### Relevant Files to Study

**Authentication:**
- `src/lib/auth/oauth.ts` - Current OAuth implementation
- `src/hooks/useAuth.ts` - Auth state management
- `src/pages/Login.tsx` - Current login UI

**Database:**
- `src/lib/database/subscriptions.ts` - applyReferralCode function
- `src/lib/auth/profile.ts` - getProfile, updateProfile
- `src/types/database.ts` - Profile type definition

**Navigation:**
- `src/App.tsx` - Route definitions
- `src/components/layout/Drawer.tsx` - Navigation drawer

**UI Patterns:**
- `src/pages/PlanSelection.tsx` - Card-based layout example
- `src/pages/Chat.tsx` - Header with back button example
- `src/components/ui/Toast.tsx` - Toast notification system

### Supabase API Reference

**Auth Methods:**
```typescript
// OAuth
supabase.auth.signInWithOAuth({ provider, options })

// Session Management
supabase.auth.onAuthStateChange((event, session) => {})
supabase.auth.getSession()
supabase.auth.signOut()
```

**Database Methods:**
```typescript
// Update profile
supabase.from('profiles')
  .update({ referral_code_used: code })
  .eq('id', userId)

// Select profile
supabase.from('profiles')
  .select('*')
  .eq('id', userId)
  .single()
```

### Capacitor API Reference

**Browser Plugin (OAuth):**
```typescript
import { Browser } from '@capacitor/browser'
await Browser.open({ url, windowName: '_self' })
await Browser.close()
```

**App Plugin (Deep Links):**
```typescript
import { App } from '@capacitor/app'
const listener = await App.addListener('appUrlOpen', ({ url }) => {})
```

---

## 🎨 Design Guidelines

### Typography
- **Headings:** DM Sans (font-sans)
- **Body:** DM Sans
- **Weights:** Regular (400), Medium (500), Semibold (600)

### Colors
- **Background:** #FDFCFA (cream)
- **Card Background:** #FFFFFF (white)
- **Primary Text:** #30302E (dark gray)
- **Secondary Text:** #6B7280 (gray-600)
- **Border:** #E5E3DD (warm gray)
- **Primary Button:** #30302E (dark)
- **Button Text:** #FFFFFF (white)

### Spacing
- **Container Padding:** px-6 (24px)
- **Card Padding:** p-4 or p-6
- **Section Gap:** space-y-4 or space-y-6
- **Button Height:** min-h-[44px] (touch target)

### Borders
- **Radius:** rounded-xl (12px) or rounded-2xl (16px)
- **Width:** border or border-[0.5px]

### Layout
- **Max Width:** max-w-md (centered on large screens)
- **Safe Areas:** Use env(safe-area-inset-top/bottom)

---

## 🐛 Debugging Tips

### Common Issues

**"localStorage is not defined":**
- Check if code runs on server-side
- Wrap in try/catch
- Test in native environment

**"Profile not found after OAuth":**
- Check database trigger creates profile
- Add retry logic with delays
- Verify user ID matches

**"Referral code not applied":**
- Check localStorage key matches
- Verify onAuthStateChange fires
- Check profile update query syntax
- Verify RLS policies allow update

**"Settings page not accessible":**
- Verify route added to App.tsx
- Check ProtectedRoute wrapping
- Verify navigation in Drawer.tsx

### Debug Logging

Add console.logs for debugging:
```typescript
console.log('💾 Saving referral code to localStorage:', code)
console.log('🔐 OAuth completed, user:', session?.user?.id)
console.log('📥 Retrieved pending code:', pendingCode)
console.log('✅ Referral code applied to profile')
```

### Testing localStorage Failure

Force failure in dev tools:
```javascript
// In browser console
Object.defineProperty(window, 'localStorage', {
  value: {
    setItem: () => { throw new Error('Storage disabled') },
    getItem: () => null,
    removeItem: () => {},
  }
})
```

---

## 📦 Deliverables

Upon completion, this implementation will deliver:

1. **Simplified Login Page:**
   - Social-only authentication
   - Clean, mobile-first design
   - Optional referral code input

2. **Robust Referral Persistence:**
   - localStorage + state parameter fallback
   - 99%+ reliability
   - Automatic application post-auth

3. **Settings Page:**
   - User account information
   - Referral code management
   - Manual code entry option
   - Sign out functionality

4. **Cleaner Codebase:**
   - 300+ lines of code removed
   - No email auth maintenance
   - Updated type definitions

5. **100% Referral Coverage:**
   - Automatic via OAuth
   - Manual via Settings
   - No user left behind

---

## 🎯 Success Metrics

**How We Know This Worked:**

1. **Technical Metrics:**
   - [ ] Zero TypeScript errors
   - [ ] OAuth success rate: 100%
   - [ ] Referral code capture rate: 99%+
   - [ ] Settings page load time: <500ms

2. **User Experience:**
   - [ ] One-tap sign in works on all platforms
   - [ ] Referral codes persist through OAuth
   - [ ] Settings page is accessible and functional
   - [ ] Error messages are clear and helpful

3. **Code Quality:**
   - [ ] Email auth code completely removed
   - [ ] No dead code or unused imports
   - [ ] Consistent with project patterns
   - [ ] Well-commented and documented

---

## 🚀 Deployment Checklist

Before marking this complete:

- [ ] All 9 phases tested and verified
- [ ] No TypeScript errors
- [ ] No console errors or warnings
- [ ] Tested on iOS simulator
- [ ] Tested on Android emulator
- [ ] Tested in web browser
- [ ] All edge cases handled
- [ ] Error messages user-friendly
- [ ] Performance acceptable
- [ ] Code reviewed for quality
- [ ] Documentation updated
- [ ] This file updated with completion notes

---

## 📞 Questions or Blockers?

**If you encounter issues:**

1. **Check this document first** - Most questions answered here
2. **Review reference files** - Study existing patterns
3. **Test incrementally** - Don't implement everything at once
4. **Ask specific questions** - Include error messages and context

**Common Questions Answered:**

**Q: Should I validate referral codes before OAuth?**
A: No, just save whatever the user enters. Validation happens server-side when applying the code. This prevents blocking auth for invalid codes.

**Q: What if both localStorage and state parameter fail?**
A: User can manually enter code in Settings. This covers the final 1%.

**Q: Should Settings require additional permissions?**
A: No, ProtectedRoute is sufficient. Settings is part of the authenticated app experience.

**Q: How do I test state parameter fallback?**
A: See "Testing localStorage Failure" in Debugging Tips section.

**Q: Can users change their referral code after using one?**
A: No, referral_code_used is permanent. This prevents gaming the system.

---

**IMPORTANT:** Update this document as you progress. Mark phases complete, add notes, and document any deviations from the plan. This creates a record of implementation decisions and helps with future debugging.

**Good luck! 🚀**
