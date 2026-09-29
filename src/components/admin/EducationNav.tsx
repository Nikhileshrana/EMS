import type { NavProps } from '@payloadcms/ui/rsc'
import { DefaultNav } from '@payloadcms/ui/rsc'
import React from 'react'

import { MobileBottomNav } from './MobileBottomNav'

export function EducationNav(props: NavProps) {
  return (
    <>
      <DefaultNav {...props} />
      <MobileBottomNav />
    </>
  )
}
