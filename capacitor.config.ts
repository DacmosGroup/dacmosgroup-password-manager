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
      launchAutoHide: false,
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
