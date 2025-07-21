import type * as AWS from '@aws-sdk/client-s3'
import type { GenerateURL } from '@payloadcms/plugin-cloud-storage/types'

import path from 'path'

interface Args {
  bucket: string
  config: AWS.S3ClientConfig
}

export const getGenerateURL = ({ bucket, config }: Args): GenerateURL => {
  return ({ collection, filename, prefix }) => {
    // For production deployment, we need to serve files through our static handler
    // This ensures proper access control and CORS handling
    
    // In production, route through our API endpoint
    if (process.env.NODE_ENV === 'production') {
      const baseUrl = process.env.NEXT_PUBLIC_PAYLOAD_URL || 'https://payload-template.onrender.com'
      return `${baseUrl}/api/media/file/${filename}`
    }
    
    // For development, try to use direct R2 URLs if available
    const endpoint = config.endpoint
    
    if (typeof endpoint === 'string') {
      // Extract account ID from endpoint for public domain
      const accountMatch = endpoint.match(/https:\/\/([^.]+)\.r2\.cloudflarestorage\.com/)
      if (accountMatch) {
        const accountId = accountMatch[1]
        // Use R2 public domain format: https://pub-{hash}.r2.dev/{bucket}/{file}
        return `https://pub-${accountId}.r2.dev/${bucket}/${path.posix.join(prefix || '', filename)}`
      }
    }

    // Fallback to serving through our API
    return `/api/media/file/${filename}`
  }
}
