import { ValidationError, type Block, type CollectionConfig } from 'payload'

import { adminOnlyApiTab } from '../access/adminViews'
import { relationID } from '../access/ids'
import { createClass, manageClassRecords, readTests } from '../access/education'
import { educationPanel, hasAnyRole, isAdmin } from '../access/roles'

const educationWelcomeCarousel = '@/components/admin/EducationWelcomeCarousel#EducationWelcomeCarousel'
const educationListView = '@/components/admin/EducationListView#EducationListView'

const choiceOption = (label: string, value: string) => ({ label, value })

const optionFields = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    name: `option${index + 1}`,
    type: 'text' as const,
    required: true,
    label: `Option ${index + 1}`,
  }))

const correctAnswerField = (count: number, labels: string[]) => ({
  name: 'correctAnswer',
  type: 'select' as const,
  required: true,
  label: 'Correct answer',
  options: Array.from({ length: count }, (_, index) => choiceOption(labels[index], `option${index + 1}`)),
  admin: {
    description: 'The option students must pick to score this question.',
  },
})

const singleChoiceBlock: Block = {
  slug: 'singleChoice',
  labels: { singular: 'Single choice question', plural: 'Single choice questions' },
  fields: [
    { name: 'question', type: 'textarea', required: true, label: 'Question' },
    {
      name: 'description',
      type: 'textarea',
      label: 'Extra instructions',
      admin: { description: 'Shown under the question. Optional.' },
    },
    ...optionFields(4),
    correctAnswerField(4, ['Option 1', 'Option 2', 'Option 3', 'Option 4']),
  ],
}

const multipleChoiceBlock: Block = {
  slug: 'multipleChoice',
  labels: { singular: 'Multiple choice question', plural: 'Multiple choice questions' },
  fields: [
    { name: 'question', type: 'textarea', required: true, label: 'Question' },
    {
      name: 'description',
      type: 'textarea',
      label: 'Extra instructions',
      admin: { description: 'Students can pick every option that applies.' },
    },
    ...optionFields(5),
    {
      name: 'correctAnswers',
      type: 'select',
      hasMany: true,
      required: true,
      label: 'Correct answers',
      options: Array.from({ length: 5 }, (_, index) =>
        choiceOption(`Option ${index + 1}`, `option${index + 1}`),
      ),
      admin: {
        description: 'Students must pick exactly these options to score this question.',
      },
    },
  ],
}

const trueFalseBlock: Block = {
  slug: 'trueFalse',
  labels: { singular: 'True or false question', plural: 'True or false questions' },
  fields: [
    { name: 'question', type: 'textarea', required: true, label: 'Statement' },
    {
      name: 'correctAnswer',
      type: 'select',
      required: true,
      label: 'Correct answer',
      options: [choiceOption('True', 'true'), choiceOption('False', 'false')],
    },
  ],
}

const shortAnswerBlock: Block = {
  slug: 'shortAnswer',
  labels: { singular: 'Short answer question', plural: 'Short answer questions' },
  fields: [
    { name: 'question', type: 'textarea', required: true, label: 'Question' },
    {
      name: 'correctAnswer',
      type: 'text',
      required: true,
      label: 'Correct answer',
      admin: { description: 'Matching ignores letter case and extra spaces.' },
    },
    {
      name: 'acceptedAnswers',
      type: 'text',
      hasMany: true,
      label: 'Also accept',
      admin: { description: 'Alternative answers that are also correct. Optional.' },
    },
  ],
}

export const Tests: CollectionConfig = {
  slug: 'tests',
  labels: {
    singular: 'Test',
    plural: 'Tests',
  },
  admin: {
    useAsTitle: 'title',
    group: 'Education',
    defaultColumns: ['title', 'class', 'status', 'durationMinutes', 'updatedAt'],
    hidden: ({ user }) => !hasAnyRole(user, ['admin', 'teacher', 'student']),
    components: {
      beforeList: [educationWelcomeCarousel],
      views: {
        list: { Component: educationListView },
        edit: adminOnlyApiTab,
      },
    },
  },
  versions: false,
  access: {
    admin: educationPanel,
    create: createClass,
    read: readTests,
    update: manageClassRecords,
    delete: manageClassRecords,
  },
  hooks: {
    beforeValidate: [
      async ({ data, originalDoc, req }) => {
        if (!data) return data

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
                message: 'You can only create a test for a class you teach.',
                path: 'class',
              },
            ],
          })
        }

        return data
      },
    ],
    beforeChange: [
      ({ data, operation, req }) => {
        if (operation === 'create' && req.user) {
          data.createdBy = req.user.id
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
      admin: {
        description: 'Students enrolled in this class will see the test once it is open.',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Instructions',
      admin: {
        description: 'Shown to students before they start the test. Optional.',
      },
    },
    {
      name: 'questions',
      type: 'blocks',
      required: true,
      minRows: 1,
      labels: { singular: 'Question', plural: 'Questions' },
      blocks: [singleChoiceBlock, multipleChoiceBlock, trueFalseBlock, shortAnswerBlock],
    },
    {
      name: 'durationMinutes',
      type: 'number',
      min: 0,
      defaultValue: 30,
      admin: {
        position: 'sidebar',
        description: 'Minutes students get. Leave 0 for no time limit.',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Open', value: 'open' },
        { label: 'Closed', value: 'closed' },
      ],
      admin: {
        position: 'sidebar',
        description: 'Students only see open tests.',
      },
    },
    {
      name: 'attempts',
      type: 'join',
      collection: 'test-attempts',
      on: 'test',
      label: 'Student attempts',
      admin: {
        allowCreate: false,
        defaultColumns: ['student', 'status', 'score', 'submittedAt'],
        description: 'Answers submitted by students.',
      },
    },
    {
      name: 'takeTest',
      type: 'ui',
      label: 'Test page',
      admin: {
        condition: (data) => Boolean(data?.id),
        components: {
          Field: '@/components/admin/TakeTestLink#TakeTestLink',
        },
      },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
  ],
}
