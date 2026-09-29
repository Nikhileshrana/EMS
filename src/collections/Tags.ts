import type { CollectionConfig } from 'payload'

import { adminOnlyApiTab } from '../access/adminViews'
import { hasAnyRole, staffPanel } from '../access/roles'

export const Tags: CollectionConfig = {
  slug: 'tags',
  admin: {
    useAsTitle: 'name',
    group: 'Library',
    hidden: ({ user }) => !hasAnyRole(user, ['admin', 'teacher']),
    components: {
      views: {
        edit: adminOnlyApiTab,
      },
    },
  },
  versions: false,
  access: {
    admin: staffPanel,
    create: staffPanel,
    delete: staffPanel,
    read: staffPanel,
    update: staffPanel,
  },
  tags: true,
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
  ],
}
