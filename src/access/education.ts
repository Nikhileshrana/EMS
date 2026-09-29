import type { Access, PayloadRequest, Where } from 'payload'

import { relationID } from './ids'
import { hasAnyRole, isAdmin, isTeacher } from './roles'

const memberRoles = ['admin', 'teacher', 'student'] as const

async function enrolledClassIDs(req: PayloadRequest, userID: string): Promise<string[]> {
  const enrollments = await req.payload.find({
    collection: 'enrollments',
    depth: 0,
    limit: 1000,
    overrideAccess: true,
    pagination: false,
    where: {
      and: [{ student: { equals: userID } }, { status: { equals: 'active' } }],
    },
  })

  return enrollments.docs
    .map((doc) => relationID(doc.class))
    .filter((id): id is string => Boolean(id))
}

async function taughtClassIDs(req: PayloadRequest, userID: string): Promise<string[]> {
  const classes = await req.payload.find({
    collection: 'classes',
    depth: 0,
    limit: 1000,
    overrideAccess: true,
    pagination: false,
    where: {
      teachers: { contains: userID },
    },
  })

  return classes.docs.map((doc) => String(doc.id))
}

export async function memberClassIDs(req: PayloadRequest): Promise<string[] | true | false> {
  const user = req.user
  if (!user || !hasAnyRole(user, [...memberRoles])) return false
  if (isAdmin(user)) return true

  const ids = new Set<string>()

  if (isTeacher(user)) {
    for (const id of await taughtClassIDs(req, String(user.id))) ids.add(id)
  }

  if (user.roles?.includes('student')) {
    for (const id of await enrolledClassIDs(req, String(user.id))) ids.add(id)
  }

  return [...ids]
}

function classConstraint(ids: string[] | true | false, field: 'id' | 'class'): boolean | Where {
  if (ids === true) return true
  if (ids === false || ids.length === 0) return false
  return { [field]: { in: ids } }
}

export const createClass: Access = ({ req: { user } }) => isAdmin(user) || isTeacher(user)

export const readClasses: Access = async ({ req }) => classConstraint(await memberClassIDs(req), 'id')

export const manageOwnClasses: Access = ({ req: { user } }) => {
  if (!user) return false
  if (isAdmin(user)) return true
  if (isTeacher(user)) return { teachers: { contains: user.id } }
  return false
}

export const readClassRecords: Access = async ({ req }) =>
  classConstraint(await memberClassIDs(req), 'class')

export const readEnrollments: Access = async ({ req }) => {
  const user = req.user
  if (!user) return false
  if (isAdmin(user)) return true

  const constraints: Where[] = []

  if (isTeacher(user)) {
    const ids = await taughtClassIDs(req, String(user.id))
    if (ids.length > 0) constraints.push({ class: { in: ids } })
  }

  if (user.roles?.includes('student')) {
    constraints.push({ student: { equals: user.id } })
  }

  if (constraints.length === 0) return false
  if (constraints.length === 1) return constraints[0]
  return { or: constraints }
}

export const manageClassRecords: Access = async ({ req }) => {
  const user = req.user
  if (!user) return false
  if (isAdmin(user)) return true
  if (!isTeacher(user)) return false

  const ids = await taughtClassIDs(req, String(user.id))
  if (ids.length === 0) return false
  return { class: { in: ids } }
}

export const readMaterials: Access = async ({ req }) => {
  const user = req.user
  if (!user) return false
  if (isAdmin(user)) return true

  const constraints: Where[] = []

  if (isTeacher(user)) {
    const ids = await taughtClassIDs(req, String(user.id))
    if (ids.length > 0) constraints.push({ class: { in: ids } })
  }

  if (user.roles?.includes('student')) {
    const ids = await enrolledClassIDs(req, String(user.id))
    if (ids.length > 0) {
      constraints.push({
        and: [{ class: { in: ids } }, { published: { equals: true } }],
      })
    }
  }

  if (constraints.length === 0) return false
  if (constraints.length === 1) return constraints[0]
  return { or: constraints }
}

export const readStudyFiles: Access = async ({ req }) => {
  const user = req.user
  if (!user) return false
  if (isAdmin(user) || isTeacher(user)) return true
  if (!user.roles?.includes('student')) return false

  const classIDs = await enrolledClassIDs(req, String(user.id))
  if (classIDs.length === 0) return false

  const materials = await req.payload.find({
    collection: 'materials',
    depth: 0,
    limit: 1000,
    overrideAccess: true,
    pagination: false,
    where: {
      and: [{ published: { equals: true } }, { class: { in: classIDs } }],
    },
  })

  const mediaIDs = materials.docs
    .map((doc) => relationID(doc.file))
    .filter((id): id is string => Boolean(id))

  if (mediaIDs.length === 0) return false
  return { id: { in: mediaIDs } }
}

export const readAttendance: Access = async ({ req }) => {
  const classIDs = await memberClassIDs(req)
  if (classIDs === true) return true
  if (classIDs === false || classIDs.length === 0) return false

  const sessions = await req.payload.find({
    collection: 'sessions',
    depth: 0,
    limit: 1000,
    overrideAccess: true,
    pagination: false,
    where: { class: { in: classIDs } },
  })

  const sessionIDs = sessions.docs.map((doc) => String(doc.id))
  if (sessionIDs.length === 0) return false
  return { session: { in: sessionIDs } }
}

export async function userCanJoinClass(
  req: PayloadRequest,
  classID: string,
): Promise<'staff' | 'student' | false> {
  const user = req.user
  if (!user) return false
  if (isAdmin(user)) return 'staff'

  if (isTeacher(user)) {
    const teaching = await taughtClassIDs(req, String(user.id))
    if (teaching.includes(classID)) return 'staff'
  }

  if (user.roles?.includes('student')) {
    const enrolled = await enrolledClassIDs(req, String(user.id))
    if (enrolled.includes(classID)) return 'student'
  }

  return false
}
