'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import React from 'react'

import { relationID } from '@/access/ids'

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

export function MaterialSessionLink() {
  const { data } = useDocumentInfo()
  const sessionID = relationID(data?.session)

  if (!sessionID) return null

  return (
    <a
      className="btn btn--style-primary"
      href={`/admin/collections/sessions/${sessionID}/recording`}
      style={actionStyle}
    >
      Open live session recording
    </a>
  )
}
