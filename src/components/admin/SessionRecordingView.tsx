'use client'

import { SetDocumentStepNav, useDocumentInfo } from '@payloadcms/ui'
import React, { useEffect, useState } from 'react'

import { SessionPlayer } from '@/components/classroom/SessionPlayer'

export function SessionRecordingView() {
  const { id, data, collectionSlug } = useDocumentInfo()
  const title = typeof data?.title === 'string' ? data.title : 'Live session'
  const [partNumbers, setPartNumbers] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return

    let cancelled = false

    void fetch(`/api/classroom/${id}/recording`)
      .then(async (response) => {
        const body = (await response.json()) as {
          error?: string
          parts?: { part: number }[]
        }
        if (!response.ok) throw new Error(body.error || 'Could not load recording.')
        if (!cancelled) {
          setPartNumbers((body.parts || []).map((item) => Number(item.part)).filter(Number.isFinite))
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load recording.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id])

  if (!id) return null

  return (
    <>
      <SetDocumentStepNav
        collectionSlug={collectionSlug || 'sessions'}
        id={id}
        pluralLabel="Live sessions"
        useAsTitle="title"
        view="Recording"
      />

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          width: '100%',
          padding: '2rem 1.5rem 3rem',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ width: '100%', maxWidth: 880 }}>
          {loading ? <p>Loading recording…</p> : null}
          {error ? <p>{error}</p> : null}
          {!loading && !error ? (
            partNumbers.length > 0 ? (
              <SessionPlayer
                partNumbers={partNumbers}
                sessionId={String(id)}
                sessionTitle={title}
              />
            ) : (
              <p style={{ textAlign: 'center' }}>
                No recording yet. Keep “Record this session?” on when you join the classroom. It appears
                here after End or Leave.
              </p>
            )
          ) : null}
        </div>
      </div>
    </>
  )
}
