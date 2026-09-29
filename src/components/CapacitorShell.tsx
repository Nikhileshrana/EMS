'use client'

import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { useEffect } from 'react'

/** Native-only bootstrap. No-ops in the browser. */
export function CapacitorShell() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let removeBack: (() => void) | undefined

    void (async () => {
      try {
        await StatusBar.setStyle({ style: Style.Dark })
        if (Capacitor.getPlatform() === 'android') {
          await StatusBar.setBackgroundColor({ color: '#0a0a0a' })
        }
      } catch {
        // unavailable on some simulators
      }

      try {
        await SplashScreen.hide()
      } catch {
        // ignore
      }

      const back = await CapApp.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) window.history.back()
        else void CapApp.exitApp()
      })
      removeBack = () => {
        void back.remove()
      }
    })()

    return () => {
      removeBack?.()
    }
  }, [])

  return null
}
