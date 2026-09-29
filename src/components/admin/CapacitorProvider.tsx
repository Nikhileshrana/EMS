'use client'

import React from 'react'

import { CapacitorShell } from '@/components/CapacitorShell'

/** Wraps the Payload admin so native shell plugins also run on /admin. */
export function CapacitorProvider({ children }: { children?: React.ReactNode }) {
  return (
    <>
      <CapacitorShell />
      {children}
    </>
  )
}
