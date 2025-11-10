import { NextRequest, NextResponse } from 'next/server'
import { saml } from '@/lib/saml-config'

export async function GET(request: NextRequest) {
  try {
    // Validate that required certificates are present
    if (!process.env.SAML_SP_CERT) {
      console.error('❌ SAML_SP_CERT environment variable is not set')
      return NextResponse.json(
        { error: 'Server configuration error: SAML SP certificate not configured' },
        { status: 500 }
      )
    }

    if (!process.env.SAML_SP_PRIVATE_KEY) {
      console.error('❌ SAML_SP_PRIVATE_KEY environment variable is not set')
      return NextResponse.json(
        { error: 'Server configuration error: SAML SP private key not configured' },
        { status: 500 }
      )
    }

    // Generate metadata with both signing and encryption certificates
    // First parameter: decryption certificate (public cert for encryption)
    // Second parameter: signing certificate (public cert for request signing)
    const metadata = saml.generateServiceProviderMetadata(
      process.env.SAML_SP_CERT,
      process.env.SAML_SP_CERT
    )

    return new NextResponse(metadata, {
      headers: {
        'Content-Type': 'application/xml',
      },
    })
  } catch (error) {
    console.error('❌ Error generating metadata:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    return NextResponse.json(
      { error: 'Failed to generate metadata', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}