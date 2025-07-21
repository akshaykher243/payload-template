import { NextRequest, NextResponse } from 'next/server'
import * as AWS from '@aws-sdk/client-s3'

// Function to get proper MIME type from filename
const getMimeTypeFromFilename = (filename: string): string => {
  const ext = filename.toLowerCase().split('.').pop() || ''
  
  const mimeTypes: Record<string, string> = {
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'bmp': 'image/bmp',
    'ico': 'image/x-icon',
    'tiff': 'image/tiff',
    'tif': 'image/tiff',
    
    // Videos
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'ogv': 'video/ogg',
    'avi': 'video/x-msvideo',
    'mov': 'video/quicktime',
    'wmv': 'video/x-ms-wmv',
    'flv': 'video/x-flv',
    'mkv': 'video/x-matroska',
  }
  
  return mimeTypes[ext] || 'application/octet-stream'
}

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

interface RouteContext {
  params: Promise<{ filename: string }>
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const params = await context.params
    const { filename } = params
    const bucket = process.env.R2_BUCKET_NAME!
    
    console.log(`[API Route] Serving media file: ${filename}`)
    
    if (!filename || !bucket) {
      console.error('[API Route] Missing filename or bucket configuration')
      return new NextResponse('Missing filename or bucket configuration', { status: 400 })
    }

    const r2Client = getR2Client()
    
    // Try different key patterns to find the file
    const possibleKeys = [
      filename, // Direct filename
      `media/${filename}`, // With media prefix
      `uploads/${filename}`, // With uploads prefix
    ]

    let object = null
    let usedKey = ''

    for (const key of possibleKeys) {
      try {
        console.log(`[API Route] Trying key: ${key}`)
        object = await r2Client.getObject({
          Bucket: bucket,
          Key: key,
        })
        usedKey = key
        console.log(`[API Route] Found file with key: ${key}`)
        break
      } catch (error: any) {
        console.log(`[API Route] Key ${key} not found: ${error.message}`)
        continue
      }
    }

    if (!object || !object.Body || !object.ContentType) {
      console.log(`[API Route] File not found: ${filename}`)
      return new NextResponse('File not found', { status: 404 })
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

    console.log(`[API Route] Successfully served file: ${filename}, size: ${buffer.length}, key: ${usedKey}`)

    // Ensure proper MIME type is set
    let contentType = object.ContentType
    if (!contentType || contentType === 'text/plain' || contentType === 'text/plain;charset=UTF-8') {
      contentType = getMimeTypeFromFilename(filename)
      console.log(`[API Route] Correcting Content-Type for ${filename}: ${object.ContentType} -> ${contentType}`)
    }

    // Return the file with proper headers
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(object.ContentLength || buffer.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'ETag': object.ETag || `"${Date.now()}"`,
        'Accept-Ranges': 'bytes',
      },
    })
  } catch (error) {
    console.error('[API Route] Error serving media file:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
