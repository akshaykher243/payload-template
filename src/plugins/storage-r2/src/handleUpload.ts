import type * as AWS from '@aws-sdk/client-s3'
import type { HandleUpload } from '@payloadcms/plugin-cloud-storage/types'
import type { CollectionConfig } from 'payload'

import { Upload } from '@aws-sdk/lib-storage'
import fs from 'fs'
import path from 'path'

interface Args {
  acl?: 'private' | 'public-read'
  bucket: string
  collection: CollectionConfig
  getStorageClient: () => AWS.S3
  prefix?: string
}

const multipartThreshold = 1024 * 1024 * 50 // 50MB

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
  }

  return mimeTypes[ext] || 'application/octet-stream'
}

export const getHandleUpload = ({
  acl,
  bucket,
  getStorageClient,
  prefix = '',
}: Args): HandleUpload => {
  return async ({ data, file }) => {
    console.log(`[Upload Handler] === Starting upload ===`)
    console.log(`[Upload Handler] File details:`, {
      filename: file.filename,
      originalMimeType: file.mimeType,
      filesize: file.buffer?.length || 0,
      hasBuffer: !!file.buffer,
      hasTempFile: !!file.tempFilePath,
      prefix: data.prefix || prefix,
    })
    console.log(`[Upload Handler] Data details:`, {
      dataFilename: data.filename,
      dataPrefix: data.prefix,
      sizeName: data.sizeName, // This would indicate if it's a size upload
      dataKeys: Object.keys(data),
    })

    const fileKey = path.posix.join(data.prefix || prefix, file.filename)

    const fileBufferOrStream = file.tempFilePath
      ? fs.createReadStream(file.tempFilePath)
      : file.buffer

    // Ensure proper MIME type is set
    let mimeType = file.mimeType
    if (!mimeType || mimeType === 'text/plain' || mimeType === 'text/plain;charset=UTF-8') {
      mimeType = getMimeTypeFromFilename(file.filename)
      console.log(
        `[Upload Handler] Correcting MIME type for ${file.filename}: ${file.mimeType} -> ${mimeType}`,
      )
    }

    console.log(`[Upload Handler] Uploading to R2:`, {
      bucket,
      key: fileKey,
      mimeType,
      isSize: !!data.sizeName,
      acl,
    })

    if (file.buffer.length > 0 && file.buffer.length < multipartThreshold) {
      await getStorageClient().putObject({
        ACL: acl,
        Body: fileBufferOrStream,
        Bucket: bucket,
        ContentType: mimeType,
        Key: fileKey,
      })

      console.log(
        `[Upload Handler] ✅ Successfully uploaded ${file.filename} via putObject (key: ${fileKey})`,
      )
      return data
    }

    const parallelUploadR2 = new Upload({
      client: getStorageClient(),
      params: {
        ACL: acl,
        Body: fileBufferOrStream,
        Bucket: bucket,
        ContentType: mimeType,
        Key: fileKey,
      },
      partSize: multipartThreshold,
      queueSize: 4,
    })

    await parallelUploadR2.done()
    console.log(
      `[Upload Handler] ✅ Successfully uploaded ${file.filename} via multipart upload (key: ${fileKey})`,
    )

    return data
  }
}
