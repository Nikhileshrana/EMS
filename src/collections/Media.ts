import type { CollectionConfig } from 'payload'

import { createFolderField, createTagField } from 'payload'

import { readStudyFiles } from '../access/education'
import { hasAnyRole, staffPanel } from '../access/roles'

export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    group: 'Library',
    hidden: ({ user }) => !hasAnyRole(user, ['admin', 'teacher']),
  },
  access: {
    admin: staffPanel,
    create: staffPanel,
    delete: staffPanel,
    read: readStudyFiles,
    update: staffPanel,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
    createFolderField({ relationTo: 'folders' }),
    createTagField({ relationTo: 'tags' }),
  ],
  upload: true,
}
