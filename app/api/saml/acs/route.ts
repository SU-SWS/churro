import { NextRequest, NextResponse } from 'next/server'
import { sp, idp } from '../../../../lib/saml-config'

export async function POST(request: NextRequest) {
  try {
    console.log('📨 SAML callback received')
    
    const formData = await request.formData()
    const samlResponse = formData.get('SAMLResponse') as string
    
    if (!samlResponse) {
      throw new Error('No SAML response received')
    }
    
    console.log('🔍 Processing SAML response...')
    
    // Parse the SAML response
    const { extract } = await sp.parseLoginResponse(idp, 'post', {
      body: { SAMLResponse: samlResponse }
    })
    
    console.log('✅ SAML attributes received:', extract.attributes)
    
    // Create user object from SAML attributes
    const user = {
      id: extract.nameID,
      email: extract.attributes?.mail || extract.attributes?.email,
      name: extract.attributes?.displayName || extract.attributes?.cn,
      sunetId: extract.attributes?.uid,
      affiliation: extract.attributes?.eduPersonAffiliation,
    }
    
    console.log('👤 User data:', user)
    
    // For now, just redirect back with success
    const redirectUrl = new URL('/auth/test', process.env.NEXTAUTH_URL)
    redirectUrl.searchParams.set('saml_success', 'true')
    redirectUrl.searchParams.set('user', JSON.stringify(user))
    
    return NextResponse.redirect(redirectUrl.toString())
    
  } catch (error) {
    console.error('❌ SAML callback error:', error)
    const redirectUrl = new URL('/auth/test', process.env.NEXTAUTH_URL)
    redirectUrl.searchParams.set('saml_error', String(error))
    return NextResponse.redirect(redirectUrl.toString())
  }
}
