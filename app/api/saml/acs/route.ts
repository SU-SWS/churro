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
    
    // Decode and inspect the SAML response before parsing
    const decodedResponse = Buffer.from(samlResponse, 'base64').toString('utf-8')
    
    // Extract issuer from the actual response
    const issuerMatch = decodedResponse.match(/<saml2:Issuer[^>]*>([^<]+)<\/saml2:Issuer>/)
    const actualIssuer = issuerMatch?.[1]
    
    console.log('🏷️ Issuer in SAML Response:', actualIssuer)
    console.log('🏷️ Expected Issuer (from our config): https://idp-uat.stanford.edu/')
    
    if (actualIssuer !== 'https://idp-uat.stanford.edu/') {
      console.warn('⚠️ Issuer mismatch detected!')
      console.warn('  Actual:', actualIssuer)
      console.warn('  Expected: https://idp-uat.stanford.edu/')
    }
    
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
             'unknown@stanford.edu',
      name: extract.attributes?.displayName || 
            extract.attributes?.cn || 
            'Stanford User',
      firstName: extract.attributes?.givenName,
      lastName: extract.attributes?.sn,
      sunetId: extract.attributes?.uid,
      affiliation: extract.attributes?.eduPersonAffiliation,
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