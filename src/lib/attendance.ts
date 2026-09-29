import type { Payload } from 'payload'

import { displayName } from '@/access/roles'

const staleAfterMs = 45_000

type Stay = {
  inSession: boolean
  seconds: number
}

export function stayFor(joinedAt: string, leftAt?: string | null, lastSeenAt?: string | null): Stay {
  const start = new Date(joinedAt).getTime()
  const now = Date.now()

  if (leftAt) {
    return {
      inSession: false,
      seconds: Math.max(0, Math.round((new Date(leftAt).getTime() - start) / 1000)),
    }
  }

  const lastSeen = new Date(lastSeenAt || joinedAt).getTime()
  const inSession = now - lastSeen <= staleAfterMs
  const end = inSession ? now : lastSeen

  return {
    inSession,
    seconds: Math.max(0, Math.round((end - start) / 1000)),
  }
}

export function formatStay(stay: Stay): string {
  const hours = Math.floor(stay.seconds / 3600)
  const minutes = Math.floor((stay.seconds % 3600) / 60)
  const seconds = stay.seconds % 60
  const clock =
    hours > 0 ? `${hours}h ${minutes}m` : minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`

  return stay.inSession ? `In session · ${clock}` : clock
}

async function openVisit(payload: Payload, sessionID: string, userID: string) {
  const found = await payload.find({
    collection: 'attendance',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    sort: '-createdAt',
    where: {
      and: [
        { session: { equals: sessionID } },
        { participant: { equals: userID } },
        { leftAt: { exists: false } },
      ],
    },
  })

  return found.docs[0] || null
}

export async function markJoined(
  payload: Payload,
  sessionID: string,
  user: { id: string | number; name?: string | null; email?: string | null },
) {
  const now = new Date().toISOString()
  const open = await openVisit(payload, sessionID, String(user.id))

  if (open) {
    await payload.update({
      collection: 'attendance',
      id: open.id,
      data: { lastSeenAt: now },
      overrideAccess: true,
    })
    return
  }

  await payload.create({
    collection: 'attendance',
    data: {
      joinedAt: now,
      lastSeenAt: now,
      name: displayName(user),
      participant: String(user.id),
      session: sessionID,
    },
    overrideAccess: true,
  })
}

export async function markLeft(payload: Payload, sessionID: string, userID: string) {
  const open = await openVisit(payload, sessionID, userID)
  if (!open) return

  const now = new Date().toISOString()
  await payload.update({
    collection: 'attendance',
    id: open.id,
    data: {
      lastSeenAt: now,
      leftAt: now,
    },
    overrideAccess: true,
  })
}

export async function endLiveSession(payload: Payload, sessionID: string) {
  await closeSessionAttendance(payload, sessionID)
  await payload.update({
    collection: 'sessions',
    id: sessionID,
    data: {
      endedAt: new Date().toISOString(),
      status: 'ended',
    },
    overrideAccess: true,
  })
}

export async function closeSessionAttendance(payload: Payload, sessionID: string) {
  const open = await payload.find({
    collection: 'attendance',
    depth: 0,
    limit: 1000,
    overrideAccess: true,
    pagination: false,
    where: {
      and: [{ session: { equals: sessionID } }, { leftAt: { exists: false } }],
    },
  })

  const now = new Date().toISOString()
  await Promise.all(
    open.docs.map((doc) =>
      payload.update({
        collection: 'attendance',
        id: doc.id,
        data: {
          lastSeenAt: doc.lastSeenAt || now,
          leftAt: doc.lastSeenAt || now,
        },
        overrideAccess: true,
      }),
    ),
  )
}
