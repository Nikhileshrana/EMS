'use client'

import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { useEffect } from 'react'

const SHELL_BG = '#ffffff'

/** Native-only bootstrap. No-ops in the browser. */
export function CapacitorShell() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let removeBack: (() => void) | undefined

    void (async () => {
      try {
        // LIGHT = dark icons (for light backgrounds)
        await StatusBar.setStyle({ style: Style.Light })
        if (Capacitor.getPlatform() === 'android') {
          await StatusBar.setBackgroundColor({ color: SHELL_BG })
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
