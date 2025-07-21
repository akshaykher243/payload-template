import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Get all environment variables related to our setup
    const envVars = {
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_PAYLOAD_URL: process.env.NEXT_PUBLIC_PAYLOAD_URL,
      NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
      R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
      R2_ENDPOINT: process.env.R2_ENDPOINT,
      R2_REGION: process.env.R2_REGION,
      R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID ? 'SET' : 'NOT_SET',
      R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID ? 'SET' : 'NOT_SET',
      R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY ? 'SET' : 'NOT_SET',
    }

    // Test Sharp availability
    let sharpTest = null
    try {
      const sharp = require('sharp')
      sharpTest = {
        available: true,
        versions: sharp.versions,
      }
    } catch (error) {
      sharpTest = {
        available: false,
        error: String(error),
      }
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      environment: envVars,
      sharp: sharpTest,
      recommendations: [
        'Check console logs during upload for detailed processing information',
        'Verify Sharp is working: /api/debug/test-sharp',
        'Check R2 files: /api/debug/r2-files',
        'Test MIME detection: /api/debug/mime-type?filename=test.webp',
      ],
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: String(error),
      },
      { status: 500 },
    )
  }
}
