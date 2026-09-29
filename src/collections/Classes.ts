import type { CollectionConfig } from 'payload'

import { relationID } from '../access/ids'
import { createClass, manageOwnClasses, readClasses } from '../access/education'
import { educationPanel, hasAnyRole, isAdmin, isTeacher } from '../access/roles'

export const Classes: CollectionConfig = {
  slug: 'classes',
  labels: {
    singular: 'Class',
    plural: 'Classes',
  },
  admin: {
    useAsTitle: 'title',
    group: 'Education',
    defaultColumns: ['title', 'status', 'updatedAt'],
    hidden: ({ user }) => !hasAnyRole(user, ['admin', 'teacher', 'student']),
  },
  access: {
    admin: educationPanel,
    create: createClass,
    read: readClasses,
    update: manageOwnClasses,
    delete: manageOwnClasses,
  },
  hooks: {
    beforeChange: [
      ({ data, operation, req }) => {
        if (operation !== 'create' || !req.user || isAdmin(req.user) || !isTeacher(req.user)) {
          return data
        }

        const teachers = Array.isArray(data?.teachers) ? data.teachers : []
        const ids = teachers.map((teacher) => relationID(teacher)).filter(Boolean)
        if (!ids.includes(String(req.user.id))) {
          data.teachers = [...ids, req.user.id]
        }

        return data
      },
    ],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'slug',
      useAsSlug: 'title',
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'teachers',
      type: 'relationship',
      relationTo: 'users',
      hasMany: true,
      required: true,
      index: true,
      filterOptions: () => ({
        or: [{ roles: { contains: 'teacher' } }, { roles: { contains: 'admin' } }],
      }),
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Archived', value: 'archived' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
  ],
}
