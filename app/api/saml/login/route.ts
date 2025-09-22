import { NextRequest, NextResponse } from 'next/server'
import { sp, idp } from '../../../../lib/saml-config'

export async function GET(request: NextRequest) {
  try {
    // console.log('🚀 Initiating SAML login...')
    // console.log('Entry Point:', process.env.SAML_ENTRY_POINT)

    // Create login request
    const { context: loginUrl } = sp.createLoginRequest(idp, 'redirect')

    // console.log('🔗 Redirecting to Stanford:', loginUrl)

    // Redirect to Stanford
    return NextResponse.redirect(loginUrl)

  } catch (error) {
    console.error('❌ SAML login error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate SAML login', details: String(error) },
      { status: 500 }
    )
  }
}
