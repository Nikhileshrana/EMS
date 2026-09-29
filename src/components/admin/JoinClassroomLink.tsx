'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import React from 'react'

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

export function JoinClassroomLink() {
  const { id, data } = useDocumentInfo()
  const status = typeof data?.status === 'string' ? data.status : undefined

  if (!id) return null

  if (status === 'ended') {
    return <p style={{ marginTop: 12 }}>This session has ended.</p>
  }

  return (
    <a className="btn btn--style-primary" href={`/classroom/${id}`} style={actionStyle}>
      Join classroom
    </a>
  )
}
