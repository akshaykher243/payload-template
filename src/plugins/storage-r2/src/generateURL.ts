import type * as AWS from '@aws-sdk/client-s3'
import type { GenerateURL } from '@payloadcms/plugin-cloud-storage/types'

import path from 'path'

interface Args {
  bucket: string
  config: AWS.S3ClientConfig
}

export const getGenerateURL = ({ bucket, config }: Args): GenerateURL => {
  return ({ collection, filename, prefix }) => {
    const endpoint = config.endpoint

    // For Cloudflare R2, construct the public URL
    if (typeof endpoint === 'string') {
      // If using custom domain for R2 public buckets
      const baseUrl = endpoint.replace('https://', '').replace('http://', '')
      return `https://${baseUrl}/${path.posix.join(prefix || '', filename)}`
    }

    // Default R2 public URL format - you'll need to replace with your actual R2 domain
    return `https://pub-${bucket}.r2.dev/${path.posix.join(prefix || '', filename)}`
  }
}
