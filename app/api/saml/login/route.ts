import { NextRequest, NextResponse } from 'next/server'
import { saml } from '@/lib/saml-config'

export async function GET(request: NextRequest) {
  try {
    // Get the return URL from query parameters (set by middleware)
    const returnTo = request.nextUrl.searchParams.get('returnTo') || '/'

    // Use RelayState to preserve the return URL through the SAML flow
    const loginUrl = await saml.getAuthorizeUrlAsync(returnTo, '', {})
    return NextResponse.redirect(loginUrl)
  } catch (error) {
    console.error('Error initiating SAML login:', error)
    return NextResponse.json({ error: 'Failed to initiate login' }, { status: 500 })
  }
}
