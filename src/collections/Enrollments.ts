import { ValidationError, type CollectionConfig } from 'payload'

import { relationID } from '../access/ids'
import { createClass, manageClassRecords, readEnrollments } from '../access/education'
import { educationPanel, isAdmin } from '../access/roles'

export const Enrollments: CollectionConfig = {
  slug: 'enrollments',
  labels: {
    singular: 'Class student',
    plural: 'Class students',
  },
  admin: {
    useAsTitle: 'student',
    group: 'Education',
    defaultColumns: ['student', 'class', 'status'],
    hidden: true,
  },
  access: {
    admin: educationPanel,
    create: createClass,
    read: readEnrollments,
    update: manageClassRecords,
    delete: manageClassRecords,
  },
  hooks: {
    beforeValidate: [
      async ({ data, originalDoc, req }) => {
        const classID = relationID(data?.class ?? originalDoc?.class)
        const studentID = relationID(data?.student ?? originalDoc?.student)
        if (!classID || !studentID) return data

        const student = await req.payload.findByID({
          collection: 'users',
          id: studentID,
          depth: 0,
          overrideAccess: true,
        })

        if (!student.roles?.includes('student')) {
          throw new ValidationError({
            errors: [
              {
                message: 'The selected user needs the Student role.',
                path: 'student',
              },
            ],
          })
        }

        if (!isAdmin(req.user)) {
          const classDoc = await req.payload.findByID({
            collection: 'classes',
            id: classID,
            depth: 0,
            overrideAccess: true,
          })
          const teacherIDs = (classDoc.teachers || []).map((teacher) => relationID(teacher))
          if (!req.user || !teacherIDs.includes(String(req.user.id))) {
            throw new ValidationError({
              errors: [
                {
                  message: 'You can only add students to a class you teach.',
                  path: 'class',
                },
              ],
            })
          }
        }

        const duplicate = await req.payload.find({
          collection: 'enrollments',
          depth: 0,
          limit: 1,
          overrideAccess: true,
          where: {
            and: [
              { class: { equals: classID } },
              { student: { equals: studentID } },
              ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : []),
            ],
          },
        })

        if (duplicate.totalDocs > 0) {
          throw new ValidationError({
            errors: [
              {
                message: 'This student is already in the class.',
                path: 'student',
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
      name: 'student',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      filterOptions: () => ({
        roles: { contains: 'student' },
      }),
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Withdrawn', value: 'withdrawn' },
      ],
    },
  ],
}
