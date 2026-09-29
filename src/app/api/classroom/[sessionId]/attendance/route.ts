import { createLocalReq } from 'payload'

import { relationID } from '@/access/ids'
import { userCanJoinClass } from '@/access/education'
import { displayName } from '@/access/roles'
import { endLiveSession, formatStay, markJoined, markLeft, stayFor } from '@/lib/attendance'
import { closeLiveKitRoom, payloadFromHeaders, roomHasOtherPeople } from '@/lib/livekit'

type Args = {
  params: Promise<{
    sessionId: string
  }>
}

async function loadMember(request: Request, sessionId: string) {
  const { payload, user } = await payloadFromHeaders(request.headers)

  if (!user) {
    return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const session = await payload.findByID({
    collection: 'sessions',
    id: sessionId,
    depth: 0,
    overrideAccess: true,
  })

  const classID = relationID(session.class)
  const req = await createLocalReq({ user }, payload)
  const membership = classID ? await userCanJoinClass(req, classID) : false

  if (!membership) {
    return { error: Response.json({ error: 'You cannot view this session.' }, { status: 403 }) }
  }

  return { payload, session, user }
}

export async function GET(request: Request, { params }: Args) {
  const { sessionId } = await params
  const loaded = await loadMember(request, sessionId)
  if ('error' in loaded && loaded.error) return loaded.error

  const { payload } = loaded
  const found = await payload.find({
    collection: 'attendance',
    depth: 0,
    limit: 200,
    overrideAccess: true,
    sort: '-joinedAt',
    where: { session: { equals: sessionId } },
  })

  const attendance = found.docs
    .map((doc) => {
      const stay = stayFor(doc.joinedAt, doc.leftAt, doc.lastSeenAt)
      return {
        id: doc.id,
        inSession: stay.inSession,
        name: doc.name || 'Participant',
        time: formatStay(stay),
      }
    })
    .sort((a, b) => Number(b.inSession) - Number(a.inSession))

  return Response.json({ attendance })
}

export async function POST(request: Request, { params }: Args) {
  const { sessionId } = await params
  const loaded = await loadMember(request, sessionId)
  if ('error' in loaded && loaded.error) return loaded.error

  const { payload, session, user } = loaded
  const body = (await request.json()) as { action?: string }

  if (body.action === 'leave') {
    await markLeft(payload, sessionId, String(user.id))

    const roomName = session.roomName
    const others = roomName ? await roomHasOtherPeople(roomName, String(user.id)) : null
    if (session.status === 'live' && others === false) {
      await endLiveSession(payload, sessionId)
      if (roomName) await closeLiveKitRoom(roomName)
      return Response.json({ ended: true, ok: true })
    }

    return Response.json({ ok: true })
  }

  if (session.status === 'ended') {
    return Response.json({ error: 'This session has ended.' }, { status: 403 })
  }

  await markJoined(payload, sessionId, {
    email: user.email,
    id: user.id,
    name: displayName(user),
  })

  return Response.json({ ok: true })
}
