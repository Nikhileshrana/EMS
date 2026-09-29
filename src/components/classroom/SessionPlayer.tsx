'use client'

import { useEffect, useRef, useState } from 'react'

type SessionPlayerProps = {
  partNumbers: number[]
  sessionId: string
  sessionTitle: string
}

export function SessionPlayer({ partNumbers, sessionId, sessionTitle }: SessionPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [index, setIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const part = partNumbers[index]
  const src = part ? `/api/classroom/${sessionId}/recording/stream?part=${part}` : ''

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return
    video.load()
    void video.play().catch(() => undefined)
  }, [src])

  if (partNumbers.length === 0) {
    return <p>This session has no recording.</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', alignItems: 'stretch' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.7 }}>Live session recording</p>
        <h1 style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 600 }}>{sessionTitle}</h1>
      </div>

      {error ? (
        <p style={{ color: 'var(--theme-error-500, #ff6464)', margin: 0, textAlign: 'center' }}>{error}</p>
      ) : null}

      <video
        ref={videoRef}
        controls
        controlsList="nodownload noplaybackrate"
        disablePictureInPicture
        onContextMenu={(event) => event.preventDefault()}
        onEnded={() => {
          if (index + 1 < partNumbers.length) setIndex((value) => value + 1)
        }}
        onError={() => setError('Could not play this recording.')}
        playsInline
        preload="metadata"
        src={src}
        style={{
          width: '100%',
          aspectRatio: '16 / 9',
          background: '#000',
          borderRadius: 8,
        }}
      >
        <track kind="captions" />
      </video>

      <p style={{ margin: 0, fontSize: 12, opacity: 0.65, textAlign: 'center' }}>
        Playback only — download is disabled. Sections play one after another automatically.
      </p>
    </div>
  )
}
