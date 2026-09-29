import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { mcpPlugin } from '@payloadcms/plugin-mcp'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Folders } from './collections/Folders'
import { Tags } from './collections/Tags'

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
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media, Folders, Tags],
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
