import type { Payload, PayloadRequest } from 'payload'

import { canManageClass, enrolledClassIDs } from '@/access/education'
import { relationID } from '@/access/ids'
import { isAdmin, isTeacher } from '@/access/roles'

export type TestQuestionType = 'singleChoice' | 'multipleChoice' | 'trueFalse' | 'shortAnswer'

export type NormalizedQuestion = {
  id: string
  type: TestQuestionType
  question: string
  description?: string
  options?: { label: string; value: string }[]
  correctAnswers: string[]
}

export type AttemptStatus = 'none' | 'inProgress' | 'submitted'

export type TestAccessResult =
  | { kind: 'staff'; attempt: null }
  | { kind: 'student'; attempt: AttemptStatus }
  | { kind: 'denied' }

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

export function normalizeText(value: unknown): string {
  return text(value).toLowerCase().replace(/\s+/g, ' ')
}

export function asStringArray(value: unknown): string[] {
  if (typeof value === 'string') return value.trim() ? [value.trim()] : []
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item).trim()).filter(Boolean)
}

/** Pull a question block (singleChoice/multipleChoice/trueFalse/shortAnswer) into a flat shape. */
export function normalizeQuestion(raw: unknown, index: number): NormalizedQuestion | null {
  if (!raw || typeof raw !== 'object') return null
  const block = raw as Record<string, unknown>
  const type = block.blockType
  if (typeof type !== 'string') return null

  const id = typeof block.id === 'string' && block.id ? block.id : `q-${index}`
  const question = text(block.question)
  const description = text(block.description) || undefined

  if (type === 'singleChoice' || type === 'multipleChoice') {
    const options: { label: string; value: string }[] = []
    for (let i = 1; i <= 5; i += 1) {
      const label = text(block[`option${i}`])
      if (label) options.push({ label, value: `option${i}` })
    }

    const correctAnswers =
      type === 'singleChoice' ? asStringArray(block.correctAnswer) : asStringArray(block.correctAnswers)

    if (!question || options.length < 2 || correctAnswers.length === 0) return null
    return { id, type: type as TestQuestionType, question, description, options, correctAnswers }
  }

  if (type === 'trueFalse') {
    const correct = text(block.correctAnswer)
    if (!question || (correct !== 'true' && correct !== 'false')) return null
    return {
      id,
      type,
      question,
      description,
      options: [
        { label: 'True', value: 'true' },
        { label: 'False', value: 'false' },
      ],
      correctAnswers: [correct],
    }
  }

  if (type === 'shortAnswer') {
    const accepted = [
      ...asStringArray(block.correctAnswer),
      ...asStringArray(block.acceptedAnswers),
    ]
    if (!question || accepted.length === 0) return null
    return { id, type, question, description, correctAnswers: accepted }
  }

  return null
}

export function normalizeQuestions(raw: unknown): NormalizedQuestion[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((block, index) => normalizeQuestion(block, index))
    .filter((q): q is NormalizedQuestion => Boolean(q))
}

export function gradeAnswer(question: NormalizedQuestion, answer: string[]): boolean {
  const given = answer.map((value) => value.trim()).filter(Boolean)

  if (question.type === 'shortAnswer') {
    const accepted = new Set(question.correctAnswers.map((value) => normalizeText(value)))
    return given.length === 1 && accepted.has(normalizeText(given[0]))
  }

  if (given.length !== question.correctAnswers.length) return false
  const expected = new Set(question.correctAnswers)
  return given.every((value) => expected.has(value))
}

/** Who is looking at this test, and how far along is their attempt? */
export async function testAccessFor(
  req: PayloadRequest,
  test: { id: string | number; class: unknown; status?: string | null },
): Promise<TestAccessResult> {
  const user = req.user
  if (!user) return { kind: 'denied' }

  const payload = req.payload
  const classID = relationID(test.class)

  if (isAdmin(user)) return { kind: 'staff', attempt: null }

  if (isTeacher(user)) {
    return (await canManageClass(req, classID))
      ? { kind: 'staff', attempt: null }
      : { kind: 'denied' }
  }

  if (!user.roles?.includes('student')) return { kind: 'denied' }

  if (!classID) return { kind: 'denied' }
  const enrolled = await enrolledClassIDs(req, String(user.id))
  if (!enrolled.includes(classID)) return { kind: 'denied' }

  const attempt = await latestAttempt(payload, String(test.id), String(user.id))
  return { kind: 'student', attempt: attempt }
}

async function latestAttempt(
  payload: Payload,
  testID: string,
  studentID: string,
): Promise<AttemptStatus> {
  const found = await payload.find({
    collection: 'test-attempts',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    sort: '-createdAt',
    where: {
      and: [{ test: { equals: testID } }, { student: { equals: studentID } }],
    },
  })
  const status = found.docs[0]?.status
  if (status === 'submitted') return 'submitted'
  if (status === 'inProgress') return 'inProgress'
  return 'none'
}
