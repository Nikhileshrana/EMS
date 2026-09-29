import { createLocalReq } from 'payload'

import { relationID } from '@/access/ids'
import { userCanJoinClass } from '@/access/education'
import { displayName } from '@/access/roles'
import { issueClassroomToken, livekitConfig, payloadFromHeaders } from '@/lib/livekit'

type TokenBody = {
  room_name?: string
}

export async function POST(request: Request) {
  const { payload, user } = await payloadFromHeaders(request.headers)

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!livekitConfig()) {
    return Response.json(
      { error: 'LiveKit is not configured. Set LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL.' },
      { status: 503 },
    )
  }

  const body = (await request.json()) as TokenBody
  if (!body.room_name) {
    return Response.json({ error: 'room_name is required' }, { status: 400 })
  }

  const found = await payload.find({
    collection: 'sessions',
    depth: 1,
    limit: 1,
    overrideAccess: true,
    where: {
      roomName: { equals: body.room_name },
    },
  })

  const session = found.docs[0]
  if (!session?.roomName) {
    return Response.json({ error: 'Session not found' }, { status: 404 })
  }

  const classID = relationID(session.class)
  const req = await createLocalReq({ user }, payload)
  const membership = classID ? await userCanJoinClass(req, classID) : false

  if (!membership || session.status === 'ended') {
    return Response.json({ error: 'You cannot join this classroom.' }, { status: 403 })
  }

  if (membership === 'staff' && session.status === 'scheduled') {
    await payload.update({
      collection: 'sessions',
      id: session.id,
      data: {
        status: 'live',
        startedAt: new Date().toISOString(),
      },
      overrideAccess: true,
    })
  }

  const name = displayName(user)
  const issued = await issueClassroomToken({
    identity: String(user.id),
    name,
    roomAdmin: membership === 'staff',
    roomName: session.roomName,
  })

  return Response.json({
    server_url: issued.serverUrl,
    participant_token: issued.participantToken,
    participant_name: name,
    room_name: session.roomName,
  })
}
