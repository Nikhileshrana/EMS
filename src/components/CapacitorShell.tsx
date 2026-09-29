'use client'

import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { useEffect } from 'react'

/**
 * Bootstraps Capacitor plugins when running inside the native shell.
 * No-ops in the browser.
 */
export function CapacitorShell() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let removeBack: (() => void) | undefined
    let removeKeyboardShow: (() => void) | undefined
    let removeKeyboardHide: (() => void) | undefined

    void (async () => {
      try {
        await StatusBar.setStyle({ style: Style.Dark })
        if (Capacitor.getPlatform() === 'android') {
          await StatusBar.setBackgroundColor({ color: '#0a0a0a' })
        }
      } catch {
        // StatusBar may be unavailable on some simulators
      }

      try {
        await SplashScreen.hide()
      } catch {
        // ignore
      }

      const back = await CapApp.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back()
        } else {
          void CapApp.exitApp()
        }
      })
      removeBack = () => {
        void back.remove()
      }

      if (Capacitor.getPlatform() === 'ios') {
        const show = await Keyboard.addListener('keyboardWillShow', () => {
          document.documentElement.classList.add('capacitor-keyboard-open')
        })
        const hide = await Keyboard.addListener('keyboardWillHide', () => {
          document.documentElement.classList.remove('capacitor-keyboard-open')
        })
        removeKeyboardShow = () => {
          void show.remove()
        }
        removeKeyboardHide = () => {
          void hide.remove()
        }
      }
    })()

    return () => {
      removeBack?.()
      removeKeyboardShow?.()
      removeKeyboardHide?.()
    }
  }, [])

  return null
}
