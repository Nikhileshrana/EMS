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
      ({ data, operation, req, context }) => {
        if (context?.syncTeachers) return data

        if (operation !== 'create' || !req.user || isAdmin(req.user) || !isTeacher(req.user)) {
          return data
        }

        const teachers = Array.isArray(data?.teachers) ? data.teachers : []
        const ids = teachers.map((teacher) => relationID(teacher)).filter(Boolean) as string[]
        if (!ids.includes(String(req.user.id))) {
          data.teachers = [...ids, req.user.id]
        }

        return data
      },
    ],
    afterChange: [
      async ({ doc, operation, req, context }) => {
        if (context?.syncTeachers) return doc
        if (operation !== 'create' || !req.user) return doc

        const existing = await req.payload.find({
          collection: 'class-teachers',
          depth: 0,
          limit: 1,
          overrideAccess: true,
          where: {
            and: [{ class: { equals: doc.id } }, { teacher: { equals: String(req.user.id) } }],
          },
        })

        if (existing.totalDocs === 0 && (isTeacher(req.user) || isAdmin(req.user))) {
          await req.payload.create({
            collection: 'class-teachers',
            data: {
              class: doc.id,
              teacher: req.user.id,
            },
            overrideAccess: true,
            req,
          })
        }

        return doc
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
      required: false,
      index: true,
      filterOptions: () => ({
        or: [{ roles: { contains: 'teacher' } }, { roles: { contains: 'admin' } }],
      }),
      admin: {
        hidden: true,
      },
    },
    {
      name: 'classTeachers',
      type: 'join',
      collection: 'class-teachers',
      on: 'class',
      label: 'Teachers',
      admin: {
        allowCreate: true,
        defaultColumns: ['teacher', 'updatedAt'],
        description: 'Teachers who can run this class.',
      },
    },
    {
      name: 'students',
      type: 'join',
      collection: 'enrollments',
      on: 'class',
      label: 'Students',
      admin: {
        allowCreate: true,
        defaultColumns: ['student', 'status', 'updatedAt'],
        description: 'Students enrolled in this class.',
      },
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
