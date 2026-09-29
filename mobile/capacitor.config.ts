import type { CapacitorConfig } from '@capacitor/cli'
import { KeyboardResize } from '@capacitor/keyboard'
import { config as loadEnv } from 'dotenv'
import { resolve } from 'node:path'

// Cap CLI runs with cwd = mobile/
loadEnv({ path: resolve(process.cwd(), '../.env.local') })
loadEnv({ path: resolve(process.cwd(), '../.env') })

/**
 * EMS cannot static-export (Payload SSR / APIs / LiveKit).
 * Native shell loads Next via CAPACITOR_SERVER_URL.
 */
const serverUrl = process.env.CAPACITOR_SERVER_URL?.replace(/\/$/, '')

function hostnameFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

function allowNavigation(url: string): string[] {
  const host = hostnameFromUrl(url)
  const hosts = ['localhost', '127.0.0.1']
  if (!host || hosts.includes(host)) return hosts

  hosts.unshift(host)
  // subdomain wildcard only for real domains, not IPs
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    hosts.splice(1, 0, `*.${host}`)
  }
  return hosts
}

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
          allowNavigation: allowNavigation(serverUrl),
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
