import type { CapacitorConfig } from '@capacitor/cli'
import { KeyboardResize } from '@capacitor/keyboard'
import { config as loadEnv } from 'dotenv'
import { resolve } from 'node:path'

// Cap CLI runs with cwd = mobile/
loadEnv({ path: resolve(process.cwd(), '../.env.local') })
loadEnv({ path: resolve(process.cwd(), '../.env') })

/**
 * EMS cannot use `output: 'export'` (Payload SSR, API routes, auth, LiveKit).
 * The native shell loads the running Next.js app via `server.url`.
 *
 * Set CAPACITOR_SERVER_URL to your local or deployed origin, e.g.:
 *   CAPACITOR_SERVER_URL=http://192.168.1.10:3000
 *   CAPACITOR_SERVER_URL=https://your-app.vercel.app
 */
const serverUrl = process.env.CAPACITOR_SERVER_URL?.replace(/\/$/, '')

function hostnameFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

const serverHost = serverUrl ? hostnameFromUrl(serverUrl) : null

const config: CapacitorConfig = {
  appId: 'com.blucollarz.ems',
  appName: 'EMS',
  webDir: 'www',
  backgroundColor: '#0a0a0a',
  server: {
    ...(serverUrl
      ? {
          url: serverUrl,
          cleartext: serverUrl.startsWith('http://'),
          allowNavigation: serverHost
            ? [serverHost, `*.${serverHost}`, 'localhost', '127.0.0.1']
            : ['localhost', '127.0.0.1'],
        }
      : {}),
    androidScheme: 'https',
    errorPath: 'offline.html',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#0a0a0a',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0a0a',
    },
    Keyboard: {
      resize: KeyboardResize.Body,
      resizeOnFullScreen: true,
    },
  },
}

export default config
