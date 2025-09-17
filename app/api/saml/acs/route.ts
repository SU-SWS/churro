import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('📨 SAML callback received')
    
    const formData = await request.formData()
    const samlResponse = formData.get('SAMLResponse') as string
    
    if (!samlResponse) {
      throw new Error('No SAML response received')
    }
    
    console.log('🔍 Processing SAML response manually...')
    
    // Decode the base64 SAML response
    const decodedResponse = Buffer.from(samlResponse, 'base64').toString('utf-8')
    console.log('📋 Full SAML Response:')
    console.log(decodedResponse)
    
    // Extract issuer
    const issuerMatch = decodedResponse.match(/<saml2:Issuer[^>]*>([^<]+)<\/saml2:Issuer>/)
    console.log('🏷️ Issuer in SAML Response:', issuerMatch?.[1])
    
    // Look for encrypted assertion
    const encryptedAssertionMatch = decodedResponse.match(/<saml2:EncryptedAssertion[^>]*>([\s\S]*?)<\/saml2:EncryptedAssertion>/)
    
    if (encryptedAssertionMatch) {
      console.log('🔒 Found encrypted assertion - need to decrypt')
      
      // For now, let's see if we can extract any unencrypted data
      // Check if there are any plain text attributes (unlikely but possible)
      const attributePattern = /<saml2:Attribute[^>]*Name="([^"]+)"[^>]*>[\s\S]*?<saml2:AttributeValue[^>]*>([^<]+)<\/saml2:AttributeValue>/g
      const attributes: { [key: string]: string } = {}
      
      let attributeMatch
      while ((attributeMatch = attributePattern.exec(decodedResponse)) !== null) {
        const [, attrName, attrValue] = attributeMatch
        attributes[attrName] = attrValue
        console.log(`✅ Found unencrypted attribute: ${attrName} = ${attrValue}`)
      }
      
      // Look for NameID (might be outside encrypted assertion)
      const nameIDMatch = decodedResponse.match(/<saml2:NameID[^>]*>([^<]+)<\/saml2:NameID>/)
      
      // Create user object with whatever we can extract
      const user = {
        id: nameIDMatch?.[1] || 'encrypted-assertion',
        email: attributes['mail'] || attributes['email'] || 'encrypted@stanford.edu',
        name: attributes['displayName'] || attributes['cn'] || 'Encrypted User Data',
        sunetId: attributes['uid'] || 'encrypted-sunet',
        affiliation: attributes['eduPersonAffiliation'],
        // Debug info
        detectedIssuer: issuerMatch?.[1],
        hasEncryptedAssertion: true,
        allAttributes: attributes,
        note: 'Assertion is encrypted - decryption needed for full data',
      }
      
      console.log('👤 User data (limited due to encryption):', user)
      
      // Redirect back with what we have
      const baseUrl = 'https://churro-test.stanford.edu'
      const redirectUrl = new URL('/auth/test', baseUrl)
      redirectUrl.searchParams.set('saml_success', 'true')
      redirectUrl.searchParams.set('user', JSON.stringify(user))
      
      return Response.redirect(redirectUrl.toString(), 302)
      
    } else {
      console.log('📝 No encrypted assertion found - looking for plain attributes')
      
      // Extract attributes normally
      const nameIDMatch = decodedResponse.match(/<saml2:NameID[^>]*>([^<]+)<\/saml2:NameID>/)
      const attributePattern = /<saml2:Attribute[^>]*Name="([^"]+)"[^>]*>[\s\S]*?<saml2:AttributeValue[^>]*>([^<]+)<\/saml2:AttributeValue>/g
      const attributes: { [key: string]: string } = {}
      
      let attributeMatch
      while ((attributeMatch = attributePattern.exec(decodedResponse)) !== null) {
        const [, attrName, attrValue] = attributeMatch
        attributes[attrName] = attrValue
        console.log(`✅ Found attribute: ${attrName} = ${attrValue}`)
      }
      
      const user = {
        id: nameIDMatch?.[1] || 'unknown-id',
        email: attributes['mail'] || attributes['email'] || 'unknown@stanford.edu',
        name: attributes['displayName'] || attributes['cn'] || 'Unknown User',
        sunetId: attributes['uid'] || 'unknown-sunet',
        affiliation: attributes['eduPersonAffiliation'],
        allAttributes: attributes,
      }
      
      console.log('👤 Final user data:', user)
      
      const baseUrl = 'https://churro-test.stanford.edu'
      const redirectUrl = new URL('/auth/test', baseUrl)
      redirectUrl.searchParams.set('saml_success', 'true')
      redirectUrl.searchParams.set('user', JSON.stringify(user))
      
      return Response.redirect(redirectUrl.toString(), 302)
    }
    
  } catch (error) {
    console.error('❌ SAML callback error:', error)
    
    const baseUrl = 'https://churro-test.stanford.edu'
    const redirectUrl = new URL('/auth/test', baseUrl)
    redirectUrl.searchParams.set('saml_error', String(error))
    
    return Response.redirect(redirectUrl.toString(), 302)
  }
}