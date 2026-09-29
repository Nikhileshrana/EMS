'use client'

import {
  ConnectionState as ConnectionStateView,
  ControlBar,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  RoomName,
  SessionProvider,
  TrackRefContext,
  useSession,
  useTracks,
} from '@livekit/components-react'
import { ConnectionState, TokenSource, Track } from 'livekit-client'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import '@livekit/components-styles'

import { AttendancePanel } from '@/components/classroom/AttendancePanel'
import { SessionRecorder } from '@/components/classroom/SessionRecorder'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  DEFAULT_RECORDING_QUALITY,
  RECORDING_QUALITY_OPTIONS,
  type RecordingQuality,
} from '@/lib/recording-quality'

const tokenSource = TokenSource.endpoint('/api/livekit/token')

type ClassroomProps = {
  blobPrefix: string
  canEnd: boolean
  classTitle: string
  participantIdentity: string
  participantName: string
  roomName: string
  sessionId: string
  sessionTitle: string
}

export function Classroom({
  blobPrefix,
  canEnd,
  classTitle,
  participantIdentity,
  participantName,
  roomName,
  sessionId,
  sessionTitle,
}: ClassroomProps) {
  const router = useRouter()
  const [connect, setConnect] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ending, setEnding] = useState(false)
  const [wantRecord, setWantRecord] = useState(canEnd)
  const [quality, setQuality] = useState<RecordingQuality>(DEFAULT_RECORDING_QUALITY)
  const [recording, setRecording] = useState(false)
  const flushRecordingRef = useRef<(() => Promise<void>) | null>(null)

  const session = useSession(tokenSource, {
    participantIdentity,
    participantName,
    roomName,
  })

  useEffect(() => {
    if (!connect) {
      void session.end().catch(() => undefined)
      return
    }

    void session
      .start({
        tracks: {
          camera: { enabled: true },
          microphone: { enabled: true },
        },
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : 'Unable to join the classroom.')
        setConnect(false)
      })
  }, [connect, session.end, session.start])

  useEffect(() => {
    if (session.connectionState === ConnectionState.Disconnected) {
      setConnect(false)
    }
  }, [session.connectionState])

  async function saveRecordingThen(next: () => Promise<void>) {
    await flushRecordingRef.current?.().catch(() => undefined)
    setRecording(false)
    flushRecordingRef.current = null
    await next()
  }

  async function endSession() {
    setEnding(true)
    await saveRecordingThen(async () => {
      await fetch(`/api/classroom/${sessionId}/end`, { method: 'POST' })
      await session.end().catch(() => undefined)
      router.push('/admin/collections/sessions')
    })
  }

  async function leaveClassroom() {
    await saveRecordingThen(async () => {
      await session.end().catch(() => undefined)
      router.push('/admin')
    })
  }

  function joinClassroom() {
    setRecording(canEnd && wantRecord)
    setConnect(true)
  }

  return (
    <SessionProvider session={session}>
      <div className="flex h-dvh flex-col bg-background text-foreground">
        <header className="flex items-center justify-between gap-4 border-b px-4 py-3">
          <div>
            <p className="text-sm text-muted-foreground">{classTitle}</p>
            <h1 className="text-lg font-semibold">{sessionTitle}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              <ConnectionStateView />
            </Badge>
            <RoomName className="text-sm text-muted-foreground" />
            {recording ? (
              <SessionRecorder
                blobPrefix={blobPrefix}
                onRegisterFlush={(flush) => {
                  flushRecordingRef.current = flush
                }}
                quality={quality}
                sessionId={sessionId}
              />
            ) : null}
            {canEnd ? (
              <Button disabled={ending} onClick={() => void endSession()} variant="destructive">
                End session
              </Button>
            ) : null}
            <Button className="text-foreground" onClick={() => void leaveClassroom()} variant="outline">
              Leave
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {session.isConnected ? (
            <div className="flex min-h-0 flex-1 flex-col" data-lk-theme="default">
              <Stage />
              <ControlBar controls={{ leave: false }} />
              <RoomAudioRenderer />
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6">
              <Card className="w-full max-w-md">
                <CardHeader>
                  <CardTitle>Join {sessionTitle}</CardTitle>
                  <CardDescription>
                    You will enter as {participantName}. Camera and microphone turn on when you join.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {canEnd ? (
                    <div className="flex flex-col gap-3 rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <Label htmlFor="record-session">Record this session?</Label>
                          <p className="text-xs text-muted-foreground">
                            Records in this tab. Uploads every ~20 MB; leftover saves on end/leave.
                          </p>
                        </div>
                        <Switch
                          checked={wantRecord}
                          id="record-session"
                          onCheckedChange={setWantRecord}
                        />
                      </div>
                      {wantRecord ? (
                        <div className="space-y-2">
                          <Label htmlFor="record-quality">Recording quality</Label>
                          <Select
                            onValueChange={(value) => setQuality(value as RecordingQuality)}
                            value={quality}
                          >
                            <SelectTrigger className="w-full" id="record-quality">
                              <SelectValue placeholder="Select quality" />
                            </SelectTrigger>
                            <SelectContent>
                              {RECORDING_QUALITY_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Highest is 720p. 480p uses less CPU and smaller uploads.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {error ? <p className="text-sm text-destructive">{error}</p> : null}
                  <Button disabled={connect} onClick={joinClassroom}>
                    {connect ? 'Connecting…' : 'Join classroom'}
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
          <AttendancePanel connected={session.isConnected} sessionId={sessionId} />
        </div>
      </div>
    </SessionProvider>
  )
}

function Stage() {
  const cameraTracks = useTracks([Track.Source.Camera])
  const screenShareTrackRef = useTracks([Track.Source.ScreenShare])[0]

  return (
    <div className="min-h-0 flex-1">
      {screenShareTrackRef ? <ParticipantTile trackRef={screenShareTrackRef} /> : null}
      <GridLayout tracks={cameraTracks}>
        <TrackRefContext.Consumer>
          {(trackRef) => <ParticipantTile trackRef={trackRef} />}
        </TrackRefContext.Consumer>
      </GridLayout>
    </div>
  )
}
