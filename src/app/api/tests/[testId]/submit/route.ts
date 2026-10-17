import { relationID } from '@/access/ids'
import { payloadFromHeaders } from '@/lib/livekit'
import { gradeAnswer, normalizeQuestions } from '@/lib/tests'

type Args = {
  params: Promise<{
    testId: string
  }>
}

/** Grade and finalize a student's attempt. */
export async function POST(request: Request, { params }: Args) {
  const { testId } = await params
  const { payload, user } = await payloadFromHeaders(request.headers)

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as {
    attemptId?: string
    answers?: { questionId?: string; answer?: unknown }[]
  } | null

  const attemptId = body?.attemptId ? String(body.attemptId) : null
  if (!attemptId) {
    return Response.json({ error: 'Missing attempt.' }, { status: 400 })
  }

  const attempt = await payload
    .findByID({ collection: 'test-attempts', id: attemptId, depth: 0, overrideAccess: true })
    .catch(() => null)

  if (
    !attempt ||
    relationID(attempt.student) !== String(user.id) ||
    relationID(attempt.test) !== testId
  ) {
    return Response.json({ error: 'This attempt cannot be submitted.' }, { status: 403 })
  }

  if (attempt.status === 'submitted') {
    return Response.json({
      ok: true,
      score: typeof attempt.score === 'number' ? attempt.score : 0,
      totalQuestions: typeof attempt.totalQuestions === 'number' ? attempt.totalQuestions : 0,
    })
  }

  const test = await payload
    .findByID({ collection: 'tests', id: testId, depth: 0, overrideAccess: true })
    .catch(() => null)

  if (!test || test.status !== 'open') {
    return Response.json({ error: 'This test is closed.' }, { status: 403 })
  }

  const questions = normalizeQuestions(test.questions)
  const byId = new Map(questions.map((question) => [question.id, question]))
  const given = new Map<string, string[]>()

  for (const row of Array.isArray(body?.answers) ? body.answers : []) {
    if (row?.questionId) {
      given.set(String(row.questionId), asValues(row.answer))
    }
  }

  const rows = questions.map((question) => {
    const answer = given.get(question.id) ?? []
    return {
      questionId: question.id,
      questionType: question.type,
      question: question.question,
      answer,
      isCorrect: gradeAnswer(question, answer),
    }
  })

  const score = rows.filter((row) => row.isCorrect).length

  await payload.update({
    collection: 'test-attempts',
    id: attemptId,
    overrideAccess: true,
    data: {
      answers: rows,
      score,
      totalQuestions: questions.length,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
    },
  })

  return Response.json({ ok: true, score, totalQuestions: questions.length })
}

function asValues(value: unknown): string[] {
  if (typeof value === 'string') return value.trim() ? [value.trim()] : []
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item).trim()).filter(Boolean)
}
