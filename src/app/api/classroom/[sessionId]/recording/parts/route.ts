import { createLocalReq } from 'payload'

import { relationID } from '@/access/ids'
import { userCanJoinClass } from '@/access/education'
import { payloadFromHeaders } from '@/lib/livekit'

type Args = {
  params: Promise<{
    sessionId: string
  }>
}

type PartBody = {
  part?: number
  pathname?: string
  size?: number
  url?: string
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function blobPrefix() {
  const dbName = process.env.DB_NAME
  if (!dbName) throw new Error('DB_NAME is required.')
  return dbName
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
    return Response.json({ error: 'Only staff can save recording parts.' }, { status: 403 })
  }

  const body = (await request.json()) as PartBody
  const part = typeof body.part === 'number' ? body.part : Number(body.part)
  const pathname = typeof body.pathname === 'string' ? body.pathname : ''
  const url = typeof body.url === 'string' ? body.url : ''
  const size = typeof body.size === 'number' ? body.size : Number(body.size)

  if (!Number.isInteger(part) || part < 1 || !pathname || !url || !Number.isFinite(size) || size < 0) {
    return Response.json({ error: 'part, pathname, url, and size are required.' }, { status: 400 })
  }

  const expected = new RegExp(
    `^${escapeRegExp(blobPrefix())}/recordings/${escapeRegExp(sessionId)}/part-${part}\\.webm$`,
  )
  if (!expected.test(pathname)) {
    return Response.json({ error: 'Invalid recording pathname.' }, { status: 400 })
  }

  const existing = await payload.find({
    collection: 'recording-parts',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: {
      and: [{ session: { equals: sessionId } }, { part: { equals: part } }],
    },
  })

  if (existing.docs[0]) {
    await payload.update({
      collection: 'recording-parts',
      id: existing.docs[0].id,
      data: { pathname, size, url },
      overrideAccess: true,
    })
    return Response.json({ ok: true, updated: true })
  }

  await payload.create({
    collection: 'recording-parts',
    data: {
      part,
      pathname,
      session: sessionId,
      size,
      url,
    },
    overrideAccess: true,
  })

  return Response.json({ ok: true, created: true })
}
