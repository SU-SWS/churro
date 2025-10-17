import { NextRequest, NextResponse } from 'next/server'
import { sp, idp } from '@/lib/saml-config'
import * as xmldom from '@xmldom/xmldom'
import * as xmlenc from 'xml-encryption'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const samlResponse = formData.get('SAMLResponse') as string

    if (!samlResponse) {
      throw new Error('No SAML response received')
    }

    const decodedResponse = Buffer.from(samlResponse, 'base64').toString('utf-8')
    console.log('🔍 Starting manual SAML parsing...')

    const DOMParser = xmldom.DOMParser
    const doc = new DOMParser().parseFromString(decodedResponse, 'text/xml')

    const encryptedAssertions = doc.getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:assertion', 'EncryptedAssertion')

    if (encryptedAssertions.length === 0) {
      throw new Error('No encrypted assertion found')
    }

    const privateKeyPem = process.env.SAML_SP_PRIVATE_KEY
    if (!privateKeyPem) {
      throw new Error('No private key available')
    }

    // Manually decrypt the assertion
    const encryptedAssertion = new xmldom.XMLSerializer().serializeToString(encryptedAssertions[0])

    const decryptedAssertion = await new Promise<string>((resolve, reject) => {
      xmlenc.decrypt(encryptedAssertion, { key: privateKeyPem }, (err, decrypted) => {
        if (err) reject(err)
        else resolve(decrypted)
      })
    })

    console.log('✅ Successfully decrypted assertion')

    // Parse the decrypted assertion
    const assertionDoc = new DOMParser().parseFromString(decryptedAssertion, 'text/xml')

    // Extract NameID
    const nameIDElements = assertionDoc.getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:assertion', 'NameID')
    const nameID = nameIDElements.length > 0 ? nameIDElements[0].textContent : null

    // Extract attributes
    const attributeStatements = assertionDoc.getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:assertion', 'AttributeStatement')
    const attributes: Record<string, any> = {}

    if (attributeStatements.length > 0) {
      const attributeElements = attributeStatements[0].getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:assertion', 'Attribute')

      for (let i = 0; i < attributeElements.length; i++) {
        const attr = attributeElements[i]
        const attrName = attr.getAttribute('Name')
        const valueElements = attr.getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:assertion', 'AttributeValue')

        if (attrName && valueElements.length > 0) {
          const values = []
          for (let j = 0; j < valueElements.length; j++) {
            values.push(valueElements[j].textContent)
          }
          attributes[attrName] = values.length === 1 ? values[0] : values
        }
      }
    }

    console.log('📋 Extracted attributes:', Object.keys(attributes))

    const user = {
      id: nameID || 'unknown-id',

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

    console.log('✅ Successfully parsed user:', user.sunetId || user.email || user.id)

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