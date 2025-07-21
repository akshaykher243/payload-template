import { CollectionConfig } from 'payload'
import { populateAlt } from './hooks/populateAlt'

const { NEXT_PUBLIC_BASE_URL } = process.env

const generateMediaUrl = (url: string | null) => {
  if (!url) return null
  return `${NEXT_PUBLIC_BASE_URL}${url}`
}

// Function to get proper MIME type from filename
const getMimeTypeFromFilename = (filename: string): string => {
  const ext = filename.toLowerCase().split('.').pop() || ''

  const mimeTypes: Record<string, string> = {
    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    ico: 'image/x-icon',
    tiff: 'image/tiff',
    tif: 'image/tiff',

    // Videos
    mp4: 'video/mp4',
    webm: 'video/webm',
    ogv: 'video/ogg',
    avi: 'video/x-msvideo',
    mov: 'video/quicktime',
    wmv: 'video/x-ms-wmv',
    flv: 'video/x-flv',
    mkv: 'video/x-matroska',

    // Documents
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',

    // Audio
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    oga: 'audio/ogg',
    aac: 'audio/aac',
    flac: 'audio/flac',
  }

  return mimeTypes[ext] || 'application/octet-stream'
}

export const Media: CollectionConfig = {
  slug: 'media',
  versions: {
    drafts: false,
    maxPerDoc: 0,
  },
  access: {
    read: () => true, // Public read access
    create: () => true, // Allow all to upload media
    update: () => true, // Allow all to update media
    delete: () => true, // Prevent deletion
  },
  upload: {
    imageSizes: [
      {
        name: 'thumbnail',
        width: 400,
        height: 300,
        position: 'centre',
      },
      {
        name: 'card',
        width: 768,
        height: undefined,
        position: 'centre',
      },
      {
        name: 'tablet',
        width: 1024,
        height: undefined,
        position: 'centre',
      },
    ],
    adminThumbnail: 'thumbnail',
    mimeTypes: ['image/*', 'video/*'],
  },
  hooks: {
    beforeChange: [populateAlt],
    afterChange: [
      async ({ doc }: any) => {
        console.log(`[Media Collection] After change - Document:`, {
          id: doc.id,
          filename: doc.filename,
          mimeType: doc.mimeType,
          hasSizes: !!doc.sizes,
          sizes: doc.sizes ? Object.keys(doc.sizes) : [],
          sizesData: doc.sizes,
        })
        return doc
      },
    ],
    afterRead: [
      async ({ doc }) => {
        doc.url = generateMediaUrl(doc.url)

        if (doc.sizes) {
          for (const size of Object.keys(doc.sizes)) {
            doc.sizes[size].url = generateMediaUrl(doc.sizes[size].url)
          }
        }
        return doc
      },
    ],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
}
