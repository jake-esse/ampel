import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize, KeyboardStyle } from '@capacitor/keyboard';

const config: CapacitorConfig = {
  appId: 'com.ampel.app',
  appName: 'Ampel',
  webDir: 'dist',
  server: {
    url: 'https://lithophytic-kimbery-hyetological.ngrok-free.dev',  // ← ngrok HTTPS tunnel
    cleartext: false,                   // ← Require HTTPS (needed for camera)
    androidScheme: 'https',
    // Allow Persona's domains for embedded KYC flow
    allowNavigation: [
      'withpersona.com',
      '*.withpersona.com',
      'persona.com',
      '*.persona.com'
    ]
  },
  plugins: {
    Keyboard: {
      resize: KeyboardResize.Body,       // Only resize body element, not viewport
      style: KeyboardStyle.Default,      // Use default keyboard style
      resizeOnFullScreen: true          // Resize even in fullscreen mode (Android)
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#111827',
      showSpinner: true,
      spinnerColor: '#3B82F6',
      androidSpinnerStyle: 'small',
      iosSpinnerStyle: 'small',
      splashFullScreen: true,
      splashImmersive: true
    }
  }
};

export default config;