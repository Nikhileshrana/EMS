'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import React from 'react'

export function JoinClassroomLink() {
  const { id, data } = useDocumentInfo()
  const status = typeof data?.status === 'string' ? data.status : undefined

  if (!id) {
    return <p>Save this live session before opening the classroom.</p>
  }

  if (status === 'ended') {
    return <p>This session has ended.</p>
  }

  return (
    <a className="btn btn--style-primary" href={`/classroom/${id}`}>
      Join classroom
    </a>
  )
}
