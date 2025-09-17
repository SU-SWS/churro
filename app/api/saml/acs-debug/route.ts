import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('📨 SAML Debug callback received')
    
    const formData = await request.formData()
    const samlResponse = formData.get('SAMLResponse') as string
    
    if (!samlResponse) {
      throw new Error('No SAML response received')
    }
    
    console.log('🔍 Raw SAML Response (base64):', samlResponse.substring(0, 100) + '...')
    
    // Decode the base64 SAML response
    const decodedResponse = Buffer.from(samlResponse, 'base64').toString('utf-8')
    console.log('📋 Full Decoded SAML Response:')
    console.log(decodedResponse)
    console.log('=' .repeat(80))
    
    // Extract issuer information
    const issuerMatch = decodedResponse.match(/<saml2:Issuer[^>]*>([^<]+)<\/saml2:Issuer>/)
    const responseIssuerMatch = decodedResponse.match(/<saml2p:Response[^>]*Issuer="([^"]+)"/)
    const destinationMatch = decodedResponse.match(/Destination="([^"]+)"/)
    const audienceMatch = decodedResponse.match(/<saml2:Audience[^>]*>([^<]+)<\/saml2:Audience>/)
    
    console.log('🏷️ Issuer Information:')
    console.log('  Issuer from assertion:', issuerMatch?.[1])
    console.log('  Issuer from response:', responseIssuerMatch?.[1])
    console.log('  Destination:', destinationMatch?.[1])
    console.log('  Audience:', audienceMatch?.[1])
    
    // Extract user attributes using a compatible approach
    const nameIDMatch = decodedResponse.match(/<saml2:NameID[^>]*>([^<]+)<\/saml2:NameID>/)
    
    // Extract attributes using a more compatible regex approach
    const attributePattern = /<saml2:Attribute[^>]*Name="([^"]+)"[^>]*>[\s\S]*?<saml2:AttributeValue[^>]*>([^<]+)<\/saml2:AttributeValue>/g
    const attributes: { [key: string]: string } = {}
    
    let attributeMatch
    while ((attributeMatch = attributePattern.exec(decodedResponse)) !== null) {
      const [, attrName, attrValue] = attributeMatch
      attributes[attrName] = attrValue
      console.log(`  ${attrName}:`, attrValue)
    }
    
    console.log('👤 User Information:')
    console.log('  NameID:', nameIDMatch?.[1])
    console.log('  All extracted attributes:', attributes)
    
    // Create user object
    const user = {
      id: nameIDMatch?.[1] || 'unknown-id',
      email: attributes['mail'] || 
             attributes['email'] || 
             attributes['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ||
             'unknown@stanford.edu',
      name: attributes['displayName'] || 
            attributes['cn'] || 
            attributes['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] ||
            'Stanford User',
      sunetId: attributes['uid'] || 
               attributes['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn'] ||
               'unknown-sunet',
      affiliation: attributes['eduPersonAffiliation'] ||
                   attributes['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role'],
      // Debug info
      detectedIssuer: issuerMatch?.[1],
      detectedAudience: audienceMatch?.[1],
      detectedDestination: destinationMatch?.[1],
      allAttributes: attributes,
    }
    
    console.log('👤 Final user data:', user)
    
    // Redirect back with success
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const redirectUrl = new URL('/auth/test', baseUrl)
    redirectUrl.searchParams.set('saml_success', 'true')
    redirectUrl.searchParams.set('user', JSON.stringify(user))
    
    console.log('🔄 Redirecting to:', redirectUrl.toString())
    
    return NextResponse.redirect(redirectUrl.toString())
    
  } catch (error) {
    console.error('❌ SAML debug callback error:', error)
    
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const redirectUrl = new URL('/auth/test', baseUrl)
    redirectUrl.searchParams.set('saml_error', String(error))
    
    return NextResponse.redirect(redirectUrl.toString())
  }
}