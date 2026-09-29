'use client'

import { FormSubmit, SaveButton, toast, useDocumentInfo, useForm } from '@payloadcms/ui'
import React from 'react'

import { relationID } from '@/access/ids'

function errorMessage(body: unknown): string {
  if (!body || typeof body !== 'object') return 'Could not start the live session.'
  const record = body as {
    errors?: { message?: string; data?: { errors?: { message?: string }[] } }[]
    message?: string
  }
  const first = record.errors?.[0]
  return first?.data?.errors?.[0]?.message || first?.message || record.message || 'Could not start the live session.'
}

export function GoLiveButton() {
  const { collectionSlug = 'sessions', data, id } = useDocumentInfo()
  const { getData, setProcessing, setSubmitted, validateForm } = useForm()
  const status = typeof data?.status === 'string' ? data.status : 'scheduled'

  if (status === 'ended') return <SaveButton />

  const goLive = async () => {
    setSubmitted(true)
    const valid = await validateForm()
    if (!valid) return

    const values = getData()
    const title = typeof values.title === 'string' ? values.title.trim() : ''
    const classID = relationID(values.class)
    if (!title || !classID) return

    const startedAt = typeof data?.startedAt === 'string' ? data.startedAt : new Date().toISOString()
    setProcessing(true)

    try {
      const response = await fetch(id ? `/api/${collectionSlug}/${id}` : `/api/${collectionSlug}`, {
        body: JSON.stringify({
          class: classID,
          startedAt,
          status: 'live',
          title,
        }),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: id ? 'PATCH' : 'POST',
      })
      const body: unknown = await response.json().catch(() => null)

      if (!response.ok) {
        toast.error(errorMessage(body))
        setProcessing(false)
        return
      }

      const savedID =
        body && typeof body === 'object' && 'doc' in body ? relationID((body as { doc?: unknown }).doc) : null
      const sessionID = savedID || (id ? String(id) : null)
      if (!sessionID) {
        toast.error('The session was saved, but the classroom could not be opened.')
        setProcessing(false)
        return
      }

      window.location.assign(`/classroom/${sessionID}`)
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not start the live session.')
      setProcessing(false)
    }
  }

  return (
    <FormSubmit buttonId="action-save" onClick={() => void goLive()} size="medium" type="button">
      Go Live
    </FormSubmit>
  )
}
