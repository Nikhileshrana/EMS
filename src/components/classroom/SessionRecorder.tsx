'use client'

import { useRoomContext } from '@livekit/components-react'
import { upload } from '@vercel/blob/client'
import {
  ConnectionState,
  RoomEvent,
  Track,
  type LocalTrack,
  type LocalTrackPublication,
  type Participant,
  type RemoteTrack,
  type RemoteTrackPublication,
} from 'livekit-client'
import { useEffect, useRef, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { RECORDING_QUALITY, type RecordingQuality } from '@/lib/recording-quality'

/** Client-side MediaRecorder: seal and upload every ~20 MB. Final flush saves any leftover size. */
const TARGET_BYTES = 20 * 1024 * 1024
const FPS = 12

type SessionRecorderProps = {
  blobPrefix: string
  onRegisterFlush?: (flush: () => Promise<void>) => void
  quality: RecordingQuality
  sessionId: string
}

function pickMimeType() {
  const candidates = [
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm',
  ]
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || ''
}

function trackKey(participant: Participant, track: { sid?: string }) {
  return `${participant.identity}:${track.sid || 'track'}`
}

export function SessionRecorder({
  blobPrefix,
  onRegisterFlush,
  quality,
  sessionId,
}: SessionRecorderProps) {
  const room = useRoomContext()
  const settings = RECORDING_QUALITY[quality]
  const [status, setStatus] = useState(`Recording · ${settings.label}`)
  const [error, setError] = useState<string | null>(null)
  const [parts, setParts] = useState(0)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoEls = useRef(new Map<string, HTMLVideoElement>())
  const audioCtxRef = useRef<AudioContext | null>(null)
  const mixDestRef = useRef<MediaStreamAudioDestinationNode | null>(null)
  const sourcesRef = useRef(new Map<string, MediaStreamAudioSourceNode>())
  const recorderRef = useRef<MediaRecorder | null>(null)
  const mimeTypeRef = useRef('video/webm')
  const chunksRef = useRef<Blob[]>([])
  const chunkBytesRef = useRef(0)
  const partRef = useRef(1)
  const uploadingRef = useRef(Promise.resolve())
  const drawTimerRef = useRef<number | null>(null)
  const stoppedRef = useRef(false)
  const flushPromiseRef = useRef<Promise<void> | null>(null)
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const flushAndStopRef = useRef(() => Promise.resolve())

  useEffect(() => {
    stoppedRef.current = false
    flushPromiseRef.current = null
    let cancelled = false

    async function boot() {
      const canvas = canvasRef.current
      if (!canvas) {
        setError('Recorder canvas missing.')
        return
      }

      if (room.state !== ConnectionState.Connected) {
        await new Promise<void>((resolve) => {
          const onChange = (state: ConnectionState) => {
            if (state === ConnectionState.Connected) {
              room.off(RoomEvent.ConnectionStateChanged, onChange)
              resolve()
            }
          }
          room.on(RoomEvent.ConnectionStateChanged, onChange)
          if (room.state === ConnectionState.Connected) {
            room.off(RoomEvent.ConnectionStateChanged, onChange)
            resolve()
          }
        })
      }
      if (cancelled) return

      lockCanvasSize(canvas)
      // Paint at least once so captureStream has a real frame.
      const warm = canvas.getContext('2d')
      if (warm) {
        warm.fillStyle = '#111'
        warm.fillRect(0, 0, canvas.width, canvas.height)
      }

      await setupAudioMix()
      if (cancelled) return

      attachExistingTracks()
      startDrawing()
      startRecorder()
      setStatus(`Recording · ${settingsRef.current.label}`)
    }

    const onSubscribed = (
      track: RemoteTrack,
      _publication: RemoteTrackPublication,
      participant: Participant,
    ) => {
      attachMedia(track, participant)
    }
    const onUnsubscribed = (
      track: RemoteTrack,
      _publication: RemoteTrackPublication,
      participant: Participant,
    ) => {
      detachMedia(track, participant)
    }
    const onLocalPublished = (publication: LocalTrackPublication) => {
      if (publication.track) attachMedia(publication.track, room.localParticipant)
    }
    const onLocalUnpublished = (publication: LocalTrackPublication) => {
      if (publication.track) detachMedia(publication.track, room.localParticipant)
    }
    const onDisconnected = () => {
      void flushAndStopRef.current()
    }

    room.on(RoomEvent.TrackSubscribed, onSubscribed)
    room.on(RoomEvent.TrackUnsubscribed, onUnsubscribed)
    room.on(RoomEvent.LocalTrackPublished, onLocalPublished)
    room.on(RoomEvent.LocalTrackUnpublished, onLocalUnpublished)
    room.on(RoomEvent.Disconnected, onDisconnected)

    flushAndStopRef.current = flushAndStop
    onRegisterFlush?.(flushAndStop)

    void boot().catch((cause) => {
      if (!cancelled) {
        setError(cause instanceof Error ? cause.message : 'Recorder failed to start.')
        setStatus('Error')
      }
    })

    return () => {
      cancelled = true
      room.off(RoomEvent.TrackSubscribed, onSubscribed)
      room.off(RoomEvent.TrackUnsubscribed, onUnsubscribed)
      room.off(RoomEvent.LocalTrackPublished, onLocalPublished)
      room.off(RoomEvent.LocalTrackUnpublished, onLocalUnpublished)
      room.off(RoomEvent.Disconnected, onDisconnected)
      void flushAndStop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start once per mount
  }, [room, sessionId, quality])

  async function setupAudioMix() {
    const ctx = new AudioContext()
    await ctx.resume().catch(() => undefined)
    const dest = ctx.createMediaStreamDestination()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    gain.gain.value = 0.001
    osc.connect(gain)
    gain.connect(dest)
    osc.start()
    audioCtxRef.current = ctx
    mixDestRef.current = dest
  }

  function attachExistingTracks() {
    const local = room.localParticipant
    for (const publication of local.trackPublications.values()) {
      if (publication.track) attachMedia(publication.track, local)
    }
    for (const participant of room.remoteParticipants.values()) {
      for (const publication of participant.trackPublications.values()) {
        if (publication.track) attachMedia(publication.track, participant)
      }
    }
  }

  function attachMedia(track: LocalTrack | RemoteTrack, participant: Participant) {
    const key = trackKey(participant, track)
    const { width, height } = settingsRef.current

    if (track.kind === Track.Kind.Video) {
      let video = videoEls.current.get(key)
      if (!video) {
        video = document.createElement('video')
        video.muted = true
        video.playsInline = true
        video.autoplay = true
        video.width = width
        video.height = height
        videoEls.current.set(key, video)
      }
      track.attach(video)
      void video.play().catch(() => undefined)
    }

    if (track.kind === Track.Kind.Audio && mixDestRef.current && audioCtxRef.current) {
      if (sourcesRef.current.has(key)) return
      const media = new MediaStream([track.mediaStreamTrack])
      const source = audioCtxRef.current.createMediaStreamSource(media)
      source.connect(mixDestRef.current)
      sourcesRef.current.set(key, source)
    }
  }

  function detachMedia(track: LocalTrack | RemoteTrack, participant: Participant) {
    const key = trackKey(participant, track)
    if (track.kind === Track.Kind.Video) {
      const video = videoEls.current.get(key)
      if (video) {
        track.detach(video)
        video.srcObject = null
        videoEls.current.delete(key)
      }
    }
    if (track.kind === Track.Kind.Audio) {
      const source = sourcesRef.current.get(key)
      if (source) {
        source.disconnect()
        sourcesRef.current.delete(key)
      }
    }
  }

  function lockCanvasSize(canvas: HTMLCanvasElement) {
    const { width, height } = settingsRef.current
    if (canvas.width !== width) canvas.width = width
    if (canvas.height !== height) canvas.height = height
  }

  function startDrawing() {
    const canvas = canvasRef.current
    if (!canvas) return
    lockCanvasSize(canvas)
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const tick = () => {
      const { width, height } = settingsRef.current
      lockCanvasSize(canvas)
      ctx.fillStyle = '#111'
      ctx.fillRect(0, 0, width, height)
      const videos = [...videoEls.current.values()].filter((v) => v.readyState >= 2)
      if (videos.length === 0) {
        ctx.fillStyle = '#888'
        ctx.font = '24px sans-serif'
        ctx.fillText('Recording…', 40, height / 2)
      } else {
        const cols = Math.ceil(Math.sqrt(videos.length))
        const rows = Math.ceil(videos.length / cols)
        const cellW = width / cols
        const cellH = height / rows
        videos.forEach((video, index) => {
          const col = index % cols
          const row = Math.floor(index / cols)
          ctx.drawImage(video, col * cellW, row * cellH, cellW, cellH)
        })
      }
      drawTimerRef.current = window.setTimeout(tick, 1000 / FPS)
    }
    tick()
  }

  function sealCurrentPart() {
    const pieces = chunksRef.current
    const bytes = chunkBytesRef.current
    chunksRef.current = []
    chunkBytesRef.current = 0

    if (pieces.length === 0 || bytes <= 0) return

    const part = partRef.current
    partRef.current += 1
    const blob = new Blob(pieces, { type: mimeTypeRef.current })
    uploadingRef.current = uploadingRef.current
      .then(() => uploadPart(part, blob))
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : 'Upload failed.')
        setStatus('Upload error')
      })
  }

  function startRecorder() {
    const canvas = canvasRef.current
    const dest = mixDestRef.current
    if (!canvas || !dest || stoppedRef.current) return

    lockCanvasSize(canvas)
    const stream = canvas.captureStream(FPS)
    const audioTracks = dest.stream.getAudioTracks()
    if (audioTracks.length === 0) {
      setError('No audio track for recorder.')
      return
    }
    for (const track of audioTracks) {
      stream.addTrack(track)
    }

    const mimeType = pickMimeType()
    if (!mimeType && typeof MediaRecorder !== 'undefined' && !MediaRecorder.isTypeSupported('video/webm')) {
      // still try without mimeType
    }
    mimeTypeRef.current = mimeType || 'video/webm'

    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(stream, {
        mimeType: mimeType || undefined,
        videoBitsPerSecond: settingsRef.current.videoBitsPerSecond,
        audioBitsPerSecond: 64_000,
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'MediaRecorder failed.')
      return
    }

    chunksRef.current = []
    chunkBytesRef.current = 0

    recorder.ondataavailable = (event) => {
      if (!event.data.size) return
      chunksRef.current.push(event.data)
      chunkBytesRef.current += event.data.size
      if (chunkBytesRef.current >= TARGET_BYTES && recorder.state === 'recording') {
        recorder.stop()
      }
    }

    recorder.onerror = () => {
      setError('MediaRecorder error.')
      setStatus('Error')
    }

    recorder.onstop = () => {
      sealCurrentPart()
      if (!stoppedRef.current) {
        startRecorder()
      }
    }

    recorder.start(1000)
    recorderRef.current = recorder
  }

  async function uploadPart(part: number, blob: Blob) {
    const pathname = `${blobPrefix}/recordings/${sessionId}/part-${part}.webm`
    let lastError: unknown

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await upload(pathname, blob, {
          access: 'public',
          contentType: 'video/webm',
          handleUploadUrl: `/api/classroom/${sessionId}/recording`,
          multipart: blob.size > 4 * 1024 * 1024,
        })

        const save = await fetch(`/api/classroom/${sessionId}/recording/parts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            part,
            pathname: result.pathname,
            size: blob.size,
            url: result.url,
          }),
        })
        if (!save.ok) {
          const body = (await save.json().catch(() => null)) as { error?: string } | null
          throw new Error(body?.error || 'Could not save recording part.')
        }

        setParts(part)
        setStatus(
          stoppedRef.current
            ? `Saved · ${settingsRef.current.label} · part ${part}`
            : `Recording · ${settingsRef.current.label} · part ${part}`,
        )
        return
      } catch (cause) {
        lastError = cause
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)))
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Upload failed.')
  }

  async function flushAndStop() {
    if (flushPromiseRef.current) return flushPromiseRef.current

    flushPromiseRef.current = (async () => {
      stoppedRef.current = true

      if (drawTimerRef.current) {
        window.clearTimeout(drawTimerRef.current)
        drawTimerRef.current = null
      }

      const recorder = recorderRef.current
      if (recorder && recorder.state !== 'inactive') {
        await new Promise<void>((resolve) => {
          const done = () => resolve()
          recorder.addEventListener('stop', done, { once: true })
          try {
            if (recorder.state === 'recording') recorder.requestData()
          } catch {
            // stop still seals buffered data
          }
          try {
            recorder.stop()
          } catch {
            resolve()
          }
        })
      } else {
        sealCurrentPart()
      }

      await uploadingRef.current

      if (partRef.current === 1 && chunksRef.current.length === 0) {
        setStatus('No video data captured')
      }

      void audioCtxRef.current?.close().catch(() => undefined)
      for (const video of videoEls.current.values()) {
        video.srcObject = null
      }
      videoEls.current.clear()
      sourcesRef.current.clear()
    })()

    return flushPromiseRef.current
  }

  return (
    <div className="flex items-center gap-2">
      {/* Must stay in the DOM — offscreen canvas captureStream often yields empty recordings. */}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none fixed top-0 left-0 -z-10 opacity-0"
        height={settings.height}
        width={settings.width}
      />
      <Badge variant={error ? 'destructive' : 'default'}>{error || status}</Badge>
      {parts > 0 && !error ? (
        <span className="text-xs text-muted-foreground">{parts} uploaded</span>
      ) : null}
    </div>
  )
}
