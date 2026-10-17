import { headers as getHeaders } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { createLocalReq, getPayload } from 'payload'

import config from '@payload-config'
import { TestRunner } from '@/components/test/TestRunner'
import { testAccessFor } from '@/lib/tests'

type Args = {
  params: Promise<{
    testId: string
  }>
}

export default async function TestPage({ params }: Args) {
  const { testId } = await params
  const headers = await getHeaders()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })

  if (!user) {
    redirect(`/admin/login?redirect=${encodeURIComponent(`/test/${testId}`)}`)
  }

  const test = await payload
    .findByID({ collection: 'tests', id: testId, depth: 1, overrideAccess: true })
    .catch(() => null)

  if (!test) notFound()

  const req = await createLocalReq({ user }, payload)
  const access = await testAccessFor(req, test)

  if (access.kind === 'denied') notFound()
  if (access.kind === 'student' && test.status !== 'open') notFound()

  const classTitle =
    test.class && typeof test.class === 'object' && 'title' in test.class
      ? String(test.class.title)
      : 'Class'

  const attemptState =
    access.kind === 'student' ? access.attempt : access.kind === 'staff' ? 'preview' : 'none'

  return (
    <TestRunner
      attemptState={attemptState as 'none' | 'inProgress' | 'submitted' | 'preview'}
      classTitle={classTitle}
      testDescription={typeof test.description === 'string' ? test.description : ''}
      testId={String(test.id)}
      testTitle={test.title || 'Test'}
    />
  )
}
