import type { CollectionConfig } from 'payload'

import { adminOnlyApiTab } from '../access/adminViews'
import { readAttendance } from '../access/education'
import { adminOnly, educationPanel } from '../access/roles'

export const RecordingParts: CollectionConfig = {
  slug: 'recording-parts',
  labels: {
    singular: 'Recording part',
    plural: 'Recording parts',
  },
  admin: {
    useAsTitle: 'pathname',
    group: 'Education',
    defaultColumns: ['part', 'session', 'size', 'updatedAt'],
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
    create: adminOnly,
    delete: adminOnly,
    read: readAttendance,
    update: adminOnly,
  },
  fields: [
    {
      name: 'session',
      type: 'relationship',
      relationTo: 'sessions',
      required: true,
      index: true,
    },
    {
      name: 'part',
      type: 'number',
      required: true,
      index: true,
      min: 1,
    },
    {
      name: 'url',
      type: 'text',
      required: true,
    },
    {
      name: 'pathname',
      type: 'text',
      required: true,
    },
    {
      name: 'size',
      type: 'number',
      required: true,
      min: 0,
    },
  ],
}
