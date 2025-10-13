# Platform-Specific Behavior - Implementation Documentation

## Overview

This document describes the platform-specific features implemented to make Ampel feel native on both iOS and Android. These implementations transform the app from a web wrapper into a truly native-feeling mobile experience.

**Implementation Date:** Phase 5.1 (Mobile Polish)
**Platforms Supported:** iOS 14+, Android 8+

---

## Table of Contents

1. [Platform Utilities](#platform-utilities)
2. [iOS Safe Areas](#ios-safe-areas)
3. [Status Bar Styling](#status-bar-styling)
4. [iOS Haptic Feedback](#ios-haptic-feedback)
5. [Android Back Button](#android-back-button)
6. [Pull-to-Refresh](#pull-to-refresh)
7. [Touch Target Optimization](#touch-target-optimization)
8. [Testing Guide](#testing-guide)
9. [Known Issues & Workarounds](#known-issues--workarounds)

---

## Platform Utilities

### Location
- `src/hooks/usePlatform.ts` - Platform detection utilities
- `src/hooks/useHaptics.ts` - Haptic feedback wrapper

### usePlatform Hook

Provides platform detection utilities for conditional behavior:

```typescript
import { usePlatform, isIOS, isAndroid, isWeb } from '@/hooks/usePlatform'

// In component
const { platform, isNative, isIOS, isAndroid, isWeb } = usePlatform()

// As standalone functions
if (isIOS()) {
  // iOS-specific code
}
```

**Platforms:**
- `'ios'` - iOS devices
- `'android'` - Android devices
- `'web'` - Browser/desktop

### useHaptics Hook

Provides haptic feedback for iOS (no-op on Android and web):

```typescript
import { impact, selection, notification } from '@/hooks/useHaptics'

// Impact feedback (light, medium, heavy)
impact('medium') // Default
impact('light')  // Subtle actions
impact('heavy')  // Important actions

// Selection feedback
selection() // When selection changes

// Notification feedback
notification('success')
notification('warning')
notification('error')
```

**Key Features:**
- Automatically checks for iOS platform
- Silently fails on unsupported platforms
- Returns promises (can be awaited or fire-and-forget)

---

## iOS Safe Areas

### Overview

Safe areas ensure content doesn't appear under the notch, Dynamic Island, or home indicator on iOS devices with non-rectangular displays.

### Implementation Strategy

Uses CSS environment variables with fallback values:

```css
padding-top: max(1rem, env(safe-area-inset-top));
padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
```

### Components with Safe Areas

#### 1. Chat Header (`src/pages/Chat.tsx:168-174`)

```typescript
<header
  className="border-b border-gray-800 p-4 flex-shrink-0"
  style={{
    paddingTop: 'max(1rem, env(safe-area-inset-top))',
  }}
>
```

**Why:** Prevents content from appearing under notch/Dynamic Island.

#### 2. Message List (`src/components/chat/MessageList.tsx:29-33`)

```typescript
<div
  className="flex-1 overflow-y-auto px-4 py-4"
  style={{
    paddingTop: 'max(1rem, env(safe-area-inset-top))',
  }}
>
```

**Why:** Ensures first message is visible below notch.

#### 3. Chat Input (`src/components/chat/ChatInput.tsx:62-66`)

```typescript
<div
  className="border-t border-gray-800 bg-gray-900 px-4 py-3"
  style={{
    paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
  }}
>
```

**Why:** Prevents input area from being covered by home indicator.

#### 4. Drawer Header (`src/components/layout/Drawer.tsx:76-82`)

```typescript
<div
  className="flex items-center justify-between px-6 py-4 border-b border-gray-800"
  style={{
    paddingTop: 'max(1rem, env(safe-area-inset-top))',
  }}
>
```

**Why:** Drawer header respects notch area.

#### 5. Drawer Footer (`src/components/layout/Drawer.tsx:119-124`)

```typescript
<div
  style={{
    height: 'env(safe-area-inset-bottom)',
  }}
  className="bg-gray-900"
/>
```

**Why:** Adds spacing for home indicator at bottom of drawer.

#### 6. Delete Menu (`src/components/conversations/DeleteMenu.tsx:58-62`)

```typescript
<div
  style={{
    height: 'env(safe-area-inset-bottom)',
  }}
/>
```

**Why:** Bottom sheet respects home indicator area.

#### 7. Delete Confirmation Modal (`src/components/conversations/DeleteConfirmation.tsx:27-33`)

```typescript
<div
  className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50"
  style={{
    maxHeight: 'calc(100vh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 2rem)',
  }}
>
```

**Why:** Ensures modal fits within safe area boundaries.

### Testing Safe Areas

**Recommended Devices:**
- iPhone 14 Pro / Pro Max (Dynamic Island)
- iPhone 13 / 13 Pro (notch)
- iPhone SE (no notch - verify fallback works)

**What to Check:**
- [ ] Content doesn't appear under notch/Dynamic Island
- [ ] Content doesn't appear under home indicator
- [ ] Fallback padding works on devices without notch
- [ ] Drawer respects safe areas when open
- [ ] Modals don't overlap with notch or home indicator

---

## Status Bar Styling

### Overview

Configures the iOS/Android status bar (clock, battery, signal indicators) to coordinate with the app's dark theme.

### Implementation

**Location:** `src/App.tsx:11-33`

```typescript
import { StatusBar, Style } from '@capacitor/status-bar'
import { isNativePlatform, isAndroid } from '@/hooks/usePlatform'

useEffect(() => {
  async function initializeStatusBar() {
    if (!isNativePlatform()) return

    try {
      // Light content (white icons) for dark background
      await StatusBar.setStyle({ style: Style.Light })

      // Android: Set background to match app theme
      if (isAndroid()) {
        await StatusBar.setBackgroundColor({ color: '#111827' }) // gray-900
      }
    } catch (error) {
      console.debug('Failed to configure status bar:', error)
    }
  }

  initializeStatusBar()
}, [])
```

### Configuration

**iOS:**
- Style: `Style.Light` (white icons/text)
- Works well with dark theme (gray-900 background)

**Android:**
- Style: `Style.Light` (white icons)
- Background color: `#111827` (gray-900 to match app)

### Why This Matters

- **iOS:** Status bar content must contrast with app background for readability
- **Android:** Status bar can match app background color for seamless integration

---

## iOS Haptic Feedback

### Overview

Haptic feedback provides tactile responses to user interactions, making the app feel more responsive and native on iOS devices.

**Note:** Haptics are iOS-only. They are automatically skipped on Android and web.

### Haptic Locations

#### 1. Send Message (`src/components/chat/ChatInput.tsx:44-45`)

```typescript
// Trigger haptic feedback for send action (iOS only)
impact('medium')
```

**When:** User sends a message
**Type:** Medium impact
**Why:** Confirms message was sent

#### 2. Delete Conversation (`src/components/conversations/DeleteConfirmation.tsx:21-22`)

```typescript
// Trigger heavy haptic feedback for destructive action (iOS only)
impact('heavy')
```

**When:** User confirms conversation deletion
**Type:** Heavy impact
**Why:** Emphasizes destructive action, provides strong confirmation

#### 3. Long-Press Conversation (`src/components/conversations/ConversationItem.tsx:43-44`)

```typescript
// Trigger selection haptic when long-press activates (iOS only)
selection()
```

**When:** Long-press gesture triggers delete menu
**Type:** Selection haptic
**Why:** Indicates selection state change

#### 4. Open Drawer (`src/pages/Chat.tsx:180-181`)

```typescript
// Trigger light haptic when opening drawer (iOS only)
impact('light')
```

**When:** User opens hamburger menu
**Type:** Light impact
**Why:** Subtle feedback for navigation action

#### 5. Close Drawer (`src/pages/Chat.tsx:222-223`)

```typescript
// Trigger light haptic when closing drawer (iOS only)
impact('light')
```

**When:** User closes drawer (tap overlay or X button)
**Type:** Light impact
**Why:** Confirms drawer closure

#### 6. Pull-to-Refresh (`src/components/conversations/ConversationList.tsx:62`)

```typescript
// Haptic feedback on iOS
impact('light')
```

**When:** Pull-to-refresh gesture triggers refresh
**Type:** Light impact
**Why:** Confirms refresh action initiated

### Haptic Guidelines

**When to Use:**
- ✅ Meaningful user actions (send, delete, refresh)
- ✅ State changes (open/close, selection)
- ✅ Important confirmations

**When NOT to Use:**
- ❌ Every tap or interaction (too noisy)
- ❌ Passive updates (incoming messages, loading states)
- ❌ Background operations

### Testing Haptics

**On Device:**
- Physical iPhone required (haptics don't work in simulator)
- Ensure device is not in silent mode (mute switch affects haptics on some devices)
- Test each interaction to verify haptic strength feels appropriate

---

## Android Back Button

### Overview

Handles the Android hardware/gesture back button to provide native navigation behavior.

### Implementation

**Hook Location:** `src/hooks/useBackButton.ts`
**Usage Location:** `src/pages/Chat.tsx:163-173`

### Navigation Logic

The back button follows this priority order:

```
1. Drawer open → Close drawer
2. In conversation → Navigate to chat home
3. At chat home → Exit app
```

### Code

```typescript
useBackButton({
  drawerOpen,
  onCloseDrawer: () => {
    impact('light')
    setDrawerOpen(false)
  },
  inConversation: !!conversationId,
  onNavigateBack: () => navigate('/chat'),
  atRootLevel: !conversationId,
})
```

### Behavior Details

#### 1. Drawer Open
**Condition:** `drawerOpen === true`
**Action:** Close drawer with haptic feedback
**Why:** Users expect back button to close overlays first

#### 2. In Conversation
**Condition:** `conversationId` exists in URL
**Action:** Navigate to `/chat` (chat home)
**Why:** Back button should return to conversation list

#### 3. At Chat Home
**Condition:** No `conversationId` in URL
**Action:** Exit app
**Why:** User is at root level, back button exits

### Platform Check

The hook automatically checks for Android platform:

```typescript
if (!isAndroid()) return // No-op on iOS and web
```

**Why:** iOS uses swipe gestures, web uses browser back button.

### Testing Back Button

**On Android Device/Emulator:**
1. [ ] Back button closes drawer when open
2. [ ] Back button navigates from conversation to chat home
3. [ ] Back button exits app from chat home
4. [ ] Back button provides haptic feedback when closing drawer
5. [ ] Navigation feels natural and predictable

---

## Pull-to-Refresh

### Overview

Allows users to manually refresh the conversation list by pulling down at the top of the list.

### Implementation

**Location:** `src/components/conversations/ConversationList.tsx:28-76`

### How It Works

1. **Touch Detection:** Tracks touch events (start, move, end)
2. **Pull Distance:** Calculates how far user has pulled
3. **Rubber Band Effect:** Applies diminishing returns for natural feel
4. **Visual Indicator:** Shows "Pull to refresh" → "Release to refresh" → "Refreshing..."
5. **Refresh Action:** Calls `refreshList()` from ConversationContext
6. **Haptic Feedback:** Triggers light haptic on iOS when refresh activates

### Code Structure

```typescript
// State management
const [isRefreshing, setIsRefreshing] = useState(false)
const [pullDistance, setPullDistance] = useState(0)
const touchStartY = useRef<number>(0)
const scrollContainerRef = useRef<HTMLDivElement>(null)

const PULL_THRESHOLD = 80 // Distance in pixels to trigger refresh

// Touch handlers
const handleTouchStart = (e: React.TouchEvent) => {
  if (scrollContainerRef.current?.scrollTop === 0) {
    touchStartY.current = e.touches[0].clientY
  }
}

const handleTouchMove = (e: React.TouchEvent) => {
  const currentY = e.touches[0].clientY
  const distance = currentY - touchStartY.current

  if (distance > 0 && scrollContainerRef.current?.scrollTop === 0) {
    const rubberBandDistance = Math.min(distance * 0.5, PULL_THRESHOLD * 1.2)
    setPullDistance(rubberBandDistance)
  }
}

const handleTouchEnd = async () => {
  if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
    setIsRefreshing(true)
    impact('light') // Haptic on iOS

    try {
      await refreshList()
    } finally {
      setIsRefreshing(false)
    }
  }

  setPullDistance(0)
  touchStartY.current = 0
}
```

### Visual Indicator

The refresh indicator shows three states:

```typescript
{isRefreshing
  ? 'Refreshing...'
  : pullDistance >= PULL_THRESHOLD
  ? 'Release to refresh'
  : 'Pull to refresh'}
```

**Styling:**
- Positioned absolutely at top of list
- Opacity scales with pull distance
- Spinning icon when refreshing
- Smooth transitions

### Testing Pull-to-Refresh

**On Device:**
1. [ ] Pull down at top of conversation list
2. [ ] Visual indicator appears as you pull
3. [ ] Indicator updates: "Pull" → "Release" → "Refreshing"
4. [ ] Haptic feedback on iOS when refresh triggers
5. [ ] Conversations reload from Supabase
6. [ ] Indicator disappears after refresh completes
7. [ ] Gesture feels smooth and natural
8. [ ] Rubber band effect prevents excessive pulling

---

## Touch Target Optimization

### Overview

All interactive elements meet the iOS Human Interface Guidelines minimum of 44×44pt touch targets for comfortable tapping.

### Updated Components

#### Chat Header Buttons
**Location:** `src/pages/Chat.tsx`

```typescript
// Hamburger menu and new chat button
className="p-2.5 hover:bg-gray-800 rounded-lg transition min-h-[44px] min-w-[44px] flex items-center justify-center"
```

**Before:** 40×40px (p-2 with 24px icon)
**After:** 44×44px minimum

#### Drawer Buttons
**Location:** `src/components/layout/Drawer.tsx`

```typescript
// Close button and settings button
className="p-2.5 hover:bg-gray-800 rounded-lg transition min-h-[44px] min-w-[44px] flex items-center justify-center"
```

**Before:** 40×40px
**After:** 44×44px minimum

#### Chat Input Toggle Buttons
**Location:** `src/components/chat/ChatInput.tsx`

```typescript
// Reasoning and web search toggles
className="p-2.5 rounded-lg transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
```

**Before:** 40×40px
**After:** 44×44px minimum

### Already Compliant

These components already met the 44pt minimum:

- ✅ Chat input send button: 48×48px
- ✅ Login buttons: 48px minimum height
- ✅ New chat button in drawer: Full width with adequate height
- ✅ Conversation list items: Full width with 3.5 padding

### Why This Matters

**iOS Human Interface Guidelines:**
> "Provide ample touch targets for interactive elements. Try to maintain a minimum tappable area of 44pt × 44pt for all controls."

**Benefits:**
- Easier to tap on all devices
- Reduces miss-taps and frustration
- Feels more native and polished
- Better accessibility

---

## Testing Guide

### Browser Testing (Development)

**Purpose:** Verify no errors on web platform

```bash
npm run dev
```

**Check:**
- [ ] Platform checks don't cause errors
- [ ] Safe areas fallback to regular padding
- [ ] Haptics are silently skipped
- [ ] Back button hook doesn't break
- [ ] App functions normally

### iOS Simulator Testing

**Purpose:** Test safe areas and visual layout

```bash
npm run build
npx cap sync
npx cap run ios
```

**Devices to Test:**
- iPhone 14 Pro (Dynamic Island)
- iPhone 13 (notch)
- iPhone SE (no notch)

**Checklist:**
- [ ] Content respects safe areas (top and bottom)
- [ ] Status bar is light colored (white)
- [ ] No content under notch/Dynamic Island
- [ ] No content under home indicator
- [ ] Drawer safe areas work
- [ ] Modals don't overlap safe areas
- [ ] All buttons have adequate touch targets

**Note:** Haptics won't work in simulator. Physical device required.

### Android Emulator Testing

**Purpose:** Test back button and status bar

```bash
npm run build
npx cap sync
npx cap run android
```

**Checklist:**
- [ ] Status bar background is dark (gray-900)
- [ ] Status bar icons are light colored
- [ ] Back button closes drawer when open
- [ ] Back button navigates from conversation
- [ ] Back button exits app at root
- [ ] Pull-to-refresh works
- [ ] All touch targets are adequate

### Physical iOS Device Testing

**Purpose:** Test haptics and real-world feel

**Checklist:**
- [ ] Send message haptic (medium)
- [ ] Delete conversation haptic (heavy)
- [ ] Long-press haptic (selection)
- [ ] Open drawer haptic (light)
- [ ] Close drawer haptic (light)
- [ ] Pull-to-refresh haptic (light)
- [ ] All haptics feel appropriate (not excessive)
- [ ] Safe areas look correct on device

### Physical Android Device Testing

**Purpose:** Verify back button on real hardware

**Checklist:**
- [ ] Hardware back button works
- [ ] Gesture navigation works
- [ ] Back button behavior feels native
- [ ] Status bar looks correct

---

## Known Issues & Workarounds

### Issue 1: Haptics Don't Work in iOS Simulator

**Symptom:** Haptic feedback doesn't trigger in iOS Simulator
**Cause:** Simulator doesn't support haptic hardware
**Workaround:** Test on physical iOS device
**Impact:** Low (development only)

### Issue 2: Safe Area Insets Not Available on Older iOS

**Symptom:** `env(safe-area-inset-*)` returns 0 on iOS < 11
**Cause:** CSS environment variables introduced in iOS 11
**Workaround:** Using `max()` function provides fallback padding
**Impact:** None (iOS 11+ is minimum supported)

### Issue 3: Pull-to-Refresh May Conflict with Native Scroll

**Symptom:** On some devices, pull-to-refresh feels janky
**Cause:** Browser's native pull-to-refresh may interfere
**Workaround:** Capacitor config disables native pull-to-refresh
**Impact:** Low (works on most devices)

### Issue 4: Android Back Button in Browser

**Symptom:** Back button hook doesn't work in browser
**Cause:** Capacitor App plugin only works on native platforms
**Workaround:** Hook checks platform and becomes no-op on web
**Impact:** None (expected behavior)

---

## Platform Differences Summary

| Feature | iOS | Android | Web |
|---------|-----|---------|-----|
| Safe Areas | ✅ Full support | ⚠️ Limited (no notch) | ❌ Fallback padding only |
| Status Bar | ✅ Light style | ✅ Dark background + light icons | ❌ N/A |
| Haptic Feedback | ✅ Full support | ❌ No-op | ❌ No-op |
| Back Button | ❌ Uses swipe gestures | ✅ Full support | ❌ Uses browser back |
| Pull-to-Refresh | ✅ Haptic feedback | ✅ No haptic | ✅ Works but no haptic |
| Touch Targets | ✅ 44pt minimum | ✅ 48dp minimum | ✅ Works |

---

## Future Enhancements

### Potential Improvements

1. **iOS Swipe Gestures**
   - Implement custom swipe-to-go-back gesture
   - Requires more complex gesture handling

2. **Android Navigation Bar**
   - Match navigation bar color to app theme
   - Use StatusBar plugin's navigation bar APIs

3. **Adaptive Icons**
   - Platform-specific icon styles
   - iOS: Rounded square, Android: Adaptive

4. **Dark Mode Switching**
   - Detect system dark mode preference
   - Update status bar style dynamically

5. **Landscape Support**
   - Adjust safe areas for landscape orientation
   - Different layouts for tablets

6. **Android Haptics**
   - Implement vibration patterns for Android
   - Different API than iOS haptics

---

## Troubleshooting

### Haptics Not Working

**Check:**
1. Testing on physical device? (Simulator doesn't support haptics)
2. Device not in silent mode? (Affects haptics on some devices)
3. iOS version 10+?
4. App has proper permissions?

### Safe Areas Not Working

**Check:**
1. Running on iOS device with notch/Dynamic Island?
2. Capacitor viewport meta tag configured?
3. Testing on iOS 11+?
4. Inspecting actual rendered padding values?

### Back Button Not Working

**Check:**
1. Testing on Android device/emulator?
2. Capacitor App plugin installed?
3. `useBackButton` hook properly configured?
4. Check console for errors?

### Pull-to-Refresh Not Working

**Check:**
1. Scrolled to top of list?
2. Touch events being captured?
3. Threshold distance set correctly?
4. `refreshList()` function available in context?

---

## Related Files

### Hooks
- `src/hooks/usePlatform.ts` - Platform detection
- `src/hooks/useHaptics.ts` - Haptic feedback
- `src/hooks/useBackButton.ts` - Android back button

### Components
- `src/App.tsx` - Status bar initialization
- `src/pages/Chat.tsx` - Safe areas, haptics, back button
- `src/components/chat/ChatInput.tsx` - Safe areas, haptics, touch targets
- `src/components/chat/MessageList.tsx` - Safe areas
- `src/components/layout/Drawer.tsx` - Safe areas, touch targets
- `src/components/conversations/ConversationList.tsx` - Pull-to-refresh
- `src/components/conversations/ConversationItem.tsx` - Haptics, touch targets
- `src/components/conversations/DeleteConfirmation.tsx` - Haptics, safe areas
- `src/components/conversations/DeleteMenu.tsx` - Safe areas

### Configuration
- `capacitor.config.ts` - Native app configuration
- `package.json` - Capacitor plugin dependencies

---

## Conclusion

These platform-specific implementations transform Ampel from a functional web wrapper into a polished, native-feeling mobile application. Each feature has been carefully implemented to respect platform conventions and provide the best user experience on iOS and Android.

**Key Achievements:**
- ✅ Content respects iOS safe areas (notch, Dynamic Island, home indicator)
- ✅ Status bar coordinates with app theme on both platforms
- ✅ Haptic feedback enhances iOS interactions
- ✅ Android back button works intuitively
- ✅ Pull-to-refresh provides manual conversation sync
- ✅ All touch targets meet platform guidelines
- ✅ Platform detection enables conditional features

**Ready for Production:** Yes, pending device testing and founder approval.

---

**Last Updated:** Phase 5.1 Implementation
**Author:** Claude (Senior Developer)
**Tested On:** iOS Simulator, Android Emulator
**Pending:** Physical device testing by founder
