'use client'

import { useAuth, useDocumentInfo } from '@payloadcms/ui'
import React from 'react'

import { isAdmin, isTeacher } from '@/access/roles'

const actionStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 40,
  padding: '10px 18px',
  marginTop: 12,
  lineHeight: 1.2,
  textDecoration: 'none',
  boxSizing: 'border-box',
}

export function TakeTestLink() {
  const { id, data } = useDocumentInfo()
  const { user } = useAuth()

  if (!id) return null

  const status = typeof data?.status === 'string' ? data.status : 'draft'
  const staff = isAdmin(user) || isTeacher(user)

  if (!staff && status !== 'open') {
    return <p style={{ marginTop: 12 }}>This test is not open yet.</p>
  }

  return (
    <a className="btn btn--style-primary" href={`/test/${id}`} style={actionStyle}>
      {staff ? 'Preview test' : 'Start test'}
    </a>
  )
}
