import { randomUUID } from 'crypto'

import { ValidationError, type CollectionConfig } from 'payload'

import { relationID } from '../access/ids'
import { createClass, manageClassRecords, readClassRecords } from '../access/education'
import { educationPanel, hasAnyRole, isAdmin } from '../access/roles'

export const Sessions: CollectionConfig = {
  slug: 'sessions',
  labels: {
    singular: 'Live session',
    plural: 'Live sessions',
  },
  admin: {
    useAsTitle: 'title',
    group: 'Education',
    defaultColumns: ['title', 'class', 'status', 'updatedAt'],
    hidden: ({ user }) => !hasAnyRole(user, ['admin', 'teacher', 'student']),
  },
  access: {
    admin: educationPanel,
    create: createClass,
    read: readClassRecords,
    update: manageClassRecords,
    delete: manageClassRecords,
  },
  hooks: {
    beforeValidate: [
      async ({ data, operation, originalDoc, req }) => {
        if (!data) return data

        if (operation === 'create') {
          data.roomName = `ems-${randomUUID()}`
          data.status = data.status || 'scheduled'
          if (req.user) data.host = req.user.id
        }

        const classID = relationID(data?.class ?? originalDoc?.class)
        if (!classID || isAdmin(req.user) || !req.user) return data

        const classDoc = await req.payload.findByID({
          collection: 'classes',
          id: classID,
          depth: 0,
          overrideAccess: true,
        })
        const teacherIDs = (classDoc.teachers || []).map((teacher) => relationID(teacher))
        if (!teacherIDs.includes(String(req.user.id))) {
          throw new ValidationError({
            errors: [
              {
                message: 'You can only schedule a live session for a class you teach.',
                path: 'class',
              },
            ],
          })
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
      name: 'class',
      type: 'relationship',
      relationTo: 'classes',
      required: true,
      index: true,
    },
    {
      name: 'roomName',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'scheduled',
      options: [
        { label: 'Scheduled', value: 'scheduled' },
        { label: 'Live', value: 'live' },
        { label: 'Ended', value: 'ended' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'host',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'startedAt',
      type: 'date',
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'endedAt',
      type: 'date',
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'joinClassroom',
      type: 'ui',
      admin: {
        components: {
          Field: '@/components/admin/JoinClassroomLink#JoinClassroomLink',
        },
      },
    },
  ],
}
