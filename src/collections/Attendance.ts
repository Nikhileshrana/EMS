import type { CollectionConfig } from 'payload'

import { adminOnlyApiTab } from '../access/adminViews'
import { readAttendance } from '../access/education'
import { adminOnly, educationPanel, hasAnyRole } from '../access/roles'
import { formatStay, stayFor } from '../lib/attendance'

export const Attendance: CollectionConfig = {
  slug: 'attendance',
  labels: {
    singular: 'Attendance',
    plural: 'Attendance',
  },
  admin: {
    useAsTitle: 'name',
    group: 'Education',
    defaultColumns: ['name', 'session', 'timeInSession', 'joinedAt', 'leftAt'],
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
      name: 'participant',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
    },
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'joinedAt',
      type: 'date',
      required: true,
    },
    {
      name: 'leftAt',
      type: 'date',
    },
    {
      name: 'lastSeenAt',
      type: 'date',
      admin: {
        hidden: true,
      },
    },
    {
      name: 'timeInSession',
      type: 'text',
      virtual: true,
      admin: {
        readOnly: true,
      },
      hooks: {
        afterRead: [
          ({ siblingData }) => {
            if (!siblingData?.joinedAt) return ''
            return formatStay(
              stayFor(
                String(siblingData.joinedAt),
                siblingData.leftAt ? String(siblingData.leftAt) : null,
                siblingData.lastSeenAt ? String(siblingData.lastSeenAt) : null,
              ),
            )
          },
        ],
      },
    },
  ],
}
