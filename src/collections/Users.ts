import type { CollectionConfig, Where } from 'payload'

import { relationID } from '../access/ids'
import { adminOnly, adminPanel, isAdmin, roleOptions } from '../access/roles'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['name', 'email', 'roles'],
    group: 'Access',
    hidden: ({ user }) => !isAdmin(user),
  },
  auth: true,
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
    read: ({ req: { user } }) => {
      if (!user) return false
      if (isAdmin(user)) return true
      if (user.roles?.includes('teacher')) {
        const where: Where = {
          or: [
            { id: { equals: user.id } },
            { roles: { contains: 'student' } },
            { roles: { contains: 'teacher' } },
          ],
        }
        return where
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
  versions: false,
}
