import { createLocalReq } from 'payload'

import { relationID } from '@/access/ids'
import { userCanJoinClass } from '@/access/education'
import { payloadFromHeaders } from '@/lib/livekit'

type Args = {
  params: Promise<{
    sessionId: string
  }>
}

export async function GET(request: Request, { params }: Args) {
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

  if (!membership) {
    return Response.json({ error: 'You cannot view this recording.' }, { status: 403 })
  }

  const partParam = new URL(request.url).searchParams.get('part')
  const part = Number(partParam)
  if (!Number.isInteger(part) || part < 1) {
    return Response.json({ error: 'part is required.' }, { status: 400 })
  }

  const found = await payload.find({
    collection: 'recording-parts',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: {
      and: [{ session: { equals: sessionId } }, { part: { equals: part } }],
    },
  })

  const doc = found.docs[0]
  if (!doc?.url) {
    return Response.json({ error: 'Recording part not found.' }, { status: 404 })
  }

  const upstream = await fetch(doc.url)
  if (!upstream.ok || !upstream.body) {
    return Response.json({ error: 'Could not load recording.' }, { status: 502 })
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') || 'video/webm',
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
