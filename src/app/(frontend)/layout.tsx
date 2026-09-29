import { Geist } from 'next/font/google'
import React from 'react'

import { CapacitorShell } from '@/components/CapacitorShell'
import '../globals.css'

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-sans',
})

export const metadata = {
  description: 'Education management for classes, study material, and live sessions.',
  title: 'EMS',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover' as const,
}

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html className={geist.variable} lang="en">
      <body className="min-h-dvh font-sans antialiased">
        <CapacitorShell />
        {props.children}
      </body>
    </html>
  )
}
