import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

export async function GET(request: NextRequest) {
  try {
    console.log('[Sharp Test] Testing Sharp availability and functionality')

    // Test 1: Check if Sharp is available
    const sharpVersion = sharp.versions
    console.log('[Sharp Test] Sharp versions:', sharpVersion)

    // Test 2: Create a simple test image
    const testImageBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer()

    console.log('[Sharp Test] Test image created, size:', testImageBuffer.length)

    // Test 3: Resize the test image
    const resizedBuffer = await sharp(testImageBuffer).resize(50, 50).toBuffer()

    console.log('[Sharp Test] Resized image created, size:', resizedBuffer.length)

    return NextResponse.json({
      success: true,
      sharpAvailable: true,
      sharpVersions: sharpVersion,
      testImageSize: testImageBuffer.length,
      resizedImageSize: resizedBuffer.length,
      message: 'Sharp is working correctly',
    })
  } catch (error) {
    console.error('[Sharp Test] Error:', error)
    return NextResponse.json(
      {
        success: false,
        sharpAvailable: false,
        error: String(error),
        message: 'Sharp test failed',
      },
      { status: 500 },
    )
  }
}
