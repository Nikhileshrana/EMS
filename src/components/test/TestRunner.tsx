'use client'

import {
  AlarmClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Expand,
  Loader2,
  LogOut,
  Send,
  Shrink,
  TriangleAlert,
} from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type Question = {
  id: string
  type: 'singleChoice' | 'multipleChoice' | 'trueFalse' | 'shortAnswer'
  question: string
  description?: string
  options?: { label: string; value: string }[]
  correctAnswers?: string[]
  savedAnswer?: string[]
}

type StartResponse = {
  attempt: {
    id: string
    status: string
    startedAt?: string | null
    durationMinutes: number
  } | null
  durationMinutes?: number
  preview: boolean
  questions: Question[]
  error?: string
}

type Phase = 'intro' | 'loading' | 'running' | 'submitting' | 'done' | 'error'

type Props = {
  attemptState: 'none' | 'inProgress' | 'submitted' | 'preview'
  classTitle: string
  testDescription: string
  testId: string
  testTitle: string
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function TestRunner({ attemptState, classTitle, testDescription, testId, testTitle }: Props) {
  const [phase, setPhase] = useState<Phase>(attemptState === 'submitted' ? 'done' : 'intro')
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState(attemptState === 'preview')
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [durationMinutes, setDurationMinutes] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [current, setCurrent] = useState(0)
  const [result, setResult] = useState<{ score: number; total: number } | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const rootRef = useRef<HTMLDivElement | null>(null)
  const answersRef = useRef<Record<string, string[]>>({})
  const attemptIdRef = useRef<string | null>(null)
  const phaseRef = useRef<Phase>(phase)
  const deadlineRef = useRef<number | null>(null)
  const submitGuardRef = useRef(false)

  answersRef.current = answers
  attemptIdRef.current = attemptId
  phaseRef.current = phase

  const answeredCount = useMemo(
    () => questions.filter((q) => (answers[q.id] ?? []).length > 0).length,
    [questions, answers],
  )

  const requestFullscreen = useCallback(async () => {
    const target = rootRef.current
    if (!target || document.fullscreenElement) return
    try {
      await target.requestFullscreen()
    } catch {
      // Fullscreen can be blocked (e.g. not a user gesture on some browsers) — the test still runs.
    }
  }, [])

  const exitFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) return
    try {
      await document.exitFullscreen()
    } catch {
      // ignore
    }
  }, [])

  const submit = useCallback(
    async (reason: 'manual' | 'timeout') => {
      if (submitGuardRef.current) return
      const id = attemptIdRef.current
      if (!id || phaseRef.current !== 'running') return
      submitGuardRef.current = true
      setPhase('submitting')

      try {
        const response = await fetch(`/api/tests/${testId}/submit`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attemptId: id,
            answers: Object.entries(answersRef.current).map(([questionId, answer]) => ({
              questionId,
              answer,
            })),
          }),
        })
        const body = (await response.json().catch(() => null)) as
          | { ok?: boolean; score?: number; totalQuestions?: number; error?: string }
          | null

        if (!response.ok) {
          throw new Error(body?.error || 'Could not submit the test.')
        }

        setResult({ score: body?.score ?? 0, total: body?.totalQuestions ?? questions.length })
        setPhase('done')
        void exitFullscreen()
      } catch (cause) {
        submitGuardRef.current = false
        setPhase('running')
        setError(cause instanceof Error ? cause.message : 'Could not submit the test.')
        if (reason === 'timeout') {
          // Timed submit failed — let the student try submitting manually.
          deadlineRef.current = null
          setSecondsLeft(null)
        }
      }
    },
    [exitFullscreen, questions.length, testId],
  )

  // Track fullscreen state so the badge stays accurate.
  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  // Countdown timer.
  useEffect(() => {
    if (phase !== 'running' || secondsLeft === null) return
    if (secondsLeft <= 0) {
      void submit('timeout')
      return
    }
    const timer = window.setTimeout(() => setSecondsLeft((value) => (value === null ? null : value - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [phase, secondsLeft, submit])

  // Auto-save answers while running.
  useEffect(() => {
    if (phase !== 'running' || !attemptId || preview) return
    const timer = window.setTimeout(() => {
      void fetch(`/api/tests/${testId}/start`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId,
          answers: Object.entries(answersRef.current).map(([questionId, answer]) => ({
            questionId,
            answer,
          })),
        }),
      }).catch(() => undefined)
    }, 800)
    return () => window.clearTimeout(timer)
  }, [answers, attemptId, phase, preview, testId])

  // Warn before leaving mid-test.
  useEffect(() => {
    if (phase !== 'running') return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [phase])

  const begin = async () => {
    setPhase('loading')
    setError(null)

    try {
      const response = await fetch(`/api/tests/${testId}/start`, {
        method: 'POST',
        credentials: 'include',
      })
      const body = (await response.json().catch(() => null)) as StartResponse | null

      if (!response.ok || !body) {
        throw new Error(body?.error || 'Could not start the test.')
      }

      const loaded = Array.isArray(body.questions) ? body.questions : []
      setQuestions(loaded)
      setPreview(Boolean(body.preview))

      const initial: Record<string, string[]> = {}
      for (const question of loaded) {
        if (question.savedAnswer?.length) initial[question.id] = question.savedAnswer
      }
      setAnswers(initial)
      setCurrent(0)
      submitGuardRef.current = false

      const minutes = body.attempt?.durationMinutes ?? body.durationMinutes ?? 0
      setDurationMinutes(minutes)

      if (body.attempt) {
        setAttemptId(body.attempt.id)
        if (minutes > 0 && body.attempt.startedAt) {
          const started = new Date(body.attempt.startedAt).getTime()
          const deadline = started + minutes * 60 * 1000
          deadlineRef.current = deadline
          const remaining = Math.max(0, Math.floor((deadline - Date.now()) / 1000))
          setSecondsLeft(remaining)
        } else {
          setSecondsLeft(null)
        }
      } else {
        setAttemptId(null)
        setSecondsLeft(null)
      }

      setPhase('running')
      void requestFullscreen()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start the test.')
      setPhase('error')
    }
  }

  const choose = (question: Question, value: string) => {
    setAnswers((current) => {
      const existing = current[question.id] ?? []
      if (question.type === 'multipleChoice') {
        const next = existing.includes(value)
          ? existing.filter((item) => item !== value)
          : [...existing, value]
        return { ...current, [question.id]: next }
      }
      return { ...current, [question.id]: [value] }
    })
  }

  const writeAnswer = (question: Question, value: string) => {
    setAnswers((current) => ({ ...current, [question.id]: value.trim() ? [value] : [] }))
  }

  const question = questions[current]
  const shellClasses =
    phase === 'running'
      ? 'fixed inset-0 z-[9999] flex flex-col overflow-hidden bg-slate-950 text-slate-100'
      : 'flex min-h-dvh flex-col bg-slate-950 text-slate-100'

  return (
    <div ref={rootRef} className={shellClasses}>
      <header className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
            <ClipboardList aria-hidden className="size-4.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold sm:text-base">{testTitle}</p>
            <p className="truncate text-xs text-slate-400">{classTitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {phase === 'running' && secondsLeft !== null ? (
            <span
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold tabular-nums sm:text-sm ${
                secondsLeft <= 60 ? 'bg-red-500/15 text-red-400' : 'bg-slate-800 text-slate-200'
              }`}
            >
              <AlarmClock aria-hidden className="size-3.5" />
              {formatClock(secondsLeft)}
            </span>
          ) : null}
          {phase === 'running' ? (
            <button
              aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
              className="flex size-9 items-center justify-center rounded-full bg-slate-800 text-slate-200 transition hover:bg-slate-700"
              onClick={() => (isFullscreen ? void exitFullscreen() : void requestFullscreen())}
              type="button"
            >
              {isFullscreen ? <Shrink aria-hidden className="size-4" /> : <Expand aria-hidden className="size-4" />}
            </button>
          ) : null}
          {phase === 'running' && !preview ? (
            <button
              className="flex items-center gap-1.5 rounded-full bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-sky-400 sm:text-sm"
              onClick={() => void submit('manual')}
              type="button"
            >
              <Send aria-hidden className="size-3.5" />
              Submit
            </button>
          ) : null}
        </div>
      </header>

      {phase === 'intro' || phase === 'loading' || phase === 'error' ? (
        <main className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl sm:p-8">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-400">
              <ClipboardList aria-hidden className="size-6" />
            </span>
            <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">{testTitle}</h1>
            <p className="mt-1 text-sm text-slate-400">{classTitle}</p>
            {testDescription ? (
              <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-300">{testDescription}</p>
            ) : null}
            <ul className="mt-5 space-y-2 text-sm text-slate-300">
              <li className="flex items-start gap-2">
                <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-sky-400" />
                {attemptState === 'inProgress'
                  ? 'You already started this test — pick up where you left off.'
                  : 'The test opens in full screen so you can focus.'}
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-sky-400" />
                Your answers are saved as you go.
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-sky-400" />
                {attemptState === 'preview'
                  ? 'You are previewing this test as staff — nothing is recorded.'
                  : 'You can submit once. When time runs out, the test submits itself.'}
              </li>
            </ul>
            {phase === 'error' && error ? (
              <p className="mt-4 flex items-start gap-2 rounded-xl bg-red-500/10 p-3 text-sm text-red-400">
                <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                {error}
              </p>
            ) : null}
            <button
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-60"
              disabled={phase === 'loading'}
              onClick={() => void begin()}
              type="button"
            >
              {phase === 'loading' ? (
                <>
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                  Preparing your test…
                </>
              ) : attemptState === 'preview' ? (
                'Preview test'
              ) : attemptState === 'inProgress' ? (
                'Resume test'
              ) : phase === 'error' ? (
                'Try again'
              ) : (
                'Start test'
              )}
            </button>
          </div>
        </main>
      ) : null}

      {phase === 'running' && question ? (
        <>
          <div className="border-b border-slate-800 px-4 py-2.5 sm:px-6">
            <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
              <span>
                Question {current + 1} of {questions.length}
              </span>
              <span>
                {answeredCount} of {questions.length} answered
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-sky-500 transition-all"
                style={{ width: `${questions.length ? ((current + 1) / questions.length) * 100 : 0}%` }}
              />
            </div>
          </div>

          <main className="flex flex-1 items-start justify-center overflow-y-auto px-4 py-6 sm:py-10">
            <div className="w-full max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-sky-400">
                {question.type === 'singleChoice'
                  ? 'Pick one answer'
                  : question.type === 'multipleChoice'
                    ? 'Pick every answer that applies'
                    : question.type === 'trueFalse'
                      ? 'True or false'
                      : 'Type your answer'}
                {preview && question.correctAnswers ? ' · staff preview' : ''}
              </p>
              <h2 className="mt-2 text-xl font-bold leading-snug sm:text-2xl">{question.question}</h2>
              {question.description ? (
                <p className="mt-2 text-sm text-slate-400">{question.description}</p>
              ) : null}

              <div className="mt-6 space-y-2.5">
                {question.type === 'shortAnswer' ? (
                  <input
                    autoFocus
                    className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3.5 text-base text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-sky-500"
                    onChange={(event) => writeAnswer(question, event.target.value)}
                    placeholder="Type your answer…"
                    value={answers[question.id]?.[0] ?? ''}
                  />
                ) : (
                  (question.options ?? []).map((option) => {
                    const selected = (answers[question.id] ?? []).includes(option.value)
                    const isKey = preview && question.correctAnswers?.includes(option.value)
                    return (
                      <button
                        aria-pressed={selected}
                        className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left text-sm transition sm:text-base ${
                          selected
                            ? 'border-sky-500 bg-sky-500/10 text-slate-100'
                            : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
                        }`}
                        key={option.value}
                        onClick={() => choose(question, option.value)}
                        type="button"
                      >
                        <span
                          aria-hidden
                          className={`flex size-5 shrink-0 items-center justify-center border ${
                            question.type === 'multipleChoice' ? 'rounded-md' : 'rounded-full'
                          } ${selected ? 'border-sky-400 bg-sky-500 text-slate-950' : 'border-slate-600'}`}
                        >
                          {selected ? <CheckCircle2 className="size-3.5" /> : null}
                        </span>
                        <span className="flex-1">{option.label}</span>
                        {isKey ? (
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                            Key
                          </span>
                        ) : null}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </main>

          <footer className="flex items-center justify-between gap-3 border-t border-slate-800 px-4 py-3 sm:px-6">
            <button
              className="flex items-center gap-1.5 rounded-full bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-700 disabled:opacity-40"
              disabled={current === 0}
              onClick={() => setCurrent((value) => Math.max(0, value - 1))}
              type="button"
            >
              <ChevronLeft aria-hidden className="size-4" />
              Back
            </button>
            <div className="hidden items-center gap-1.5 sm:flex">
              {questions.map((item, index) => {
                const answered = (answers[item.id] ?? []).length > 0
                return (
                  <button
                    aria-label={`Go to question ${index + 1}`}
                    aria-current={index === current ? 'true' : undefined}
                    className={`size-2.5 rounded-full transition ${
                      index === current
                        ? 'scale-125 bg-sky-400'
                        : answered
                          ? 'bg-slate-400'
                          : 'bg-slate-700 hover:bg-slate-500'
                    }`}
                    key={item.id}
                    onClick={() => setCurrent(index)}
                    type="button"
                  />
                )
              })}
            </div>
            {current < questions.length - 1 ? (
              <button
                className="flex items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-white"
                onClick={() => setCurrent((value) => Math.min(questions.length - 1, value + 1))}
                type="button"
              >
                Next
                <ChevronRight aria-hidden className="size-4" />
              </button>
            ) : preview ? (
              <a
                className="flex items-center gap-1.5 rounded-full bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-700"
                href={`/admin/collections/tests/${testId}`}
              >
                <LogOut aria-hidden className="size-4" />
                Back to editor
              </a>
            ) : (
              <button
                className="flex items-center gap-1.5 rounded-full bg-sky-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
                onClick={() => void submit('manual')}
                type="button"
              >
                <Send aria-hidden className="size-4" />
                Submit test
              </button>
            )}
          </footer>
        </>
      ) : null}

      {phase === 'submitting' ? (
        <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4">
          <Loader2 aria-hidden className="size-8 animate-spin text-sky-400" />
          <p className="text-sm text-slate-400">Submitting your answers…</p>
        </main>
      ) : null}

      {phase === 'done' ? (
        <main className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center shadow-2xl">
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
              <CheckCircle2 aria-hidden className="size-7" />
            </span>
            <h1 className="mt-4 text-2xl font-bold">Test submitted</h1>
            {result ? (
              <p className="mt-2 text-sm text-slate-300">
                You scored{' '}
                <span className="font-semibold text-slate-100">
                  {result.score} out of {result.total}
                </span>
                .
              </p>
            ) : (
              <p className="mt-2 text-sm text-slate-300">Your teacher can see your submission.</p>
            )}
            <a
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-white"
              href="/admin/collections/tests"
            >
              <LogOut aria-hidden className="size-4" />
              Back to tests
            </a>
          </div>
        </main>
      ) : null}
    </div>
  )
}
