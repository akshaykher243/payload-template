import { CollectionConfig } from 'payload'

const { NEXT_PUBLIC_BASE_URL } = process.env

const generateMediaUrl = (url: string) => {
  return `${NEXT_PUBLIC_BASE_URL}${url}`
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
    afterRead: [
      async ({ doc }: any) => {
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
