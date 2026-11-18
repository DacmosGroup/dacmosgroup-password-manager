import { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'co.dacmosgroup.dpm',
  appName: 'Dacmos Password Manager',
  webDir: 'web',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      // El código web nunca llama a SplashScreen.hide(): con false la app quedaba
      // tapada por el splash nativo para siempre (bug desde v0.6.0, detectado en D-1).
      launchAutoHide: true,
      launchShowDuration: 500,
      backgroundColor: '#1a1a2e',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#1a1a2e',
    },
  },
}

export default config
