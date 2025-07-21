import { NextRequest, NextResponse } from 'next/server'
import * as AWS from '@aws-sdk/client-s3'

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

export async function GET(request: NextRequest) {
  try {
    const bucket = process.env.R2_BUCKET_NAME!
    const r2Client = getR2Client()
    
    // List all objects in the bucket
    const response = await r2Client.listObjectsV2({
      Bucket: bucket,
      MaxKeys: 100, // Limit to first 100 objects
    })

    const files = response.Contents?.map(obj => ({
      key: obj.Key,
      size: obj.Size,
      lastModified: obj.LastModified,
      etag: obj.ETag,
    })) || []

    return NextResponse.json({
      bucket,
      totalFiles: files.length,
      files,
    })
  } catch (error) {
    console.error('Error listing R2 files:', error)
    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 })
  }
}
