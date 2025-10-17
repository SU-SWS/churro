import { NextRequest, NextResponse } from 'next/server'
import { sp, idp } from '@/lib/saml-config'
import * as xmldom from '@xmldom/xmldom'
import * as xmlenc from 'xml-encryption'
import * as crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const samlResponse = formData.get('SAMLResponse') as string

    if (!samlResponse) {
      throw new Error('No SAML response received')
    }

    // Decode the response
    const decodedResponse = Buffer.from(samlResponse, 'base64').toString('utf-8')
    console.log('🔍 Expected entityID:', idp.entityMeta.getEntityID())

    // Try to manually decrypt and inspect the assertion
    try {
      const DOMParser = xmldom.DOMParser
      const doc = new DOMParser().parseFromString(decodedResponse, 'text/xml')

      const encryptedAssertions = doc.getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:assertion', 'EncryptedAssertion')

      if (encryptedAssertions.length > 0) {
        console.log('🔐 Attempting to manually decrypt assertion...')

        const privateKeyPem = process.env.SAML_SP_PRIVATE_KEY
        if (!privateKeyPem) {
          throw new Error('No private key available')
        }

        // Use xml-encryption to decrypt
        const encryptedAssertion = new xmldom.XMLSerializer().serializeToString(encryptedAssertions[0])

        xmlenc.decrypt(encryptedAssertion, { key: privateKeyPem }, (err, decrypted) => {
          if (err) {
            console.error('❌ Manual decryption failed:', err)
          } else {
            console.log('✅ Manually decrypted assertion (first 1000 chars):', decrypted.substring(0, 1000))

            // Look for issuer in the decrypted assertion
            const issuerMatch = decrypted.match(/<saml2?:Issuer[^>]*>([^<]+)<\/saml2?:Issuer>/i)
            if (issuerMatch) {
              console.log('🔍 Issuer found in DECRYPTED assertion:', JSON.stringify(issuerMatch[1]))
              console.log('🔍 Issuer length:', issuerMatch[1].length)
              console.log('🔍 Issuer bytes:', Buffer.from(issuerMatch[1]).toString('hex'))
            }
          }
        })
      }
    } catch (debugError) {
      console.error('⚠️ Debug decryption failed:', debugError)
    }

    // Wait a moment for the async decrypt to log
    await new Promise(resolve => setTimeout(resolve, 100))

    // Now try samlify parsing
    const { extract } = await sp.parseLoginResponse(idp, 'post', {
      body: { SAMLResponse: samlResponse }
    })

    console.log('✅ Successfully parsed SAML response')

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

    const baseUrl = process.env.NEXTAUTH_URL || 'https://churro-test.stanford.edu'
    const redirectUrl = new URL('/auth/test', baseUrl)
    redirectUrl.searchParams.set('saml_error', String(error))

    return Response.redirect(redirectUrl.toString(), 302)
  }
}