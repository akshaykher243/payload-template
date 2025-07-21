import { CollectionConfig } from 'payload'
import { populateAlt } from './hooks/populateAlt'
import { generateImageSizes } from './hooks/generateImageSizes'

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
    // Remove MIME type restrictions entirely to prevent validation errors
    // PayloadCMS will accept any file type, and we'll fix MIME types in hooks
  },
  hooks: {
    beforeChange: [
      populateAlt,
      async ({ data, req }: any) => {
        console.log(
          `[Media beforeChange] Processing upload for: ${data.filename || req.file?.name}`,
        )
        console.log(
          `[Media beforeChange] Request file:`,
          req.file
            ? {
                name: req.file.name,
                mimeType: req.file.mimeType,
                size: req.file.size,
              }
            : 'No file in request',
        )
        console.log(`[Media beforeChange] Data object:`, {
          filename: data.filename,
          mimeType: data.mimeType,
          filesize: data.filesize,
          url: data.url,
          sizes: data.sizes,
        })

        // Test Sharp manually if it's an image
        if (req.file && req.file.mimeType && req.file.mimeType.startsWith('image/')) {
          try {
            console.log(`[Media beforeChange] Testing Sharp processing for image`)
            const sharp = require('sharp')

            if (req.file.buffer) {
              // Test Sharp with the actual image buffer
              const metadata = await sharp(req.file.buffer).metadata()
              console.log(`[Media beforeChange] Sharp metadata:`, metadata)

              // Try to create a thumbnail manually
              const thumbnailBuffer = await sharp(req.file.buffer).resize(400, 300).toBuffer()

              console.log(
                `[Media beforeChange] Sharp thumbnail created successfully, size: ${thumbnailBuffer.length}`,
              )
            } else {
              console.log(`[Media beforeChange] No buffer available for Sharp processing`)
            }
          } catch (error) {
            console.error(`[Media beforeChange] Sharp processing failed:`, error)
          }
        }

        let mimeTypeCorrected = false
        let originalMimeType = data.mimeType

        // Fix MIME type in the file object before validation
        if (
          req.file &&
          (!req.file.mimeType ||
            req.file.mimeType === 'text/plain' ||
            req.file.mimeType.includes('text/plain'))
        ) {
          const correctMimeType = getMimeTypeFromFilename(req.file.name)
          console.log(
            `[Media beforeChange] Correcting file MIME type for ${req.file.name}: ${req.file.mimeType} -> ${correctMimeType}`,
          )
          originalMimeType = req.file.mimeType
          req.file.mimeType = correctMimeType
          mimeTypeCorrected = true
        }

        // Also fix MIME type in data object
        if (
          data.filename &&
          (!data.mimeType || data.mimeType === 'text/plain' || data.mimeType.includes('text/plain'))
        ) {
          const correctMimeType = getMimeTypeFromFilename(data.filename)
          console.log(
            `[Media beforeChange] Correcting data MIME type for ${data.filename}: ${data.mimeType} -> ${correctMimeType}`,
          )
          if (!originalMimeType) originalMimeType = data.mimeType
          data.mimeType = correctMimeType
          mimeTypeCorrected = true
        }

        // Track the correction
        data.originalMimeType = originalMimeType
        data.mimeTypeCorrected = mimeTypeCorrected

        console.log(`[Media beforeChange] Final data:`, {
          filename: data.filename,
          mimeType: data.mimeType,
          originalMimeType: data.originalMimeType,
          mimeTypeCorrected: data.mimeTypeCorrected,
          url: data.url,
          sizes: data.sizes,
        })

        return data
      },
    ],
    beforeValidate: [
      async ({ data, req }: any) => {
        console.log(`[Media beforeValidate] Data:`, {
          filename: data.filename,
          mimeType: data.mimeType,
          url: data.url,
          sizes: data.sizes,
        })
        return data
      },
    ],
    afterChange: [
      generateImageSizes,
      async ({ doc }: any) => {
        console.log(`[Media Collection] After change - Document:`, {
          id: doc.id,
          filename: doc.filename,
          mimeType: doc.mimeType,
          url: doc.url,
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
    {
      name: 'originalMimeType',
      type: 'text',
      admin: {
        readOnly: true,
        hidden: true,
      },
    },
    {
      name: 'mimeTypeCorrected',
      type: 'checkbox',
      admin: {
        readOnly: true,
        hidden: true,
      },
    },
  ],
}
