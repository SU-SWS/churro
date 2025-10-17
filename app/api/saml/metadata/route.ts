import { NextRequest, NextResponse } from 'next/server'
import { saml } from '@/lib/saml-config'

export async function GET(request: NextRequest) {
  try {
    const metadata = saml.generateServiceProviderMetadata(
      process.env.SAML_SP_CERT || null,
      process.env.SAML_SP_CERT || null
    )

    return new NextResponse(metadata, {
      headers: {
        'Content-Type': 'application/xml',
      },
    })
  } catch (error) {
    console.error('Error generating metadata:', error)
    return NextResponse.json({ error: 'Failed to generate metadata' }, { status: 500 })
  }
}