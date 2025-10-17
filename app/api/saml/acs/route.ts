import { NextRequest, NextResponse } from 'next/server'
import { sp, idp } from '@/lib/saml-config'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const samlResponse = formData.get('SAMLResponse') as string

    if (!samlResponse) {
      throw new Error('No SAML response received')
    }

    // Let samlify handle decryption and parsing automatically
    const { extract } = await sp.parseLoginResponse(idp, 'post', {
      body: { SAMLResponse: samlResponse }
    })

    // extract.attributes contains all the parsed attributes
    const attributes = extract.attributes

    // Map Stanford attributes
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

    const baseUrl = process.env.NEXTAUTH_URL || 'https://churro.stanford.edu'
    const redirectUrl = new URL('/auth/test', baseUrl)
    redirectUrl.searchParams.set('saml_success', 'true')
    redirectUrl.searchParams.set('user', JSON.stringify(user))

    return Response.redirect(redirectUrl.toString(), 302)

  } catch (error) {
    console.error('❌ SAML callback error:', error)

    const baseUrl = process.env.NEXTAUTH_URL || 'https://churro.stanford.edu'
    const redirectUrl = new URL('/auth/test', baseUrl)
    redirectUrl.searchParams.set('saml_error', String(error))

    return Response.redirect(redirectUrl.toString(), 302)
  }
}