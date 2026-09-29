import { Geist } from 'next/font/google'
import React from 'react'

import '../globals.css'

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-sans',
})

export const metadata = {
  description: 'Education management for classes, study material, and live sessions.',
  title: 'EMS',
}

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html className={geist.variable} lang="en">
      <body className="min-h-dvh font-sans antialiased">{props.children}</body>
    </html>
  )
}
