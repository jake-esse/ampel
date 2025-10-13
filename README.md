# ampel
Mobile-first AI chat application with native OAuth, streaming responses, and iframe-based app ecosystem. Built with Capacitor (Vite + React) and Supabase backend.

# Ampel Mobile App

> Native mobile AI chat app with support for third-party apps via iframes

A cross-platform mobile application that provides AI-powered conversations with the ability to run third-party MCP-based apps directly in the chat interface, similar to ChatGPT's Apps SDK.

## 🎯 Project Goals

- **Mobile-First**: Native iOS and Android app built with web technologies
- **Simple & Fast**: Clean chat interface with streaming AI responses
- **Extensible**: iframe-based architecture for third-party app integration
- **Platform Independent**: One codebase for both iOS and Android

## 🚀 Tech Stack

- **Frontend**: Vite 6 + React 19 + TypeScript
- **Mobile Shell**: Capacitor 7
- **UI**: Tailwind CSS + shadcn/ui
- **Backend**: Supabase (Auth, Database, Realtime)
- **AI**: Vercel AI SDK + xAI API
- **Auth**: Email/password + Apple Sign In + Google Sign In + Biometrics

## ✨ Features

### Current (MVP)
- ✅ Multi-provider authentication (Email, Apple, Google)
- ✅ Biometric unlock (Face ID / Touch ID)
- ✅ AI chat with streaming responses
- ✅ Conversation management
- ✅ Message persistence
- ✅ Native mobile experience

### Planned
- 🔄 Third-party app integration via Apps SDK
- 🔄 MCP server support
- 🔄 App marketplace
- 🔄 File/image upload
- 🔄 Voice input

## 🏗️ Project Structure

```
/
├── src/
│   ├── components/       # React components
│   │   ├── ui/          # shadcn base components
│   │   ├── auth/        # Authentication components
│   │   └── chat/        # Chat-specific components
│   ├── lib/             # Core utilities
│   │   ├── supabase.ts  # Supabase client
│   │   ├── ai.ts        # AI integration
│   │   └── auth/        # Auth providers (email, apple, google)
│   ├── pages/           # Route pages
│   ├── hooks/           # Custom React hooks
│   └── types/           # TypeScript definitions
├── ios/                 # iOS native project
├── android/             # Android native project
├── capacitor.config.ts  # Capacitor configuration
└── vite.config.ts       # Vite configuration
```

## 📋 Prerequisites

- Node.js 22.20.0+ (LTS)
- npm 10+ or yarn
- **iOS Development:**
  - macOS with Xcode 15+
  - Active Apple Developer account
- **Android Development:**
  - Android Studio
  - JDK 17+

## 🛠️ Setup

### 1. Clone and Install

```bash
git clone <repo-url>
cd ampel-mobile

# If using nvm, switch to Node.js 22.20.0
# (The .nvmrc file will automatically set the correct version)
nvm use

npm install
```

> **Note**: This project requires Node.js 22.20.0 or higher. The `.nvmrc` and `.node-version` files are included for automatic version switching with nvm or other Node version managers.

### 2. Environment Variables

Create `.env` file:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_ANTHROPIC_API_KEY=your_anthropic_key
```

### 3. Configure OAuth Providers

**Apple Sign In:**
1. Enable "Sign in with Apple" in Apple Developer Console
2. Create Service ID and configure redirect URL
3. Update Supabase Auth settings
4. Add capability in Xcode project

**Google Sign In:**
1. Create OAuth credentials in Google Cloud Console
2. Generate Web, iOS, and Android client IDs
3. Update Supabase Auth settings
4. Update `capacitor.config.ts` with client IDs

### 4. Supabase Setup

Run migrations in your Supabase project:

```sql
-- See /supabase/migrations for schema
```

Configure Auth providers in Supabase Dashboard:
- Enable Email provider
- Enable Apple provider (add credentials)
- Enable Google provider (add credentials)

### 5. Development

```bash
# Start dev server
npm run dev

# Sync native projects
npx cap sync

# Run on iOS
npx cap run ios

# Run on Android
npx cap run android
```

## 📱 Building for Production

### iOS

```bash
# Build web assets
npm run build

# Sync to iOS
npx cap sync ios

# Open in Xcode
npx cap open ios

# Build and archive in Xcode for TestFlight/App Store
```

### Android

```bash
# Build web assets
npm run build

# Sync to Android
npx cap sync android

# Open in Android Studio
npx cap open android

# Build APK/AAB in Android Studio
```

## 🧪 Testing

```bash
# Run tests
npm test

# Type checking
npm run type-check

# Lint
npm run lint
```

## 📚 Documentation

- [Capacitor Docs](https://capacitorjs.com/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [Apps SDK Concepts](https://developers.openai.com/apps-sdk/concepts)

## 🗺️ Roadmap

### Phase 1: MVP (Week 1) ✅
- Core chat functionality
- Multi-provider authentication
- Native mobile experience

### Phase 2: Apps SDK (Weeks 2-4)
- iframe integration in chat
- MCP server support
- Message passing between apps and chat
- Basic app sandboxing

### Phase 3: App Ecosystem (Weeks 5-8)
- App marketplace
- Developer SDK
- App discovery and installation
- Enhanced security and permissions

### Phase 4: Enhanced Features (Weeks 9-12)
- File/image support
- Voice input
- Multi-modal interactions
- Performance optimizations

## 🤝 Contributing

This is currently a private project. If you have access and want to contribute:

1. Create a feature branch
2. Make your changes
3. Test on both iOS and Android
4. Submit a pull request

## 📄 License

[Your chosen license]

## 🆘 Support

For questions or issues:
- Open a GitHub issue
- Contact: [your email]

---

**Built with Capacitor + Vite + React + Supabase**
