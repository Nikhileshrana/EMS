import type { CollectionConfig, Where } from 'payload'

import { adminOnlyApiTab } from '../access/adminViews'
import { enrolledClassIDs } from '../access/education'
import { relationID } from '../access/ids'
import { adminOnly, adminPanel, isAdmin, isTeacher, roleOptions } from '../access/roles'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['name', 'email', 'roles'],
    group: 'Access',
    hidden: ({ user }) => !isAdmin(user),
    components: {
      views: {
        edit: adminOnlyApiTab,
      },
    },
  },
  auth: true,
  versions: false,
  access: {
    admin: adminPanel,
    create: async ({ req }) => {
      if (isAdmin(req.user)) return true
      const existing = await req.payload.count({
        collection: 'users',
        overrideAccess: true,
      })
      return existing.totalDocs === 0
    },
    delete: adminOnly,
    read: async ({ req }) => {
      const user = req.user
      if (!user) return false
      if (isAdmin(user)) return true

      if (isTeacher(user)) {
        const where: Where = {
          or: [
            { id: { equals: user.id } },
            { roles: { contains: 'student' } },
            { roles: { contains: 'teacher' } },
            { roles: { contains: 'admin' } },
          ],
        }
        return where
      }

      if (user.roles?.includes('student')) {
        const classIDs = await enrolledClassIDs(req, String(user.id))
        if (classIDs.length === 0) return { id: { equals: user.id } }

        const [teachers, classmates] = await Promise.all([
          req.payload.find({
            collection: 'class-teachers',
            depth: 0,
            limit: 1000,
            overrideAccess: true,
            pagination: false,
            where: { class: { in: classIDs } },
          }),
          req.payload.find({
            collection: 'enrollments',
            depth: 0,
            limit: 1000,
            overrideAccess: true,
            pagination: false,
            where: {
              and: [{ class: { in: classIDs } }, { status: { equals: 'active' } }],
            },
          }),
        ])

        const relatedIDs = new Set<string>([String(user.id)])
        for (const row of teachers.docs) {
          const id = relationID(row.teacher)
          if (id) relatedIDs.add(id)
        }
        for (const row of classmates.docs) {
          const id = relationID(row.student)
          if (id) relatedIDs.add(id)
        }

        return { id: { in: [...relatedIDs] } }
      }

      return { id: { equals: user.id } }
    },
    update: ({ req: { user }, id }) => {
      if (!user) return false
      if (isAdmin(user)) return true
      return relationID(user.id) === relationID(id)
    },
  },
  hooks: {
    beforeLogin: [
      async ({ req, user }) => {
        if (Array.isArray(user.roles) && user.roles.length > 0) return user

        const admins = await req.payload.count({
          collection: 'users',
          overrideAccess: true,
          where: { roles: { contains: 'admin' } },
        })

        if (admins.totalDocs > 0) return user

        await req.payload.update({
          collection: 'users',
          id: user.id,
          data: { roles: ['admin'] },
          overrideAccess: true,
        })

        return { ...user, roles: ['admin'] }
      },
    ],
    beforeChange: [
      async ({ data, operation, req }) => {
        if (operation !== 'create') return data

        const existing = await req.payload.count({
          collection: 'users',
          overrideAccess: true,
        })

        if (existing.totalDocs === 0) {
          data.roles = ['admin']
        }

        return data
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      required: true,
      defaultValue: ['student'],
      saveToJWT: true,
      options: roleOptions.map((role) => ({
        label: role.charAt(0).toUpperCase() + role.slice(1),
        value: role,
      })),
      access: {
        create: ({ req: { user } }) => !user || isAdmin(user),
        update: ({ req: { user } }) => isAdmin(user),
      },
    },
  ],
}
