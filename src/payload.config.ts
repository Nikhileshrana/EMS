import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { mcpPlugin } from '@payloadcms/plugin-mcp'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Classes } from './collections/Classes'
import { ClassTeachers } from './collections/ClassTeachers'
import { Enrollments } from './collections/Enrollments'
import { Materials } from './collections/Materials'
import { Sessions } from './collections/Sessions'
import { Attendance } from './collections/Attendance'
import { RecordingParts } from './collections/RecordingParts'
import { Media } from './collections/Media'
import { Folders } from './collections/Folders'
import { Tags } from './collections/Tags'

import { relationID } from './access/ids'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const dbName = process.env.DB_NAME
const blobToken = process.env.BLOB_READ_WRITE_TOKEN

if (!dbName) {
  throw new Error('DB_NAME is required. Every collection is stored in that database.')
}

if (!blobToken) {
  throw new Error('BLOB_READ_WRITE_TOKEN is required. Uploads are stored in Vercel Blob.')
}

export default buildConfig({
  admin: {
    user: Users.slug,
    theme: 'dark',
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      Nav: '@/components/admin/EducationNav#EducationNav',
      providers: ['@/components/admin/CapacitorProvider#CapacitorProvider'],
    },
  },
  collections: [
    Users,
    Classes,
    ClassTeachers,
    Enrollments,
    Materials,
    Sessions,
    Attendance,
    RecordingParts,
    Media,
    Folders,
    Tags,
  ],
  onInit: async (payload) => {
    const classes = await payload.find({
      collection: 'classes',
      depth: 0,
      limit: 1000,
      overrideAccess: true,
      pagination: false,
    })

    for (const classDoc of classes.docs) {
      const teacherIDs = (classDoc.teachers || [])
        .map((teacher) => relationID(teacher))
        .filter((id): id is string => Boolean(id))

      for (const teacherID of teacherIDs) {
        const existing = await payload.find({
          collection: 'class-teachers',
          depth: 0,
          limit: 1,
          overrideAccess: true,
          where: {
            and: [{ class: { equals: classDoc.id } }, { teacher: { equals: teacherID } }],
          },
        })
        if (existing.totalDocs > 0) continue

        await payload.create({
          collection: 'class-teachers',
          data: {
            class: classDoc.id,
            teacher: teacherID,
          },
          overrideAccess: true,
        })
      }
    }
  },
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: mongooseAdapter({
    url: process.env.DATABASE_URL || '',
    connectOptions: {
      dbName,
    },
  }),
  sharp,
  localization: {
    locales: ['en'],
    fallback: true,
    defaultLocale: 'en',
  },
  storage: [
    vercelBlobStorage({
      collections: {
        media: {
          prefix: dbName,
        },
      },
      clientUploads: true,
      token: blobToken,
    }),
  ],
  plugins: [mcpPlugin({})],
})
