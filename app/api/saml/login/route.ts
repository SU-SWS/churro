import { NextRequest, NextResponse } from 'next/server'
import { saml } from '@/lib/saml-config'

export async function GET(request: NextRequest) {
  try {
    const loginUrl = await saml.getAuthorizeUrlAsync('', '', {})
    return NextResponse.redirect(loginUrl)
  } catch (error) {
    console.error('Error initiating SAML login:', error)
    return NextResponse.json({ error: 'Failed to initiate login' }, { status: 500 })
  }
}
