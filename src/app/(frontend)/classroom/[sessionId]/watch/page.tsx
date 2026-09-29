import { headers as getHeaders } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@payload-config'
import { SessionPlayer } from '@/components/classroom/SessionPlayer'
import type { Session } from '@/payload-types'

type Args = {
  params: Promise<{
    sessionId: string
  }>
}

export default async function WatchSessionPage({ params }: Args) {
  const { sessionId } = await params
  const headers = await getHeaders()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })

  if (!user) {
    redirect(`/admin/login?redirect=${encodeURIComponent(`/classroom/${sessionId}/watch`)}`)
  }

  let session: Session | null = null

  try {
    session = await payload.findByID({
      collection: 'sessions',
      id: sessionId,
      depth: 0,
      overrideAccess: false,
      user,
    })
  } catch {
    session = null
  }

  if (!session?.title) notFound()

  const found = await payload.find({
    collection: 'recording-parts',
    depth: 0,
    limit: 500,
    overrideAccess: true,
    sort: 'part',
    where: { session: { equals: sessionId } },
  })

  const partNumbers = found.docs.map((doc) => Number(doc.part)).filter((part) => Number.isFinite(part))

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <SessionPlayer
        partNumbers={partNumbers}
        sessionId={String(session.id)}
        sessionTitle={session.title}
      />
    </main>
  )
}
