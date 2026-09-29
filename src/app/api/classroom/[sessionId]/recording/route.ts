import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { createLocalReq } from 'payload'

import { relationID } from '@/access/ids'
import { userCanJoinClass } from '@/access/education'
import { payloadFromHeaders } from '@/lib/livekit'

type Args = {
  params: Promise<{
    sessionId: string
  }>
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function blobPrefix() {
  const dbName = process.env.DB_NAME
  if (!dbName) throw new Error('DB_NAME is required.')
  return dbName
}

function partPathPattern(sessionId: string) {
  return new RegExp(`^${escapeRegExp(blobPrefix())}/recordings/${escapeRegExp(sessionId)}/part-\\d+\\.webm$`)
}

async function loadStaff(request: Request, sessionId: string) {
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

  if (membership !== 'staff') {
    return { error: Response.json({ error: 'Only staff can manage recordings.' }, { status: 403 }) }
  }

  return { payload, session, user }
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
    return Response.json({ error: 'You cannot view this session.' }, { status: 403 })
  }

  const found = await payload.find({
    collection: 'recording-parts',
    depth: 0,
    limit: 500,
    overrideAccess: true,
    sort: 'part',
    where: { session: { equals: sessionId } },
  })

  return Response.json({
    hasRecording: found.docs.length > 0,
    partCount: found.docs.length,
    parts: found.docs.map((doc) => ({
      part: doc.part,
      size: doc.size,
    })),
  })
}

export async function POST(request: Request, { params }: Args) {
  const { sessionId } = await params
  const loaded = await loadStaff(request, sessionId)
  if ('error' in loaded && loaded.error) return loaded.error

  const body = (await request.json()) as HandleUploadBody

  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!partPathPattern(sessionId).test(pathname)) {
          throw new Error('Invalid recording pathname.')
        }
        return {
          allowedContentTypes: ['video/webm', 'video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus'],
          allowOverwrite: true,
          addRandomSuffix: false,
          maximumSizeInBytes: 40 * 1024 * 1024,
          tokenPayload: JSON.stringify({ sessionId }),
        }
      },
      onUploadCompleted: async () => {
        // Localhost never receives this; the recorder POSTs /parts after upload.
      },
    })

    return Response.json(json)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed.'
    return Response.json({ error: message }, { status: 400 })
  }
}
