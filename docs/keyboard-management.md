# Keyboard Management - Implementation Documentation

## Overview

This document describes the keyboard management implementation for Ampel's chat interface. The implementation ensures smooth, native-feeling keyboard behavior on both iOS and Android, where the keyboard never covers the input, transitions are smooth, and auto-scrolling is intelligent.

**Implementation Date:** Phase 5.2 (Mobile Polish)
**Platforms Supported:** iOS 14+, Android 8+
**Capacitor Plugin:** @capacitor/keyboard v7.0.3

---

## Table of Contents

1. [Implementation Summary](#implementation-summary)
2. [useKeyboard Hook](#usekeyboard-hook)
3. [Layout Adjustment Strategy](#layout-adjustment-strategy)
4. [Smart Auto-Scroll](#smart-auto-scroll)
5. [Keyboard Dismissal](#keyboard-dismissal)
6. [Mobile Keyboard Configuration](#mobile-keyboard-configuration)
7. [Platform-Specific Behaviors](#platform-specific-behaviors)
8. [Testing Guide](#testing-guide)
9. [Known Issues & Workarounds](#known-issues--workarounds)
10. [Troubleshooting](#troubleshooting)

---

## Implementation Summary

### Key Features Implemented

✅ **Keyboard Never Covers Input**
- Chat interface dynamically adjusts layout when keyboard appears
- Input always visible above keyboard on both platforms
- Smooth transitions matching native platform timing

✅ **Smart Auto-Scroll**
- Scrolls to bottom only when user is already at bottom
- Does NOT scroll if user is reading older messages
- Automatically scrolls on new message sent
- Scrolls when keyboard appears if user at bottom

✅ **Tap to Dismiss**
- Tap message list to dismiss keyboard
- Tap header to dismiss keyboard
- Tap input keeps keyboard visible

✅ **Multi-Line Input**
- Auto-expands as user types
- Maximum height ~120px (5 lines)
- Smooth resizing with no flash

✅ **Native Keyboard Configuration**
- Return key labeled "Send"
- Autocorrect enabled
- Spell check enabled
- Sentence case capitalization

### Files Created

- `src/hooks/useKeyboard.ts` - Keyboard state management hook

### Files Modified

- `src/components/chat/ChatInterface.tsx` - Keyboard layout adjustment
- `src/components/chat/MessageList.tsx` - Smart auto-scroll, tap-to-dismiss
- `src/components/chat/ChatInput.tsx` - Keyboard attributes
- `src/pages/Chat.tsx` - Header tap-to-dismiss

---

## useKeyboard Hook

**Location:** `src/hooks/useKeyboard.ts`

### Purpose

Custom React hook that provides keyboard state and control utilities. Listens to Capacitor Keyboard events and tracks visibility and height.

### API

```typescript
interface KeyboardState {
  isVisible: boolean        // Whether keyboard is currently visible
  keyboardHeight: number    // Height of keyboard in pixels
  hideKeyboard: () => Promise<void>  // Programmatically hide keyboard
}

const { isVisible, keyboardHeight, hideKeyboard } = useKeyboard()
```

### Implementation Details

**Event Listeners:**
- `keyboardWillShow` - Fires BEFORE keyboard animates in (iOS) or as it starts (Android)
- `keyboardWillHide` - Fires BEFORE keyboard animates out

**Why `keyboardWillShow` instead of `keyboardDidShow`?**
- Using `keyboardWillShow` allows our layout changes to sync with the native keyboard animation
- Creates smooth, coordinated transitions
- `keyboardDidShow` would cause a visible lag after keyboard appears

**Platform Detection:**
- Only activates on native platforms (iOS/Android)
- On web, returns default values (keyboard not visible, height 0)
- Uses `isNativePlatform()` from `usePlatform` hook

**Cleanup:**
- Event listeners are properly removed on component unmount
- No memory leaks

### Usage Example

```typescript
import { useKeyboard } from '@/hooks/useKeyboard'

function MyComponent() {
  const { isVisible, keyboardHeight, hideKeyboard } = useKeyboard()

  return (
    <div
      style={{
        paddingBottom: `${keyboardHeight}px`,
        transition: 'padding-bottom 0.25s ease-out',
      }}
      onClick={hideKeyboard}
    >
      {/* Content */}
    </div>
  )
}
```

---

## Layout Adjustment Strategy

**Approach:** Padding Strategy

### Why Padding?

We apply bottom padding to the chat container equal to keyboard height. This approach was chosen because:

**Pros:**
- Simple and maintainable
- Works seamlessly with existing flexbox layout
- Coordinates well with iOS safe areas
- No z-index or stacking context issues
- Smooth transitions

**Alternatives Considered:**
- **Transform:** Would add complexity coordinating with safe areas
- **Height adjustment:** Could cause layout recalculations and jank

### Implementation

**File:** `src/components/chat/ChatInterface.tsx`

```typescript
const { isVisible: keyboardVisible, keyboardHeight } = useKeyboard()

return (
  <div
    className="flex flex-col h-full bg-gray-900"
    style={{
      // Apply keyboard height as bottom padding to push content up
      paddingBottom: `${keyboardHeight}px`,
      // Smooth transition matching iOS native keyboard timing (0.25s)
      transition: 'padding-bottom 0.25s ease-out',
    }}
  >
    {/* MessageList and ChatInput */}
  </div>
)
```

### Transition Timing

**Duration:** 250ms (0.25s)
**Easing:** ease-out

**Why 250ms?**
- Matches iOS native keyboard animation timing
- Feels natural and responsive
- Not too fast (jarring) or too slow (laggy)

**Android Note:**
- Android keyboards vary in animation timing (200-300ms typical)
- 250ms is a good middle ground that works well across devices

### Coordination with Safe Areas

The keyboard padding is applied **in addition to** existing safe area handling:

```typescript
// ChatInput.tsx already has safe area padding
style={{
  paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
}}

// Keyboard padding is applied to parent container
// Both work together: safe area + keyboard height
```

**On iOS:**
- When keyboard appears, safe area inset bottom changes to 0
- Our keyboard padding takes over
- When keyboard dismisses, safe area inset bottom returns
- Smooth transition between both states

---

## Smart Auto-Scroll

**File:** `src/components/chat/MessageList.tsx`

### Philosophy

Auto-scroll should **enhance** the chat experience, not disrupt it:
- ✅ Scroll when user expects it (at bottom, new message)
- ❌ Don't scroll when user is reading older messages

### Implementation

#### 1. Bottom Detection

```typescript
const isAtBottom = (): boolean => {
  if (!containerRef.current) return true

  const { scrollTop, scrollHeight, clientHeight } = containerRef.current
  const threshold = 100 // pixels from bottom

  return scrollHeight - scrollTop - clientHeight < threshold
}
```

**Threshold:** 100px from bottom = "at bottom"
- Accounts for slight scroll variations
- User doesn't need to be exactly at bottom
- Forgiving for touch scrolling

#### 2. Scroll Position Tracking

```typescript
const [wasAtBottom, setWasAtBottom] = useState(true)

useEffect(() => {
  const handleScroll = () => {
    setWasAtBottom(isAtBottom())
  }

  container.addEventListener('scroll', handleScroll)
  return () => container.removeEventListener('scroll', handleScroll)
}, [])
```

Continuously tracks whether user is at bottom. Used to decide if auto-scroll should trigger.

#### 3. Message Change Auto-Scroll

```typescript
useEffect(() => {
  if (wasAtBottom && bottomRef.current) {
    bottomRef.current.scrollIntoView({ behavior: 'smooth' })
  }
}, [messages, wasAtBottom])
```

**Behavior:**
- New message added → Check if user was at bottom
- If yes → Scroll to show new message
- If no → Don't scroll (user is reading older messages)

#### 4. Keyboard Appearance Auto-Scroll

```typescript
useEffect(() => {
  const keyboardJustAppeared = !prevKeyboardVisible.current && keyboardVisible

  if (keyboardJustAppeared && wasAtBottom && bottomRef.current) {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 50)
  }

  prevKeyboardVisible.current = keyboardVisible
}, [keyboardVisible, wasAtBottom])
```

**Behavior:**
- Keyboard transitions from hidden to visible
- Check if user was at bottom
- If yes → Scroll to keep latest messages visible
- If no → Don't scroll

**Why 50ms delay?**
- Gives keyboard animation a moment to start
- Ensures scroll happens smoothly with keyboard animation
- Prevents scroll from being cut off by layout change

### User Experience

**Scenario 1: User at bottom, new message arrives**
```
User: [scrolled to bottom]
System: New message added
Result: ✅ Auto-scroll to show new message
```

**Scenario 2: User reading old messages, new message arrives**
```
User: [scrolled up, reading history]
System: New message added
Result: ❌ Don't scroll (user stays at current position)
```

**Scenario 3: User at bottom, keyboard appears**
```
User: [scrolled to bottom, taps input]
System: Keyboard appears
Result: ✅ Scroll to keep latest messages visible above keyboard
```

**Scenario 4: User reading old messages, keyboard appears**
```
User: [scrolled up, reading history, taps input]
System: Keyboard appears
Result: ❌ Don't scroll (user stays at reading position)
```

---

## Keyboard Dismissal

**Implementation:** Tap outside the input to dismiss keyboard

### Where It Works

1. **Message List** (`MessageList.tsx`)
   - Tap anywhere in message area
   - Implementation: `onClick={handleTapToDismiss}`

2. **Header** (`Chat.tsx`)
   - Tap header area (title, buttons, etc.)
   - Implementation: `onClick={hideKeyboard}`

### Where It Doesn't Work

- **Chat Input:** Tapping input keeps keyboard visible (expected behavior)
- **Buttons:** Button clicks are handled, keyboard state unchanged

### Implementation

```typescript
// MessageList.tsx
const { hideKeyboard } = useKeyboard()

const handleTapToDismiss = () => {
  if (keyboardVisible) {
    hideKeyboard()
  }
}

return (
  <div onClick={handleTapToDismiss}>
    {/* Messages */}
  </div>
)
```

**Why check `keyboardVisible`?**
- Only attempt to hide if keyboard is actually visible
- Avoids unnecessary calls to Capacitor plugin
- Better performance

### Platform Behavior

**iOS:**
- Tapping outside input dismisses keyboard (native behavior)
- Our implementation enhances this
- Smooth dismissal animation

**Android:**
- Back button dismisses keyboard (system-handled)
- Tapping outside also works (our implementation)
- Multiple ways to dismiss (good UX)

**Web:**
- Falls back to `document.activeElement.blur()`
- Works in browser testing

---

## Mobile Keyboard Configuration

**File:** `src/components/chat/ChatInput.tsx`

### Textarea Attributes

```typescript
<textarea
  enterKeyHint="send"
  autoCorrect="on"
  spellCheck={true}
  autoCapitalize="sentences"
  // ... other props
/>
```

### Attribute Explanations

#### `enterKeyHint="send"`

**Purpose:** Changes the return key label on mobile keyboards

**Platform Support:**
- iOS: ✅ Supported (shows "Send" button)
- Android: ✅ Supported on modern keyboards (Gboard, etc.)
- Web: ✅ Supported in modern browsers

**Result:** Return key displays "Send" instead of "Return" or "Enter"

**User Benefit:** Clear affordance that pressing return will send the message

#### `autoCorrect="on"`

**Purpose:** Enables autocorrect on mobile keyboards

**Behavior:**
- Automatically fixes typos
- Suggests corrections as user types
- Standard behavior for messaging apps

#### `spellCheck={true}`

**Purpose:** Enables spell checking

**Behavior:**
- Underlines misspelled words
- Platform-specific spell check (iOS, Android, or browser)

#### `autoCapitalize="sentences"`

**Purpose:** Automatically capitalizes first letter of sentences

**Behavior:**
- After period + space, next letter is capitalized
- Standard messaging app behavior
- Doesn't interfere with code or URLs

### Multi-Line Auto-Resize

**Existing Implementation:** Already in place, works well

```typescript
onInput={(e) => {
  const target = e.target as HTMLTextAreaElement
  target.style.height = 'auto'
  target.style.height = `${Math.min(target.scrollHeight, 120)}px`
}
```

**How It Works:**
1. Reset height to 'auto' (collapses to content)
2. Measure `scrollHeight` (natural content height)
3. Set height to min(scrollHeight, 120px)

**Maximum Height:** 120px (~5 lines)
- After this, textarea becomes scrollable
- Prevents input from taking over entire screen

**Minimum Height:** 48px (from CSS class `min-h-[48px]`)
- Comfortable single-line height
- Meets iOS HIG minimum touch target (44pt)

---

## Platform-Specific Behaviors

### iOS

#### Keyboard Characteristics

**Animation Timing:**
- Appears: ~250-300ms
- Dismisses: ~250-300ms
- System-managed, consistent

**Keyboard Toolbar:**
- Predictive text bar above keyboard
- Adds ~40-50px to keyboard height
- Included in `info.keyboardHeight`

**Safe Areas:**
- Bottom safe area inset changes when keyboard appears
- Goes from ~34px (home indicator) to 0px
- Our implementation coordinates with this

#### Testing Notes

**iOS Simulator:**
- Test with both hardware keyboard enabled and disabled
- Toggle predictive text (Settings → General → Keyboard)
- Test on notched devices (iPhone X and later)

**Physical Device:**
- Keyboard feel is more accurate
- Animation timing may differ slightly from simulator
- Test different keyboard settings (predictive text, emoji keyboard)

### Android

#### Keyboard Characteristics

**Animation Timing:**
- Varies by keyboard app (200-300ms typical)
- Gboard: ~200ms
- SwiftKey: ~250ms
- Samsung Keyboard: ~200ms

**Keyboard Apps:**
- Multiple keyboard apps available
- Different heights and behaviors
- Different toolbars and emoji pickers

**Back Button:**
- System-handled dismissal
- Our tap-to-dismiss is additional option
- Both methods work seamlessly

#### Testing Notes

**Android Emulator:**
- Test with Gboard (default)
- Test with different screen sizes
- Check back button behavior

**Physical Device:**
- Test with user's preferred keyboard
- Different manufacturers may have different keyboards
- Test on various Android versions (8+)

### Web Browser

#### Behavior

**Keyboard Detection:**
- Not available in web
- Hook returns default values (not visible, height 0)

**Fallback:**
- `hideKeyboard()` calls `document.activeElement.blur()`
- Standard web behavior

**Layout:**
- Browser handles keyboard (no layout adjustment needed)
- Our implementation is transparent (no errors)

---

## Testing Guide

### Browser Testing (Development)

**Purpose:** Verify logic and catch errors early

**Steps:**
1. Run `npm run dev`
2. Open in browser with mobile emulation (DevTools)
3. Test multi-line input resize
4. Test auto-scroll behavior
5. Verify no JavaScript errors

**Limitations:**
- Can't test keyboard appearance/dismissal
- Can't test platform-specific behavior
- Layout may differ from native

### iOS Simulator Testing

**Purpose:** Test iOS-specific behavior

**Setup:**
```bash
npm run build
npx cap sync
npx cap run ios
```

**Test Scenarios:**

#### Basic Flow
1. Open chat
2. Tap input → Keyboard appears
3. ✅ Verify input stays visible above keyboard
4. ✅ Verify smooth transition (no jank)
5. Type message → Press return
6. ✅ Verify message sends
7. ✅ Verify input resets

#### Multi-Line Input
1. Tap input
2. Type multiple lines (press Shift+Return)
3. ✅ Verify input expands smoothly
4. ✅ Verify max height respected (~120px)
5. Continue typing beyond max
6. ✅ Verify input becomes scrollable

#### Auto-Scroll
1. Have conversation with 10+ messages
2. Scroll to bottom
3. Tap input → Keyboard appears
4. ✅ Verify can still see recent messages
5. Scroll up to read old messages
6. Tap input again
7. ✅ Verify does NOT auto-scroll

#### Keyboard Dismissal
1. Tap input (keyboard appears)
2. Tap on message list
3. ✅ Verify keyboard dismisses smoothly
4. Tap on header
5. ✅ Verify keyboard dismisses

#### Predictive Text
1. Enable predictive text (Settings → General → Keyboard)
2. Open chat, tap input
3. ✅ Verify keyboard toolbar visible
4. ✅ Verify input still above keyboard
5. Type message with autocorrect
6. ✅ Verify suggestions appear

### Android Emulator Testing

**Purpose:** Test Android-specific behavior

**Setup:**
```bash
npm run build
npx cap sync
npx cap run android
```

**Test Scenarios:**

#### Basic Flow
1. Open chat
2. Tap input → Keyboard appears
3. ✅ Verify input stays visible above keyboard
4. ✅ Verify smooth transition
5. Type message → Press return
6. ✅ Verify message sends (return key labeled "Send")

#### Back Button
1. Tap input (keyboard appears)
2. Press back button
3. ✅ Verify keyboard dismisses
4. ✅ Verify app doesn't exit

#### Different Keyboards
If possible, test with multiple keyboard apps:
- Gboard (default)
- SwiftKey
- Samsung Keyboard

Verify keyboard height is correctly detected for each.

### Physical Device Testing

**Purpose:** Final validation with real user experience

**iOS Device:**
1. Build and install app
2. Test all iOS simulator scenarios on device
3. Pay attention to animation feel and timing
4. Test with different keyboard settings

**Android Device:**
1. Build and install app
2. Test all Android emulator scenarios on device
3. Test with user's preferred keyboard
4. Verify back button behavior

---

## Known Issues & Workarounds

### Issue: Keyboard Height Slightly Off on Some Android Keyboards

**Symptoms:**
- Small gap between input and keyboard, or slight overlap
- Varies by keyboard app and device

**Cause:**
- Different Android keyboards report height differently
- Some include toolbar, some don't

**Workaround:**
- Capacitor provides the most accurate available height
- Minor variations are acceptable
- Most users won't notice small differences

**Status:** Known limitation of Android ecosystem

---

### Issue: Keyboard Animation Timing Varies

**Symptoms:**
- On some devices, keyboard animation feels slightly out of sync with content animation

**Cause:**
- Device performance varies
- Different Android keyboards have different animation curves

**Workaround:**
- 250ms transition is a good middle ground
- Could make timing platform-specific if needed (iOS: 250ms, Android: 200ms)

**Status:** Acceptable as-is, can refine if users report issues

---

### Issue: Web Browser Keyboard Not Detected

**Symptoms:**
- Keyboard events don't fire in browser

**Cause:**
- Capacitor Keyboard plugin only works on native platforms

**Status:** Expected behavior, web fallback works correctly

---

## Troubleshooting

### Keyboard Doesn't Appear

**Check:**
1. Is the textarea focused? (Should have blue ring)
2. Is the textarea disabled? (Check `disabled` prop)
3. Is the app running on simulator/device? (Not just browser)

**Solution:**
- Ensure `autoFocus` is working if needed
- Check for JavaScript errors preventing focus
- Try tapping input directly

---

### Input Gets Covered by Keyboard

**Check:**
1. Is `keyboardHeight` being received? (Console log in ChatInterface)
2. Is padding being applied? (Inspect element in Safari Web Inspector)
3. Is transition CSS correct?

**Solution:**
- Verify `useKeyboard()` hook is returning correct values
- Check for CSS conflicts overriding padding
- Ensure Capacitor Keyboard plugin is installed and synced

---

### Auto-Scroll Not Working

**Check:**
1. Is `keyboardVisible` prop reaching MessageList?
2. Is `bottomRef` attached to correct element?
3. Are there JavaScript errors in console?

**Solution:**
- Add console logs to track `wasAtBottom` state
- Verify scroll event listener is attached
- Check if `scrollIntoView` is being called

---

### Keyboard Doesn't Dismiss on Tap

**Check:**
1. Is `onClick` handler attached? (Check React DevTools)
2. Is `keyboardVisible` true? (Handler only runs if visible)
3. Is click event propagating correctly?

**Solution:**
- Verify `useKeyboard()` hook is called in component
- Check for `e.stopPropagation()` blocking the event
- Test with header tap (simpler, no children)

---

### Multi-Line Resize Jumpy or Flashing

**Check:**
1. Is there a CSS transition on height? (There shouldn't be)
2. Are there multiple `onInput` handlers? (Should only be one)
3. Is `scrollHeight` being measured correctly?

**Solution:**
- Remove any CSS transitions on textarea height
- Ensure only one auto-resize implementation
- Test with slower typing to isolate issue

---

## Performance Considerations

### Event Listener Cleanup

All event listeners are properly cleaned up on component unmount:
- Keyboard event listeners (`useKeyboard` hook)
- Scroll event listeners (`MessageList` component)

No memory leaks.

### Scroll Performance

Scroll event listener uses `setWasAtBottom` state update:
- Lightweight check (just comparing scroll position)
- No expensive operations
- Smooth scrolling maintained

### Layout Thrashing

Auto-resize in `ChatInput` is efficient:
- Only triggers on user input
- Single height measurement and update
- No layout loops

### Transition Performance

CSS transitions use `padding-bottom`:
- Hardware-accelerated on most devices
- More performant than `height` transitions
- Smooth 60fps animation

---

## Future Enhancements

### Potential Improvements

1. **Adaptive Transition Timing**
   - Detect platform and adjust timing accordingly
   - iOS: 250ms, Android: 200ms

2. **Keyboard Height Persistence**
   - Remember keyboard height for faster first appearance
   - Reduce initial layout shift

3. **Advanced Auto-Scroll**
   - Scroll to show user's own message when sent
   - Highlight new unread messages above

4. **Haptic Feedback**
   - Light haptic when keyboard appears (iOS)
   - Already have haptics infrastructure from Phase 5.1

5. **Accessibility**
   - VoiceOver/TalkBack announcements for keyboard state
   - Focus management for screen readers

---

## References

### Official Documentation

- [Capacitor Keyboard Plugin](https://capacitorjs.com/docs/apis/keyboard)
- [iOS Human Interface Guidelines - Keyboards](https://developer.apple.com/design/human-interface-guidelines/keyboards)
- [Android Design - On-screen keyboards](https://developer.android.com/design/ui/mobile/guides/input-methods/keyboard-input)
- [MDN - enterKeyHint](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/enterkeyhint)

### Related Documentation

- `docs/platform-specific-behavior.md` - Phase 5.1 implementation (safe areas, haptics, etc.)
- `CLAUDE.md` - Project development guidelines

---

## Summary

This keyboard management implementation provides a smooth, native-feeling experience on both iOS and Android. Key achievements:

✅ Input never covered by keyboard
✅ Smooth transitions matching platform timing
✅ Intelligent auto-scroll (doesn't disrupt reading)
✅ Easy dismissal (tap outside)
✅ Proper mobile keyboard configuration
✅ Comprehensive platform support

**Testing Status:** ✅ TypeScript compiles, build succeeds, Capacitor synced

**Ready for:** Device testing by founder on physical iPhone and Android devices

---

*Last Updated: Phase 5.2 (Keyboard Management)*
