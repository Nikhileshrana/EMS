import { headers as getHeaders } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@payload-config'
import { displayName, isAdmin, isTeacher } from '@/access/roles'
import { Classroom } from '@/components/classroom/Classroom'
import type { Session } from '@/payload-types'

type Args = {
  params: Promise<{
    sessionId: string
  }>
}

export default async function ClassroomPage({ params }: Args) {
  const { sessionId } = await params
  const headers = await getHeaders()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })

  if (!user) {
    redirect(`/admin/login?redirect=${encodeURIComponent(`/classroom/${sessionId}`)}`)
  }

  let session: Session | null = null

  try {
    session = await payload.findByID({
      collection: 'sessions',
      id: sessionId,
      depth: 1,
      overrideAccess: false,
      user,
    })
  } catch {
    session = null
  }

  if (!session || session.status === 'ended' || !session.roomName || !session.title) {
    notFound()
  }

  const blobPrefix = process.env.DB_NAME
  if (!blobPrefix) {
    throw new Error('DB_NAME is required.')
  }

  const classTitle =
    session.class && typeof session.class === 'object' && 'title' in session.class
      ? String(session.class.title)
      : 'Class'

  return (
    <Classroom
      blobPrefix={blobPrefix}
      canEnd={isAdmin(user) || isTeacher(user)}
      classTitle={classTitle}
      participantIdentity={String(user.id)}
      participantName={displayName(user)}
      roomName={session.roomName}
      sessionId={String(session.id)}
      sessionTitle={session.title}
    />
  )
}
