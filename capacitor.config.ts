import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize, KeyboardStyle } from '@capacitor/keyboard';

const config: CapacitorConfig = {
  appId: 'com.ampel.app',
  appName: 'Ampel',
  webDir: 'dist',
  server: {
    url: 'http://192.168.1.165:5173',  // ← Your dev server
    cleartext: true,                    // ← Allow HTTP (needed for local dev)
    androidScheme: 'https'
  },
  plugins: {
    Keyboard: {
      resize: KeyboardResize.None,       // Don't auto-resize - we handle it manually for smooth animation
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