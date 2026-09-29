import { ValidationError, type CollectionConfig } from 'payload'

import { adminOnlyApiTab } from '../access/adminViews'
import { relationID } from '../access/ids'
import { createClass, manageClassRecords, readClassRecords } from '../access/education'
import { educationPanel, isAdmin } from '../access/roles'

export const ClassTeachers: CollectionConfig = {
  slug: 'class-teachers',
  labels: {
    singular: 'Teacher',
    plural: 'Teachers',
  },
  admin: {
    useAsTitle: 'teacher',
    group: 'Education',
    defaultColumns: ['teacher', 'class', 'updatedAt'],
    hidden: true,
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
    read: readClassRecords,
    update: manageClassRecords,
    delete: manageClassRecords,
  },
  hooks: {
    beforeValidate: [
      async ({ data, originalDoc, req }) => {
        const classID = relationID(data?.class ?? originalDoc?.class)
        const teacherID = relationID(data?.teacher ?? originalDoc?.teacher)
        if (!classID || !teacherID) return data

        const user = await req.payload.findByID({
          collection: 'users',
          id: teacherID,
          depth: 0,
          overrideAccess: true,
        })

        if (!user.roles?.includes('teacher') && !user.roles?.includes('admin')) {
          throw new ValidationError({
            errors: [
              {
                message: 'The selected user needs the Teacher or Admin role.',
                path: 'teacher',
              },
            ],
          })
        }

        if (!isAdmin(req.user) && req.user && String(req.user.id) !== teacherID) {
          const existing = await req.payload.find({
            collection: 'class-teachers',
            depth: 0,
            limit: 1,
            overrideAccess: true,
            where: {
              and: [{ class: { equals: classID } }, { teacher: { equals: String(req.user.id) } }],
            },
          })
          if (existing.totalDocs === 0) {
            throw new ValidationError({
              errors: [
                {
                  message: 'You can only manage teachers for a class you teach.',
                  path: 'class',
                },
              ],
            })
          }
        }

        const duplicate = await req.payload.find({
          collection: 'class-teachers',
          depth: 0,
          limit: 1,
          overrideAccess: true,
          where: {
            and: [
              { class: { equals: classID } },
              { teacher: { equals: teacherID } },
              ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : []),
            ],
          },
        })

        if (duplicate.totalDocs > 0) {
          throw new ValidationError({
            errors: [{ message: 'This teacher is already in the class.', path: 'teacher' }],
          })
        }

        return data
      },
    ],
    afterChange: [
      async ({ doc, req }) => {
        await syncClassTeachersArray(req, relationID(doc.class))
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        await syncClassTeachersArray(req, relationID(doc.class))
      },
    ],
  },
  fields: [
    {
      name: 'class',
      type: 'relationship',
      relationTo: 'classes',
      required: true,
      index: true,
      admin: {
        hidden: true,
      },
    },
    {
      name: 'teacher',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      filterOptions: () => ({
        or: [{ roles: { contains: 'teacher' } }, { roles: { contains: 'admin' } }],
      }),
    },
  ],
}

async function syncClassTeachersArray(
  req: { payload: import('payload').Payload },
  classID: string | null,
) {
  if (!classID) return

  const rows = await req.payload.find({
    collection: 'class-teachers',
    depth: 0,
    limit: 500,
    overrideAccess: true,
    pagination: false,
    where: { class: { equals: classID } },
  })

  const teacherIDs = rows.docs
    .map((row) => relationID(row.teacher))
    .filter((id): id is string => Boolean(id))

  await req.payload.update({
    collection: 'classes',
    id: classID,
    data: { teachers: teacherIDs },
    overrideAccess: true,
    context: { syncTeachers: true },
  })
}
