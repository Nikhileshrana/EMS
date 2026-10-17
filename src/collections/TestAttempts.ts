import type { CollectionConfig } from 'payload'

import { adminOnlyApiTab } from '../access/adminViews'
import { manageClassRecords, readTestAttempts } from '../access/education'
import { educationPanel, hasAnyRole } from '../access/roles'

export const TestAttempts: CollectionConfig = {
  slug: 'test-attempts',
  labels: {
    singular: 'Test attempt',
    plural: 'Test attempts',
  },
  admin: {
    useAsTitle: 'student',
    group: 'Education',
    defaultColumns: ['student', 'test', 'status', 'score', 'submittedAt'],
    hidden: ({ user }) => !hasAnyRole(user, ['admin', 'teacher']),
    components: {
      views: {
        edit: adminOnlyApiTab,
      },
    },
  },
  versions: false,
  access: {
    admin: educationPanel,
    create: ({ req: { user } }) => Boolean(user),
    read: readTestAttempts,
    update: manageClassRecords,
    delete: manageClassRecords,
  },
  fields: [
    {
      name: 'test',
      type: 'relationship',
      relationTo: 'tests',
      required: true,
      index: true,
    },
    {
      name: 'class',
      type: 'relationship',
      relationTo: 'classes',
      required: true,
      index: true,
    },
    {
      name: 'student',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'inProgress',
      options: [
        { label: 'In progress', value: 'inProgress' },
        { label: 'Submitted', value: 'submitted' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'answers',
      type: 'array',
      labels: { singular: 'Answer', plural: 'Answers' },
      admin: {
        initCollapsed: true,
      },
      fields: [
        { name: 'questionId', type: 'text', required: true },
        { name: 'questionType', type: 'text', required: true },
        { name: 'question', type: 'textarea' },
        { name: 'answer', type: 'text', hasMany: true },
        { name: 'isCorrect', type: 'checkbox', defaultValue: false },
      ],
    },
    {
      name: 'score',
      type: 'number',
      min: 0,
      admin: {
        position: 'sidebar',
        description: 'Correct answers out of the total questions.',
      },
    },
    {
      name: 'totalQuestions',
      type: 'number',
      min: 0,
      admin: {
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
      name: 'submittedAt',
      type: 'date',
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
  ],
}
