import { createLocalReq } from 'payload'

import { relationID } from '@/access/ids'
import { userCanJoinClass } from '@/access/education'
import { endLiveSession } from '@/lib/attendance'
import { closeLiveKitRoom, payloadFromHeaders } from '@/lib/livekit'

type Args = {
  params: Promise<{
    sessionId: string
  }>
}

export async function POST(request: Request, { params }: Args) {
  const { sessionId } = await params
  const { payload, user } = await payloadFromHeaders(request.headers)

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
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

  if (membership !== 'staff') {
    return Response.json({ error: 'Only a teacher or admin can end this session.' }, { status: 403 })
  }

  await endLiveSession(payload, String(session.id))
  if (session.roomName) await closeLiveKitRoom(session.roomName)

  return Response.json({ ok: true })
}
