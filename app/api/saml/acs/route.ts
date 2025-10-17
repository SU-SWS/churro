import { NextRequest, NextResponse } from 'next/server'
import { sp, idp } from '@/lib/saml-config'
import * as xmldom from '@xmldom/xmldom'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const samlResponse = formData.get('SAMLResponse') as string

    if (!samlResponse) {
      throw new Error('No SAML response received')
    }

    // Decode and log the FULL SAML response to see ALL issuers
    const decodedResponse = Buffer.from(samlResponse, 'base64').toString('utf-8')
    console.log('📋 Full SAML Response:', decodedResponse)

    // Look for ALL Issuer elements (there might be multiple)
    const issuerMatches = decodedResponse.matchAll(/<saml2?:Issuer[^>]*>([^<]+)<\/saml2?:Issuer>/gi)
    const allIssuers = Array.from(issuerMatches, m => m[1])
    console.log('🔍 ALL Issuers found in ENCRYPTED response:', allIssuers)

    // Look for what we have configured
    console.log('🔍 Expected entityID:', idp.entityMeta.getEntityID())

    // Try to manually inspect encrypted assertion
    try {
      const DOMParser = xmldom.DOMParser
      const doc = new DOMParser().parseFromString(decodedResponse, 'text/xml')

      // Find the encrypted assertion
      const encryptedAssertions = doc.getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:assertion', 'EncryptedAssertion')

      if (encryptedAssertions.length > 0) {
        console.log('🔐 Found encrypted assertion, attempting manual inspection...')

        // Get the encrypted key
        const encryptedKey = encryptedAssertions[0].getElementsByTagNameNS('http://www.w3.org/2001/04/xmlenc#', 'EncryptedKey')[0]

        if (encryptedKey) {
          const recipient = encryptedKey.getAttribute('Recipient')
          console.log('🔍 Encryption Recipient in EncryptedKey:', recipient)
        }
      }
    } catch (debugError) {
      console.log('⚠️ Debug inspection failed:', debugError)
    }

    // Let samlify handle decryption and parsing automatically
    const { extract } = await sp.parseLoginResponse(idp, 'post', {
      body: { SAMLResponse: samlResponse }
    })

    console.log('✅ Successfully parsed SAML response')
    console.log('📋 Extracted issuer:', extract.issuer)
    console.log('📋 Full extract:', JSON.stringify(extract, null, 2))

    // Map Stanford attributes
    const attributes = extract.attributes

    const user = {
      id: extract.nameID || 'unknown-id',

      // Core Stanford Identity
      sunetId: attributes['urn:oid:0.9.2342.19200300.100.1.1'],
      email: attributes['urn:oid:0.9.2342.19200300.100.1.3'],
      eduPersonPrincipalName: attributes['urn:oid:1.3.6.1.4.1.5923.1.1.1.6'],

      // Name
      firstName: attributes['urn:oid:2.5.4.42'],
      lastName: attributes['urn:oid:2.5.4.4'],
      displayName: attributes['urn:oid:2.16.840.1.113730.3.1.241'],
      name: attributes['urn:oid:2.16.840.1.113730.3.1.241'] ||
            `${attributes['urn:oid:2.5.4.42'] || ''} ${attributes['urn:oid:2.5.4.4'] || ''}`.trim() ||
            'Stanford User',

      // Affiliations
      eduPersonAffiliation: attributes['urn:oid:1.3.6.1.4.1.5923.1.1.1.1'],
      eduPersonScopedAffiliation: attributes['urn:oid:1.3.6.1.4.1.5923.1.1.1.9'],
      suAffiliation: attributes['suAffiliation'],
      affiliation: attributes['urn:oid:1.3.6.1.4.1.5923.1.1.1.1'] ||
                   attributes['suAffiliation'],

      // Other
      eduPersonEntitlement: attributes['urn:oid:1.3.6.1.4.1.5923.1.1.1.7'],
      eduPersonOrcid: attributes['urn:oid:1.3.6.1.4.1.5923.1.1.1.16'],
      subjectId: attributes['urn:oasis:names:tc:SAML:attribute:subject-id'],
      pairwiseId: attributes['urn:oasis:names:tc:SAML:attribute:pairwise-id'],

      authenticationTime: new Date().toISOString(),
      allAttributes: attributes,
    }

    const baseUrl = process.env.NEXTAUTH_URL || 'https://churro-test.stanford.edu'
    const redirectUrl = new URL('/auth/test', baseUrl)
    redirectUrl.searchParams.set('saml_success', 'true')
    redirectUrl.searchParams.set('user', JSON.stringify(user))

    return Response.redirect(redirectUrl.toString(), 302)

  } catch (error) {
    console.error('❌ SAML callback error:', error)
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack')
    console.error('❌ Error type:', error?.constructor?.name)
    console.error('❌ Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2))

    const baseUrl = process.env.NEXTAUTH_URL || 'https://churro-test.stanford.edu'
    const redirectUrl = new URL('/auth/test', baseUrl)
    redirectUrl.searchParams.set('saml_error', String(error))

    return Response.redirect(redirectUrl.toString(), 302)
  }
}