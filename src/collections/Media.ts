import type { CollectionConfig } from 'payload'

// Helper function to determine MIME type from filename
const getMimeTypeFromFilename = (filename: string): string | null => {
  const ext = filename.toLowerCase()
  
  // Image extensions
  if (ext.endsWith('.jpg') || ext.endsWith('.jpeg')) return 'image/jpeg'
  if (ext.endsWith('.png')) return 'image/png'
  if (ext.endsWith('.gif')) return 'image/gif'
  if (ext.endsWith('.webp')) return 'image/webp'
  if (ext.endsWith('.svg')) return 'image/svg+xml'
  
  // Video extensions
  if (ext.endsWith('.mp4')) return 'video/mp4'
  if (ext.endsWith('.webm')) return 'video/webm'
  if (ext.endsWith('.avi')) return 'video/avi'
  if (ext.endsWith('.mov')) return 'video/quicktime'
  
  // Audio extensions
  if (ext.endsWith('.mp3')) return 'audio/mp3'
  if (ext.endsWith('.wav')) return 'audio/wav'
  if (ext.endsWith('.ogg')) return 'audio/ogg'
  
  // Document extensions
  if (ext.endsWith('.pdf')) return 'application/pdf'
  if (ext.endsWith('.doc')) return 'application/msword'
  if (ext.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  
  return null
}

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
  hooks: {
    beforeChange: [
      ({ data }) => {
        // If MIME type is detected as text/plain, try to determine from filename
        const isTextPlain = data.mimeType === 'text/plain' || data.mimeType === 'text/plain;charset=UTF-8'
        
        if (isTextPlain && data.filename) {
          const correctMimeType = getMimeTypeFromFilename(data.filename)
          if (correctMimeType) {
            data.mimeType = correctMimeType
          }
        }
        
        return data
      },
    ],
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
        height: 1024,
        position: 'centre',
      },
    ],
    // More comprehensive MIME type support for cloud deployments
    mimeTypes: [
      'image/*',
      'video/*',
      'audio/*',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
      'application/zip',
      'application/x-zip-compressed',
    ],
  },
}
