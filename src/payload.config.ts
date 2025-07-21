// storage-adapter-import-placeholder
import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { payloadCloudPlugin } from '@payloadcms/payload-cloud'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { r2Storage } from './plugins/storage-r2/src'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media, Pages],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: mongooseAdapter({
    url: process.env.DATABASE_URI || '',
  }),
  cors: [
    'http://localhost:3000',
    'https://localhost:3000',
    process.env.NEXT_PUBLIC_PAYLOAD_URL || '',
  ],
  csrf: [
    'http://localhost:3000',
    'https://localhost:3000',
    process.env.NEXT_PUBLIC_PAYLOAD_URL || '',
  ],
  sharp,
  plugins: [
    payloadCloudPlugin(),
    // R2 Storage Plugin
    r2Storage({
      collections: {
        media: true, // Enable R2 storage for media collection
      },
      bucket: process.env.R2_BUCKET_NAME || '',
      config: {
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
        },
        region: process.env.R2_REGION || 'auto',
        endpoint: process.env.R2_ENDPOINT || '',
      },
      // Enable client uploads for better performance (optional)
      clientUploads: process.env.NODE_ENV === 'production',
      // Enable public read access
      acl: 'public-read',
    }),
  ],
})
