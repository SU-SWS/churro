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
    
    console.log('🔍 Processing SAML response with decryption...')
    console.log('SAML Response (first 200 chars):', samlResponse.substring(0, 200) + '...')
    
    // Parse the SAML response with decryption
    const parseResult = await sp.parseLoginResponse(idp, 'post', {
      body: { SAMLResponse: samlResponse }
    })
    
    console.log('✅ SAML response parsed and decrypted successfully')
    console.log('Parse result:', parseResult)
    
    const { extract } = parseResult
    console.log('📋 SAML attributes received:', extract.attributes)
    console.log('👤 Name ID:', extract.nameID)
    
    // Create user object from SAML attributes
    const user = {
      id: extract.nameID || 'unknown-id',
      email: extract.attributes?.mail || 
             extract.attributes?.email || 
             extract.attributes?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ||
             'unknown@stanford.edu',
      name: extract.attributes?.displayName || 
            extract.attributes?.cn || 
            extract.attributes?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] ||
            `${extract.attributes?.givenName || ''} ${extract.attributes?.sn || ''}`.trim() ||
            'Stanford User',
      firstName: extract.attributes?.givenName,
      lastName: extract.attributes?.sn,
      sunetId: extract.attributes?.uid || 
               extract.attributes?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn'],
      affiliation: extract.attributes?.eduPersonAffiliation ||
                   extract.attributes?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role'],
      // Include all attributes for debugging
      allAttributes: extract.attributes,
    }
    
    console.log('👤 Final user data:', user)
    
    // Redirect back with success
    const baseUrl = 'https://churro-test.stanford.edu'
    const redirectUrl = new URL('/auth/test', baseUrl)
    redirectUrl.searchParams.set('saml_success', 'true')
    redirectUrl.searchParams.set('user', JSON.stringify(user))
    
    console.log('🔄 Redirecting to:', redirectUrl.toString())
    
    return Response.redirect(redirectUrl.toString(), 302)
    
  } catch (error) {
    console.error('❌ SAML callback error:', error)
    console.error('Error details:', error instanceof Error ? error.stack : 'No stack trace')
    
    const baseUrl = 'https://churro-test.stanford.edu'
    const redirectUrl = new URL('/auth/test', baseUrl)
    redirectUrl.searchParams.set('saml_error', String(error))
    
    return Response.redirect(redirectUrl.toString(), 302)
  }
}