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
import { useEffect, useState } from 'react'
import '@livekit/components-styles'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const tokenSource = TokenSource.endpoint('/api/livekit/token')

type ClassroomProps = {
  canEnd: boolean
  classTitle: string
  participantIdentity: string
  participantName: string
  roomName: string
  sessionId: string
  sessionTitle: string
}

export function Classroom({
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

  async function endSession() {
    setEnding(true)
    await fetch(`/api/classroom/${sessionId}/end`, { method: 'POST' })
    await session.end().catch(() => undefined)
    router.push('/admin/collections/sessions')
  }

  return (
    <SessionProvider session={session}>
      <div className="flex h-dvh flex-col bg-background text-foreground" data-lk-theme="default">
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
            {canEnd ? (
              <Button disabled={ending} onClick={() => void endSession()} variant="destructive">
                End session
              </Button>
            ) : null}
            <Button
              onClick={() => {
                void session.end()
                router.push('/admin')
              }}
              variant="outline"
            >
              Leave
            </Button>
          </div>
        </header>

        {session.isConnected ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <Stage />
            <ControlBar />
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
              <CardContent className="flex flex-col gap-3">
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                <Button disabled={connect} onClick={() => setConnect(true)}>
                  {connect ? 'Connecting…' : 'Join classroom'}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </SessionProvider>
  )
}

function Stage() {
  const cameraTracks = useTracks([Track.Source.Camera])
  const screenShareTrackRef = useTracks([Track.Source.ScreenShare])[0]

  return (
    <div className="min-h-0 flex-1">
      {screenShareTrackRef ? (
        <ParticipantTile trackRef={screenShareTrackRef} />
      ) : null}
      <GridLayout tracks={cameraTracks}>
        <TrackRefContext.Consumer>
          {(trackRef) => <ParticipantTile trackRef={trackRef} />}
        </TrackRefContext.Consumer>
      </GridLayout>
    </div>
  )
}
