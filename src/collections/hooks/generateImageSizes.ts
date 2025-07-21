import { CollectionAfterChangeHook } from 'payload'
import sharp from 'sharp'
import * as AWS from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'

// Initialize R2 client
const getR2Client = () => {
  return new AWS.S3({
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT!,
  })
}

export const generateImageSizes: CollectionAfterChangeHook = async ({ doc, req, operation }) => {
  // Only process new uploads
  if (operation !== 'create' || !req.file || !doc.mimeType?.startsWith('image/')) {
    return doc
  }

  console.log(`[Generate Image Sizes] Starting manual size generation for ${doc.filename}`)

  try {
    const bucket = process.env.R2_BUCKET_NAME!
    const r2Client = getR2Client()

    // Get the original image buffer
    let imageBuffer: Buffer

    if (req.file.data) {
      imageBuffer = req.file.data
    } else if (req.file.tempFilePath) {
      const fs = require('fs')
      imageBuffer = fs.readFileSync(req.file.tempFilePath)
    } else {
      console.error('[Generate Image Sizes] No image buffer or temp file available')
      return doc
    }

    // Define sizes to generate
    const sizes = [
      { name: 'thumbnail', width: 400, height: 300 },
      { name: 'card', width: 768, height: undefined },
      { name: 'tablet', width: 1024, height: undefined },
    ]

    const generatedSizes: any = {}

    for (const size of sizes) {
      try {
        console.log(`[Generate Image Sizes] Creating ${size.name} size`)

        // Generate resized image
        let resizer = sharp(imageBuffer).resize(size.width, size.height, {
          position: 'centre',
          withoutEnlargement: true,
        })

        const resizedBuffer = await resizer.toBuffer({ resolveWithObject: true })
        const { data: sizeBuffer, info } = resizedBuffer

        // Create filename for the size
        const baseFilename = doc.filename.replace(/\.[^/.]+$/, '') // Remove extension
        const extension = doc.filename.split('.').pop()
        const sizeFilename = `${baseFilename}-${size.name}.${extension}`
        const sizeKey = sizeFilename

        console.log(`[Generate Image Sizes] Uploading ${size.name} to R2: ${sizeKey}`)

        // Upload to R2
        const upload = new Upload({
          client: r2Client,
          params: {
            Bucket: bucket,
            Key: sizeKey,
            Body: sizeBuffer,
            ContentType: doc.mimeType,
            ACL: 'public-read',
          },
        })

        await upload.done()

        // Store size information
        generatedSizes[size.name] = {
          filename: sizeFilename,
          width: info.width,
          height: info.height,
          mimeType: doc.mimeType,
          filesize: sizeBuffer.length,
          url: `/api/media/file/${sizeFilename}`,
        }

        console.log(
          `[Generate Image Sizes] ✅ Successfully created ${size.name}: ${info.width}x${info.height}`,
        )
      } catch (error) {
        console.error(`[Generate Image Sizes] Error creating ${size.name}:`, error)
        generatedSizes[size.name] = {
          filename: null,
          width: null,
          height: null,
          mimeType: null,
          filesize: null,
          url: null,
        }
      }
    }

    // Update the document with generated sizes
    if (Object.keys(generatedSizes).length > 0) {
      console.log(`[Generate Image Sizes] Updating document with generated sizes`)

      // Update the document in the database
      await req.payload.update({
        collection: 'media',
        id: doc.id,
        data: {
          sizes: generatedSizes,
        },
      })

      // Return updated document
      doc.sizes = generatedSizes
    }
  } catch (error) {
    console.error('[Generate Image Sizes] Fatal error:', error)
  }

  return doc
}
