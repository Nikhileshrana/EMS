'use client'

import { isAdmin, isStudent, isTeacher, roleList } from '@/access/roles'
import { useAuth } from '@payloadcms/ui'
import React, { useEffect } from 'react'

/**
 * Marks <html> with the signed-in education role so CSS can hide
 * join-table create/edit chrome for students (Payload shows Add New even when create is denied).
 */
export function AdminRoleClass() {
  const { user } = useAuth()

  useEffect(() => {
    const root = document.documentElement
    root.removeAttribute('data-ems-role')

    if (!user) return

    if (isAdmin(user)) {
      root.setAttribute('data-ems-role', 'admin')
      return
    }
    if (isTeacher(user)) {
      root.setAttribute('data-ems-role', 'teacher')
      return
    }
    if (isStudent(user) || roleList(user).includes('student')) {
      root.setAttribute('data-ems-role', 'student')
    }

    return () => {
      root.removeAttribute('data-ems-role')
    }
  }, [user])

  return null
}
