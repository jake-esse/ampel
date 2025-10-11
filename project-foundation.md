PRODUCT VISION
Build a native mobile AI chat app where users can eventually run third-party apps through iframes, similar to ChatGPT's Apps SDK implementation.
MVP Goal: Launch a clean, performant mobile chat app in 1 week.
MVP SCOPE
What We're Building (Week 1)
Core Features:
* Authentication (Email/password + Apple + Google) with biometric unlock
* AI chat interface with streaming responses
* Conversation management (create, view, delete)
* Message history persistence

Success Criteria
✅ User can sign up and login (email, Apple, or Google)✅ Social login works natively on iOS and Android✅ User can chat with Claude (streaming works)✅ Conversations persist across sessions✅ App feels native on iOS and Android✅ iframe proof of concept works

TECH STACK
- Vite 6 https://vite.dev/guide/
- React 19 https://react.dev/versions https://react.dev/learn
- TypeScript
- Capacitor 7 (native shell) https://capacitorjs.com/docs
- Supabase (backend) https://supabase.com/docs
- Vercel AI SDK (AI integration) https://ai-sdk.dev/docs/introduction
- Tailwind CSS + shadcn/ui
- Auth:         Supabase Auth + Suppose-supported Apple and Google social auth

Why This Stack:
* Vite: Fast builds, perfect for SPAs, simple Capacitor integration
* Capacitor: Native shell for web app, iframe support built-in, native OAuth
* Supabase: Proven backend, already using it, built-in OAuth support
* Vercel AI SDK: Already working, handles streaming

ARCHITECTURE
High-Level Structure
Native Shell (Capacitor)
  └── WebView
      └── Vite SPA (React)
          ├── Auth Module (Email + Apple + Google + Biometrics)
          ├── Chat Interface
          │   └── iframe container (future: third-party apps)
          └── Conversation List

APIs:
  └── Supabase (auth, database, realtime)
  └── (xAI API, implemented using Vercel’s AI SDK, using ‘grok-4-fast-non-reasoning’ and ‘grok-4-fast-reasoning’; users should be able to toggle reasoning on and off, which switches between the models, and we should also implement web search, which should also toggle on and off, using the xAI API and the chosen models)
  └── Apple Sign In (native)
  └── Google Sign In (native)

Database Schema (Supabase)
-- Profiles (extends auth.users)
profiles
  - id (uuid, FK to auth.users)
  - username (text)
  - display_name (text)
  - avatar_url (text, from social provider)
  - auth_provider (text: 'email' | 'apple' | 'google')
  - created_at (timestamp)

-- Conversations
conversations
  - id (uuid)
  - user_id (uuid, FK)
  - title (text)
  - created_at (timestamp)
  - updated_at (timestamp)

-- Messages
messages
  - id (uuid)
  - conversation_id (uuid, FK)
  - role (text: 'user' | 'assistant')
  - content (text)
  - tokens_used (int)
  - created_at (timestamp)

PROJECT STRUCTURE
/
├── src/
│   ├── components/
│   │   ├── ui/              # shadcn components
│   │   ├── chat/            # Chat-specific components
│   │   └── auth/            # Auth components
│   │       ├── EmailAuth.tsx
│   │       ├── SocialAuth.tsx
│   │       └── BiometricAuth.tsx
│   ├── lib/
│   │   ├── supabase.ts      # Supabase client
│   │   ├── ai.ts            # AI integration
│   │   └── auth/
│   │       ├── email.ts     # Email auth
│   │       ├── apple.ts     # Apple Sign In
│   │       └── google.ts    # Google Sign In
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Chat.tsx
│   │   └── Conversations.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   └── useChat.ts
│   ├── types/
│   │   └── database.ts      # Supabase types
│   ├── App.tsx
│   └── main.tsx
├── capacitor.config.ts
├── vite.config.ts
└── package.json

DEVELOPMENT APPROACH
Phase 1: Foundation (Days 1-2)
* Initialize Vite + React + TypeScript
* Add Capacitor
* Configure Supabase client
* Set up routing and basic UI shell
* Install OAuth Capacitor plugins
Phase 2: Authentication (Day 2-3)
* Email/password signup/login
* Apple Sign In (native Capacitor plugin)
* Google Sign In (native Capacitor plugin)
* Session persistence
* Biometric unlock (Capacitor plugin)
* Profile creation on first login
Phase 3: Chat Core (Days 3-4)
* Chat interface with streaming
* Message persistence
* AI integration (Vercel AI SDK)
Phase 4: Conversations (Day 4-5)
* List conversations
* Create/delete conversations
* Navigation between chats
Phase 5: Polish (Days 5-6)
* iOS/Android platform polish
* Native gestures and transitions
* Keyboard handling
* Loading states and errors
Phase 6: Build & Test (Day 6-7)
* Build for iOS and Android
* Test on devices
* iframe proof of concept
INITIAL SETUP REQUIREMENTS
Environment:
* Node.js 20+
* iOS: Xcode 15+ (for iOS builds)
* Android: Android Studio (for Android builds)
Services:
* Supabase project (existing)
* Anthropic API key
* Apple Developer account (for Sign In with Apple + TestFlight)
* Google Cloud Console project (for Google Sign In)
* Google Play Console (for testing)
OAuth Configuration Needed:
Apple:
* Enable "Sign in with Apple" capability in Xcode
* Configure Service ID in Apple Developer Console
* Add redirect URL to Supabase: https://[project-ref].supabase.co/auth/v1/callback
Google:
* Create OAuth 2.0 Client IDs in Google Cloud Console
    * Web client (for Supabase)
    * iOS client
    * Android client
* Add redirect URL to Supabase: https://[project-ref].supabase.co/auth/v1/callback
* Configure OAuth consent screen
Capacitor Plugins Needed:
{
  "@capacitor/app": "6.x",
  "@capacitor/haptics": "6.x",
  "@capacitor/keyboard": "6.x",
  "@capacitor/status-bar": "6.x",
  "@capacitor/splash-screen": "6.x",
  "@capacitor-community/biometric-auth": "5.x",
  "@capacitor-community/google-auth": "4.x",
  "@capacitor/sign-in-with-apple": "6.x"
}
AUTHENTICATION FLOW
Sign Up / Sign In Options
Login Screen:
┌─────────────────────────┐
│   Ampel Logo            │
│                         │
│  ┌───────────────────┐ │
│  │ Continue with     │ │  ← Apple Sign In (iOS)
│  │ Apple        🍎   │ │
│  └───────────────────┘ │
│                         │
│  ┌───────────────────┐ │
│  │ Continue with     │ │  ← Google Sign In (iOS + Android)
│  │ Google       G    │ │
│  └───────────────────┘ │
│                         │
│  ────── or ──────      │
│                         │
│  [Email Input]          │
│  [Password Input]       │
│  [Login Button]         │
│                         │
│  Don't have account?    │
│  [Sign Up]              │
└─────────────────────────┘
OAuth Flow
Apple Sign In:
1. User taps "Continue with Apple"
2. Native Apple dialog appears
3. User authenticates with Face ID/Touch ID
4. Capacitor plugin returns token
5. Exchange token with Supabase
6. Create/update profile
7. Navigate to chat
Google Sign In:
1. User taps "Continue with Google"
2. Native Google picker appears
3. User selects account
4. Capacitor plugin returns token
5. Exchange token with Supabase
6. Create/update profile
7. Navigate to chat
Email/Password:
1. User enters email/password
2. Supabase validates
3. Create/update profile
4. Navigate to chat
First-Time Users
On first social login:
* Create profile with data from provider
* Extract display name from OAuth
* Save avatar URL (if provided)
* Track auth provider
* Set up biometric unlock (optional prompt)

AUTH IMPLEMENTATION DETAILS
Supabase Auth Configuration
// Enable in Supabase Dashboard:
// Authentication > Providers

// Apple
{
  enabled: true,
  clientId: "com.ampel.app",
  teamId: "[Apple Team ID]",
  keyId: "[Apple Key ID]",
  privateKey: "[Apple Private Key]"
}

// Google  
{
  enabled: true,
  clientId: "[Google Client ID]",
  clientSecret: "[Google Client Secret]"
}
Capacitor Native Auth
// lib/auth/apple.ts
import { SignInWithApple } from '@capacitor/sign-in-with-apple';
import { supabase } from '../supabase';

export async function signInWithApple() {
  const result = await SignInWithApple.authorize({
    clientId: 'com.ampel.app',
    redirectURI: 'https://[project].supabase.co/auth/v1/callback',
    scopes: 'email name',
  });
  
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: result.response.identityToken,
  });
  
  return { data, error };
}

// lib/auth/google.ts
import { GoogleAuth } from '@capacitor-community/google-auth';
import { supabase } from '../supabase';

export async function signInWithGoogle() {
  const result = await GoogleAuth.signIn();
  
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: result.authentication.idToken,
  });
  
  return { data, error };
}

KEY PRINCIPLES
1. Mobile-First: Design for mobile, ignore desktop
2. Native OAuth: Use Capacitor plugins for best UX
3. Keep It Simple: No over-engineering, no premature optimization
4. Native Feel: Use native UI patterns for each platform
5. Incremental: Build and test each feature before moving on
6. Ship Fast: 1 week to working MVP, not perfect MVP

THIRD-PARTY APPS (FUTURE)
Not building now, but designing for:
* iframes in chat interface
* Apps SDK compatibility (MCP-based)
* Sandboxed execution
* Message passing between app and chat

Day 7 Proof of Concept:
* Add iframe container in chat
* Load simple HTML app
* Test message passing
* Document architecture

WHAT WE LEARNED (FROM PREVIOUS WORK)
✅ Supabase is great - keep using it✅ Vercel AI SDK works well - keep it✅ Mobile-first is correct strategy✅ iframes require web technology (Capacitor)✅ Simple auth flows work better✅ Chat apps don't need much complexity✅ Social login is table stakes for mobile apps❌ Next.js overkill for mobile wrapper❌ Pure React Native doesn't support iframes well
