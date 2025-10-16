import type { CapacitorConfig } from '@capacitor/cli';

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