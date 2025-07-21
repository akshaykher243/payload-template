import type * as AWS from '@aws-sdk/client-s3'
import type { HandleUpload } from '@payloadcms/plugin-cloud-storage/types'
import type { CollectionConfig } from 'payload'

import { Upload } from '@aws-sdk/lib-storage'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

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

    const fileKey = path.posix.join(data.prefix || prefix, file.filename)

    // Ensure proper MIME type is set
    let mimeType = file.mimeType
    if (!mimeType || mimeType === 'text/plain' || mimeType === 'text/plain;charset=UTF-8') {
      mimeType = getMimeTypeFromFilename(file.filename)
      console.log(`[Upload Handler] Correcting MIME type for ${file.filename}: ${file.mimeType} -> ${mimeType}`)
    }

    // Get file buffer for processing
    let fileBuffer: Buffer
    if (file.buffer) {
      fileBuffer = file.buffer
    } else if (file.tempFilePath) {
      fileBuffer = fs.readFileSync(file.tempFilePath)
    } else {
      throw new Error('No file buffer or temp file available')
    }

    console.log(`[Upload Handler] Uploading original file to R2:`, {
      bucket,
      key: fileKey,
      mimeType,
      size: fileBuffer.length
    })

    // Upload original file
    if (fileBuffer.length < multipartThreshold) {
      await getStorageClient().putObject({
        ACL: acl,
        Body: fileBuffer,
        Bucket: bucket,
        ContentType: mimeType,
        Key: fileKey,
      })
    } else {
      const parallelUploadR2 = new Upload({
        client: getStorageClient(),
        params: {
          ACL: acl,
          Body: fileBuffer,
          Bucket: bucket,
          ContentType: mimeType,
          Key: fileKey,
        },
        partSize: multipartThreshold,
        queueSize: 4,
      })
      await parallelUploadR2.done()
    }

    console.log(`[Upload Handler] ✅ Original file uploaded: ${fileKey}`)

    // Generate image sizes if it's an image
    if (mimeType.startsWith('image/') && !data.sizeName) {
      console.log(`[Upload Handler] 🖼️  Generating image sizes for ${file.filename}`)
      
      try {
        // Define image sizes based on collection upload config
        const imageSizes = [
          { name: 'thumbnail', width: 400, height: 300 },
          { name: 'card', width: 768, height: undefined },
          { name: 'tablet', width: 1024, height: undefined },
        ]

        const generatedSizes: any = {}

        for (const size of imageSizes) {
          try {
            console.log(`[Upload Handler] Creating ${size.name} size`)

            // Generate resized image
            let resizer = sharp(fileBuffer).resize(size.width, size.height, {
              position: 'centre',
              withoutEnlargement: true,
              fit: 'cover'
            })

            const { data: sizeBuffer, info } = await resizer.toBuffer({ resolveWithObject: true })

            // Create filename for the size
            const baseFilename = file.filename.replace(/\.[^/.]+$/, "") // Remove extension
            const extension = file.filename.split('.').pop()
            const sizeFilename = `${baseFilename}-${size.name}.${extension}`
            const sizeKey = path.posix.join(data.prefix || prefix, sizeFilename)

            console.log(`[Upload Handler] Uploading ${size.name} to R2: ${sizeKey}`)

            // Upload size to R2
            if (sizeBuffer.length < multipartThreshold) {
              await getStorageClient().putObject({
                ACL: acl,
                Body: sizeBuffer,
                Bucket: bucket,
                ContentType: mimeType,
                Key: sizeKey,
              })
            } else {
              const upload = new Upload({
                client: getStorageClient(),
                params: {
                  ACL: acl,
                  Body: sizeBuffer,
                  Bucket: bucket,
                  ContentType: mimeType,
                  Key: sizeKey,
                },
                partSize: multipartThreshold,
                queueSize: 4,
              })
              await upload.done()
            }

            // Store size information in data
            generatedSizes[size.name] = {
              filename: sizeFilename,
              width: info.width,
              height: info.height,
              mimeType: mimeType,
              filesize: sizeBuffer.length,
              url: `/${sizeKey}`
            }

            console.log(`[Upload Handler] ✅ Successfully created and uploaded ${size.name}: ${info.width}x${info.height}`)

          } catch (error) {
            console.error(`[Upload Handler] Error creating ${size.name}:`, error)
            generatedSizes[size.name] = {
              filename: null,
              width: null,
              height: null,
              mimeType: null,
              filesize: null,
              url: null
            }
          }
        }

        // Add sizes to data object so PayloadCMS saves them
        data.sizes = generatedSizes
        console.log(`[Upload Handler] 🎉 Image sizes generated and added to data:`, Object.keys(generatedSizes))

      } catch (error) {
        console.error('[Upload Handler] Error generating image sizes:', error)
      }
    }

    return data
  }
}
