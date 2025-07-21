import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('[Test Upload] Headers:', Object.fromEntries(request.headers.entries()))

    const contentType = request.headers.get('content-type')
    console.log('[Test Upload] Content-Type:', contentType)

    if (contentType?.includes('multipart/form-data')) {
      const formData = await request.formData()
      const files = []

      for (const [name, value] of formData.entries()) {
        if (value instanceof File) {
          files.push({
            fieldName: name,
            filename: value.name,
            mimeType: value.type,
            size: value.size,
          })
          console.log('[Test Upload] File detected:', {
            fieldName: name,
            filename: value.name,
            mimeType: value.type,
            size: value.size,
          })
        } else {
          console.log('[Test Upload] Form field:', name, '=', value)
        }
      }

      return NextResponse.json({
        success: true,
        contentType,
        files,
        message: 'Upload test completed',
      })
    }

    return NextResponse.json({
      success: false,
      contentType,
      message: 'Not a multipart upload',
    })
  } catch (error) {
    console.error('[Test Upload] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 },
    )
  }
}
