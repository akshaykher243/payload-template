import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  access: {
    read: () => true, // Allow public read access
    create: () => true, // Allow public creation access
    update: () => true, // Allow public update access
    delete: () => false, // Disable public deletion access
  },
  auth: true,
  fields: [
    // Email added by default
    // Add more fields as needed
  ],
}
