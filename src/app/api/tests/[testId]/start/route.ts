import { createLocalReq } from 'payload'

import { relationID } from '@/access/ids'
import { payloadFromHeaders } from '@/lib/livekit'
import { gradeAnswer, normalizeQuestions, testAccessFor } from '@/lib/tests'

type Args = {
  params: Promise<{
    testId: string
  }>
}

/** Start (or resume) a student's attempt and return the full question paper. */
export async function POST(request: Request, { params }: Args) {
  const { testId } = await params
  const { payload, user } = await payloadFromHeaders(request.headers)

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const test = await payload
    .findByID({ collection: 'tests', id: testId, depth: 0, overrideAccess: true })
    .catch(() => null)

  if (!test) {
    return Response.json({ error: 'Test not found.' }, { status: 404 })
  }

  const req = await createLocalReq({ user }, payload)
  const access = await testAccessFor(req, test)

  if (access.kind === 'denied') {
    return Response.json({ error: 'You cannot take this test.' }, { status: 403 })
  }

  const classID = relationID(test.class)
  if (!classID) {
    return Response.json({ error: 'This test is not linked to a class.' }, { status: 400 })
  }
  const questions = normalizeQuestions(test.questions)

  // Staff preview: no attempt is created and correct answers are included.
  if (access.kind === 'staff') {
    return Response.json({
      attempt: null,
      preview: true,
      durationMinutes: typeof test.durationMinutes === 'number' ? test.durationMinutes : 0,
      questions: questions.map((question) => ({
        id: question.id,
        type: question.type,
        question: question.question,
        description: question.description,
        options: question.options,
        correctAnswers: question.correctAnswers,
      })),
    })
  }

  if (test.status !== 'open') {
    return Response.json({ error: 'This test is not open right now.' }, { status: 403 })
  }

  if (access.attempt === 'submitted') {
    return Response.json({ error: 'You have already submitted this test.' }, { status: 409 })
  }

  const existing = await payload.find({
    collection: 'test-attempts',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    sort: '-createdAt',
    where: {
      and: [{ test: { equals: String(test.id) } }, { student: { equals: String(user.id) } }],
    },
  })

  let attempt = existing.docs[0] ?? null

  if (!attempt) {
    attempt = await payload.create({
      collection: 'test-attempts',
      overrideAccess: true,
      data: {
        test: test.id,
        class: classID,
        student: user.id,
        status: 'inProgress',
        startedAt: new Date().toISOString(),
        totalQuestions: questions.length,
      },
    })
  }

  const answers = Array.isArray(attempt.answers) ? attempt.answers : []
  const answersByQuestion = new Map<string, string[]>()
  for (const row of answers) {
    if (row && typeof row === 'object' && 'questionId' in row) {
      const id = String((row as { questionId?: unknown }).questionId || '')
      if (id) answersByQuestion.set(id, asValues((row as { answer?: unknown }).answer))
    }
  }

  return Response.json({
    attempt: {
      id: String(attempt.id),
      status: attempt.status,
      startedAt: attempt.startedAt,
      durationMinutes: typeof test.durationMinutes === 'number' ? test.durationMinutes : 0,
    },
    preview: false,
    questions: questions.map((question) => ({
      id: question.id,
      type: question.type,
      question: question.question,
      description: question.description,
      options: question.options,
      savedAnswer: answersByQuestion.get(question.id) ?? [],
    })),
  })
}

function asValues(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item)).filter(Boolean)
}

/** Persist answers while the test is in progress (auto-save). */
export async function PATCH(request: Request, { params }: Args) {
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
    relationID(attempt.test) !== testId ||
    attempt.status !== 'inProgress'
  ) {
    return Response.json({ error: 'This attempt cannot be updated.' }, { status: 403 })
  }

  const test = await payload
    .findByID({ collection: 'tests', id: testId, depth: 0, overrideAccess: true })
    .catch(() => null)
  const questions = normalizeQuestions(test?.questions)
  const byId = new Map(questions.map((question) => [question.id, question]))

  const rows = (Array.isArray(body?.answers) ? body.answers : [])
    .map((row) => {
      const question = row?.questionId ? byId.get(String(row.questionId)) : undefined
      if (!question) return null
      return {
        questionId: question.id,
        questionType: question.type,
        question: question.question,
        answer: asValues(row?.answer),
        isCorrect: gradeAnswer(question, asValues(row?.answer)),
      }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))

  await payload.update({
    collection: 'test-attempts',
    id: attemptId,
    overrideAccess: true,
    data: { answers: rows },
  })

  return Response.json({ ok: true })
}
