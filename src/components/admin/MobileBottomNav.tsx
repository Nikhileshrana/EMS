'use client'

import { isAdmin, isStudent, isTeacher } from '@/access/roles'
import { useAuth, useNav } from '@payloadcms/ui'
import {
  BookOpen,
  ClipboardCheck,
  FileText,
  UserRound,
  Video,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

type Tab = {
  href: string
  icon: LucideIcon
  label: string
  match: (pathname: string) => boolean
}

const sharedTabs: Tab[] = [
  {
    href: '/admin/collections/classes',
    icon: BookOpen,
    label: 'Classes',
    match: (path) => path.includes('/collections/classes'),
  },
  {
    href: '/admin/collections/materials',
    icon: FileText,
    label: 'Materials',
    match: (path) => path.includes('/collections/materials'),
  },
  {
    href: '/admin/collections/sessions',
    icon: Video,
    label: 'Sessions',
    match: (path) => path.includes('/collections/sessions'),
  },
]

const attendanceTab: Tab = {
  href: '/admin/collections/attendance',
  icon: ClipboardCheck,
  label: 'Attendance',
  match: (path) => path.includes('/collections/attendance'),
}

const accountTab: Tab = {
  href: '/admin/account',
  icon: UserRound,
  label: 'Account',
  match: (path) => path.includes('/account'),
}

function tabsFor(user: { roles?: string[] | null } | null | undefined): Tab[] {
  if (isTeacher(user)) return [...sharedTabs, attendanceTab, accountTab]
  return [...sharedTabs, accountTab]
}

/**
 * Phone bottom tabs for teachers/students.
 * Toggles `ems-bottom-nav` on <html> so CSS hides Payload's sidebar + hamburger.
 */
export function MobileBottomNav() {
  const { user } = useAuth()
  const { setNavOpen } = useNav()
  const pathname = usePathname() || ''
  const [mounted, setMounted] = useState(false)

  const enabled = Boolean(user) && !isAdmin(user) && (isTeacher(user) || isStudent(user))

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!enabled) {
      document.documentElement.classList.remove('ems-bottom-nav')
      return
    }

    document.documentElement.classList.add('ems-bottom-nav')
    setNavOpen(false)

    return () => {
      document.documentElement.classList.remove('ems-bottom-nav')
    }
  }, [enabled, setNavOpen])

  if (!enabled || !mounted) return null

  const tabs = tabsFor(user)

  return createPortal(
    <nav aria-label="Main" className="ems-bottom-tabs">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const active = tab.match(pathname)

        return (
          <Link
            aria-current={active ? 'page' : undefined}
            className={active ? 'ems-bottom-tabs__item is-active' : 'ems-bottom-tabs__item'}
            href={tab.href}
            key={tab.href}
          >
            <Icon aria-hidden className="ems-bottom-tabs__icon" strokeWidth={active ? 2.25 : 1.75} />
            <span className="ems-bottom-tabs__label">{tab.label}</span>
          </Link>
        )
      })}
    </nav>,
    document.body,
  )
}
