import type { CollectionConfig } from 'payload'

import { hasAnyRole, staffPanel } from '../access/roles'

export const Folders: CollectionConfig = {
  slug: 'folders',
  admin: {
    useAsTitle: 'name',
    group: 'Library',
    hidden: ({ user }) => !hasAnyRole(user, ['admin', 'teacher']),
  },
  access: {
    admin: staffPanel,
    create: staffPanel,
    delete: staffPanel,
    read: staffPanel,
    update: staffPanel,
  },
  folders: true,
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
  ],
}
