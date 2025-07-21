import { NextRequest, NextResponse } from 'next/server'
import * as AWS from '@aws-sdk/client-s3'

// Initialize R2 client
const getR2Client = () => {
  return new AWS.S3({
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
    region: process.env.R2_REGION,
    endpoint: process.env.R2_ENDPOINT!,
  })
}

interface RouteContext {
  params: Promise<{ filename: string; size: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params
    const { filename, size } = params
    const bucket = process.env.R2_BUCKET_NAME!

    console.log(`[Size API Route] Serving size file: ${filename}, size: ${size}`)

    if (!filename || !size || !bucket) {
      console.error('[Size API Route] Missing filename, size or bucket configuration')
      return new NextResponse('Missing parameters', { status: 400 })
    }

    const r2Client = getR2Client()

    // Try different key patterns for the size files
    const baseFilename = filename.replace(/\.[^/.]+$/, '') // Remove extension
    const extension = filename.split('.').pop()

    const possibleKeys = [
      `${baseFilename}-${size}.${extension}`, // Standard pattern: filename-size.ext
      `${size}/${filename}`, // Size folder pattern: size/filename.ext
      `media/${baseFilename}-${size}.${extension}`, // With media prefix
      `uploads/${baseFilename}-${size}.${extension}`, // With uploads prefix
      `sizes/${size}/${filename}`, // Sizes folder pattern
    ]

    let object = null
    let usedKey = ''

    for (const key of possibleKeys) {
      try {
        console.log(`[Size API Route] Trying key: ${key}`)
        object = await r2Client.getObject({
          Bucket: bucket,
          Key: key,
        })
        usedKey = key
        console.log(`[Size API Route] Found size file with key: ${key}`)
        break
      } catch (error: any) {
        console.log(`[Size API Route] Key ${key} not found: ${error.message}`)
        continue
      }
    }

    if (!object || !object.Body) {
      console.log(`[Size API Route] Size file not found: ${filename} (${size})`)
      return new NextResponse('Size file not found', { status: 404 })
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = []
    const reader = object.Body.transformToWebStream().getReader()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }

    const buffer = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0))
    let offset = 0
    for (const chunk of chunks) {
      buffer.set(chunk, offset)
      offset += chunk.length
    }

    console.log(
      `[Size API Route] Successfully served size file: ${filename} (${size}), size: ${buffer.length}, key: ${usedKey}`,
    )

    // Return the file with proper headers
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': object.ContentType || 'image/jpeg',
        'Content-Length': String(object.ContentLength || buffer.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
        ETag: object.ETag || `"${Date.now()}"`,
        'Accept-Ranges': 'bytes',
      },
    })
  } catch (error) {
    console.error('[Size API Route] Error serving size file:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
