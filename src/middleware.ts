import { NextRequest } from 'next/server'

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

    // Documents
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }

  return mimeTypes[ext] || 'application/octet-stream'
}

export function middleware(request: NextRequest) {
  // Only process upload requests to media collection
  if (request.nextUrl.pathname.includes('/api/media') && request.method === 'POST') {
    console.log('[Middleware] Intercepting media upload request')

    // Clone the request to modify it
    const clonedRequest = request.clone()

    // For FormData uploads, we need to modify the form data
    if (request.headers.get('content-type')?.includes('multipart/form-data')) {
      console.log('[Middleware] Processing multipart form data')

      // We can't directly modify FormData in middleware, so we'll add a header
      // to signal our hooks to fix the MIME type
      const modifiedHeaders = new Headers(request.headers)
      modifiedHeaders.set('x-fix-mime-type', 'true')

      return new Response(null, {
        status: 200,
        headers: modifiedHeaders,
      })
    }
  }

  // Continue with the request
  return undefined
}

export const config = {
  matcher: '/api/:path*',
}
