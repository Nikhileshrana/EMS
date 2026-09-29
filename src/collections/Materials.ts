import { ValidationError, type CollectionConfig, type Where } from 'payload'

import { adminOnlyApiTab } from '../access/adminViews'
import { relationID } from '../access/ids'
import { createClass, manageClassRecords, readMaterials } from '../access/education'
import { educationPanel, hasAnyRole } from '../access/roles'

export const Materials: CollectionConfig = {
  slug: 'materials',
  labels: {
    singular: 'Study material',
    plural: 'Study materials',
  },
  admin: {
    useAsTitle: 'title',
    group: 'Education',
    defaultColumns: ['title', 'class', 'source', 'published', 'updatedAt'],
    hidden: ({ user }) => !hasAnyRole(user, ['admin', 'teacher', 'student']),
    components: {
      views: {
        edit: adminOnlyApiTab,
      },
    },
  },
  versions: false,
  access: {
    admin: educationPanel,
    create: createClass,
    read: readMaterials,
    update: manageClassRecords,
    delete: manageClassRecords,
  },
  hooks: {
    beforeValidate: [
      async ({ data, operation, originalDoc, req }) => {
        if (!data) return data

        const source = (data.source || originalDoc?.source || 'file') as string
        const sessionID = relationID(data.session ?? originalDoc?.session)
        const fileID = relationID(data.file ?? originalDoc?.file)

        if (source === 'liveSession') {
          if (!sessionID) {
            throw new ValidationError({
              errors: [{ message: 'Pick a live session that has a recording.', path: 'session' }],
            })
          }

          const parts = await req.payload.count({
            collection: 'recording-parts',
            overrideAccess: true,
            where: { session: { equals: sessionID } },
          })
          if (parts.totalDocs === 0) {
            throw new ValidationError({
              errors: [{ message: 'That live session has no recording yet.', path: 'session' }],
            })
          }

          data.file = null

          if (operation === 'create' && !String(data.title || '').trim()) {
            const session = await req.payload.findByID({
              collection: 'sessions',
              id: sessionID,
              depth: 0,
              overrideAccess: true,
            })
            data.title = session.title || 'Live session recording'
          }
        } else if (!fileID) {
          throw new ValidationError({
            errors: [{ message: 'Upload a file for this study material.', path: 'file' }],
          })
        }

        return data
      },
    ],
    beforeChange: [
      ({ data, operation, req }) => {
        if (operation === 'create' && req.user) {
          data.uploadedBy = req.user.id
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
      name: 'source',
      type: 'select',
      required: true,
      defaultValue: 'file',
      options: [
        { label: 'Upload file', value: 'file' },
        { label: 'Import from live session', value: 'liveSession' },
      ],
      admin: {
        description: 'Use an existing class recording, or upload a new file.',
      },
    },
    {
      name: 'session',
      type: 'relationship',
      relationTo: 'sessions',
      index: true,
      admin: {
        condition: (_, siblingData) => siblingData?.source === 'liveSession',
        description: 'Only ended live sessions that already have a recording are listed. Pick the class first.',
      },
      filterOptions: async ({ data, req }) => {
        const classID = relationID(data?.class)
        const recorded = await req.payload.find({
          collection: 'recording-parts',
          depth: 0,
          limit: 1000,
          overrideAccess: true,
          pagination: false,
        })
        const ids = [
          ...new Set(
            recorded.docs
              .map((doc) => relationID(doc.session))
              .filter((id): id is string => Boolean(id)),
          ),
        ]

        if (ids.length === 0) return false

        const clauses: Where[] = [{ id: { in: ids } }, { status: { equals: 'ended' } }]
        if (classID) clauses.push({ class: { equals: classID } })
        return { and: clauses }
      },
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'file',
      type: 'upload',
      relationTo: 'media',
      admin: {
        condition: (_, siblingData) => siblingData?.source !== 'liveSession',
      },
    },
    {
      name: 'openRecording',
      type: 'ui',
      admin: {
        condition: (data) => data?.source === 'liveSession' && Boolean(data?.session),
        components: {
          Field: '@/components/admin/MaterialSessionLink#MaterialSessionLink',
        },
      },
    },
    {
      name: 'published',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Students only see published material.',
      },
    },
    {
      name: 'uploadedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
  ],
}
