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

    // Look for NameID with different patterns
    const nameIDPatterns = [
      /<saml2:NameID[^>]*>([^<]+)<\/saml2:NameID>/,
      /<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/,
      /<NameID[^>]*>([^<]+)<\/NameID>/
    ]

    let nameIDMatch = null
    for (const pattern of nameIDPatterns) {
      nameIDMatch = decodedResponse.match(pattern)
      if (nameIDMatch) break
    }

    console.log('🆔 NameID found:', nameIDMatch?.[1])

    // Look for AttributeStatement section
    const attributeStatementMatch = decodedResponse.match(/<saml2:AttributeStatement[^>]*>([\s\S]*?)<\/saml2:AttributeStatement>/)
    if (attributeStatementMatch) {
      console.log('📝 AttributeStatement found:')
      console.log(attributeStatementMatch[1])
    } else {
      console.log('❌ No AttributeStatement found')
    }

    // Try multiple attribute extraction patterns
    const attributes: { [key: string]: string } = {}

    // Pattern 1: Standard SAML2 attributes
    const attrPattern1 = /<saml2:Attribute[^>]*Name="([^"]+)"[^>]*>([\s\S]*?)<\/saml2:Attribute>/g
    let match1
    while ((match1 = attrPattern1.exec(decodedResponse)) !== null) {
      const attrName = match1[1]
      const attrContent = match1[2]

      // Extract the attribute value
      const valueMatch = attrContent.match(/<saml2:AttributeValue[^>]*>([^<]+)<\/saml2:AttributeValue>/)
      if (valueMatch) {
        attributes[attrName] = valueMatch[1]
        console.log(`✅ Attribute found: ${attrName} = ${valueMatch[1]}`)
      }
    }

    // Pattern 2: Different namespace
    const attrPattern2 = /<saml:Attribute[^>]*Name="([^"]+)"[^>]*>([\s\S]*?)<\/saml:Attribute>/g
    let match2
    while ((match2 = attrPattern2.exec(decodedResponse)) !== null) {
      const attrName = match2[1]
      const attrContent = match2[2]

      const valueMatch = attrContent.match(/<saml:AttributeValue[^>]*>([^<]+)<\/saml:AttributeValue>/)
      if (valueMatch) {
        attributes[attrName] = valueMatch[1]
        console.log(`✅ Attribute found (saml): ${attrName} = ${valueMatch[1]}`)
      }
    }

    // Pattern 3: Look for any tag that might contain user info
    const possibleUserFields = ['mail', 'email', 'uid', 'sunetid', 'displayName', 'cn', 'givenName', 'sn', 'surname']
    for (const field of possibleUserFields) {
      const fieldPattern = new RegExp(`<[^>]*${field}[^>]*>([^<]+)<`, 'i')
      const fieldMatch = decodedResponse.match(fieldPattern)
      if (fieldMatch) {
        attributes[field] = fieldMatch[1]
        console.log(`✅ Found ${field}: ${fieldMatch[1]}`)
      }
    }

    console.log('📊 Final extracted attributes:', attributes)

    // Extract issuer and other info
    const issuerMatch = decodedResponse.match(/<saml2:Issuer[^>]*>([^<]+)<\/saml2:Issuer>/)
    const destinationMatch = decodedResponse.match(/Destination="([^"]+)"/)
    const audienceMatch = decodedResponse.match(/<saml2:Audience[^>]*>([^<]+)<\/saml2:Audience>/)

    console.log('🏷️ Other Information:')
    console.log('  Issuer:', issuerMatch?.[1])
    console.log('  Destination:', destinationMatch?.[1])
    console.log('  Audience:', audienceMatch?.[1])

    // Create user object with all possible mappings
    const user = {
      id: nameIDMatch?.[1] || 'no-nameid-found',
      email: attributes['mail'] ||
             attributes['email'] ||
             attributes['emailAddress'] ||
             attributes['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ||
             'no-email-found',
      name: attributes['displayName'] ||
            attributes['cn'] ||
            attributes['commonName'] ||
            attributes['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] ||
            `${attributes['givenName'] || ''} ${attributes['sn'] || ''}`.trim() ||
            'no-name-found',
      sunetId: attributes['uid'] ||
               attributes['sunetid'] ||
               attributes['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn'] ||
               'no-sunetid-found',
      affiliation: attributes['eduPersonAffiliation'] ||
                   attributes['affiliation'] ||
                   attributes['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role'],
      // Debug info
      detectedIssuer: issuerMatch?.[1],
      detectedAudience: audienceMatch?.[1],
      detectedDestination: destinationMatch?.[1],
      allAttributes: attributes,
      fullResponse: decodedResponse, // Include FULL response for debugging
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
    console.error('❌ SAML debug callback error:', error)

    const baseUrl = 'https://churro-test.stanford.edu'
    const redirectUrl = new URL('/auth/test', baseUrl)
    redirectUrl.searchParams.set('saml_error', String(error))

    return Response.redirect(redirectUrl.toString(), 302)
  }
}