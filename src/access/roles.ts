import type { PayloadRequest } from 'payload'

export const roleOptions = ['admin', 'teacher', 'student'] as const

export type Role = (typeof roleOptions)[number]

type WithRoles = {
  id?: number | string
  collection?: string
  roles?: string[] | null
} | null | undefined

export function hasRole(user: WithRoles, role: Role): boolean {
  return Boolean(user?.roles?.includes(role))
}

export function hasAnyRole(user: WithRoles, roles: Role[]): boolean {
  return roles.some((role) => hasRole(user, role))
}

export function isAdmin(user: WithRoles): boolean {
  return hasRole(user, 'admin')
}

export function isTeacher(user: WithRoles): boolean {
  return hasRole(user, 'teacher')
}

export function isStudent(user: WithRoles): boolean {
  return hasRole(user, 'student')
}

export const adminOnly = ({ req: { user } }: { req: PayloadRequest }) => isAdmin(user)

export const adminPanel = ({ req: { user } }: { req: PayloadRequest }) =>
  hasAnyRole(user, ['admin', 'teacher', 'student'])

export const staffPanel = ({ req: { user } }: { req: PayloadRequest }) =>
  hasAnyRole(user, ['admin', 'teacher'])

export const educationPanel = ({ req: { user } }: { req: PayloadRequest }) =>
  hasAnyRole(user, ['admin', 'teacher', 'student'])

export function roleList(user: { roles?: unknown } | null | undefined): string[] {
  if (!Array.isArray(user?.roles)) return []
  return user.roles.filter((role): role is string => typeof role === 'string')
}

export function displayName(user: { name?: string | null; email?: string | null }): string {
  return user.name?.trim() || user.email || 'Participant'
}
