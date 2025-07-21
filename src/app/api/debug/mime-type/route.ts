import { NextRequest, NextResponse } from 'next/server'

// Function to get proper MIME type from filename (same as used in other files)
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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const filename = searchParams.get('filename') || 'test.png'
  
  const detectedMimeType = getMimeTypeFromFilename(filename)
  
  return NextResponse.json({
    filename,
    detectedMimeType,
    isProperImageType: detectedMimeType.startsWith('image/'),
    wouldBeFixed: detectedMimeType !== 'text/plain' && detectedMimeType !== 'text/plain;charset=UTF-8',
  })
}
