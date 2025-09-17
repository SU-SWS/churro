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
    
    // Extract issuer information - try multiple patterns
    const issuerMatch = decodedResponse.match(/<saml2:Issuer[^>]*>([^<]+)<\/saml2:Issuer>/) ||
                       decodedResponse.match(/<saml:Issuer[^>]*>([^<]+)<\/saml:Issuer>/)
    const responseIssuerMatch = decodedResponse.match(/<saml2p:Response[^>]*Issuer="([^"]+)"/)
    const destinationMatch = decodedResponse.match(/Destination="([^"]+)"/)
    const audienceMatch = decodedResponse.match(/<saml2:Audience[^>]*>([^<]+)<\/saml2:Audience>/) ||
                         decodedResponse.match(/<saml:Audience[^>]*>([^<]+)<\/saml:Audience>/)
    
    console.log('🏷️ Issuer Information:')
    console.log('  Issuer from assertion:', issuerMatch?.[1])
    console.log('  Issuer from response:', responseIssuerMatch?.[1])
    console.log('  Destination:', destinationMatch?.[1])
    console.log('  Audience:', audienceMatch?.[1])
    
    // Extract user attributes - try multiple attribute patterns
    const nameIDMatch = decodedResponse.match(/<saml2:NameID[^>]*>([^<]+)<\/saml2:NameID>/) ||
                       decodedResponse.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/)
    
    // Try different attribute patterns that Stanford might use
    const attributePatterns = [
      /<saml2:Attribute[^>]*Name="([^"]+)"[^>]*>[\s\S]*?<saml2:AttributeValue[^>]*>([^<]+)<\/saml2:AttributeValue>/g,
      /<saml:Attribute[^>]*Name="([^"]+)"[^>]*>[\s\S]*?<saml:AttributeValue[^>]*>([^<]+)<\/saml:AttributeValue>/g,
      /<saml2:Attribute[^>]*AttributeName="([^"]+)"[^>]*>[\s\S]*?<saml2:AttributeValue[^>]*>([^<]+)<\/saml2:AttributeValue>/g
    ]
    
    const attributes: { [key: string]: string } = {}
    
    for (const pattern of attributePatterns) {
      let attributeMatch
      while ((attributeMatch = pattern.exec(decodedResponse)) !== null) {
        const [, attrName, attrValue] = attributeMatch
        attributes[attrName] = attrValue
        console.log(`  Found attribute ${attrName}:`, attrValue)
      }
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
      rawResponse: decodedResponse.substring(0, 500) + '...', // First 500 chars for debugging
    }
    
    console.log('👤 Final user data:', user)
    
    // Use a more explicit redirect that forces GET
    const baseUrl = 'https://churro-test.stanford.edu'
    const redirectUrl = new URL('/auth/test', baseUrl)
    redirectUrl.searchParams.set('saml_success', 'true')
    redirectUrl.searchParams.set('user', JSON.stringify(user))
    
    console.log('🔄 Redirecting to:', redirectUrl.toString())
    
    // Return a 302 redirect response
    return Response.redirect(redirectUrl.toString(), 302)
    
  } catch (error) {
    console.error('❌ SAML debug callback error:', error)
    
    const baseUrl = 'https://churro-test.stanford.edu'
    const redirectUrl = new URL('/auth/test', baseUrl)
    redirectUrl.searchParams.set('saml_error', String(error))
    
    return Response.redirect(redirectUrl.toString(), 302)
  }
}