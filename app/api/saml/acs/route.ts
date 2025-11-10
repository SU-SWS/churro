import { NextRequest, NextResponse } from 'next/server'
import { saml } from '@/lib/saml-config'
import { generateJWT, getJWTCookieName, getSecureCookieOptions, type SamlUser } from '@/lib/jwt-auth'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const samlResponse = formData.get('SAMLResponse') as string

    if (!samlResponse) {
      throw new Error('No SAML response received')
    }

    console.log('🔍 Processing SAML response with @node-saml/node-saml...')

    const { profile } = await saml.validatePostResponseAsync({ SAMLResponse: samlResponse })

    if (!profile) {
      throw new Error('No profile returned from SAML response')
    }

    console.log('✅ SAML validation succeeded!')
    console.log('📋 Profile summary:', {
      nameID: profile.nameID,
      email: profile.email,
      sunetId: profile.sunetId,
      attributes: Object.keys(profile.attributes || {}),
    })

    const attributes = (profile.attributes || {}) as Record<string, unknown>

    // Helper function to get attribute value (handles both single values and arrays)
    const getAttr = (key: string): string | undefined => {
      const value = attributes[key]
      if (Array.isArray(value)) {
        return value[0] as string
      }
      return value as string | undefined
    }

    const user: SamlUser = {
      id: profile.nameID || 'unknown-id',

      // Core Stanford Identity
      sunetId: getAttr('urn:oid:0.9.2342.19200300.100.1.1'),
      email: getAttr('urn:oid:0.9.2342.19200300.100.1.3'),
      eduPersonPrincipalName: getAttr('urn:oid:1.3.6.1.4.1.5923.1.1.1.6'),

      // Name
      firstName: getAttr('urn:oid:2.5.4.42'),
      lastName: getAttr('urn:oid:2.5.4.4'),
      displayName: getAttr('urn:oid:2.16.840.1.113730.3.1.241'),
      name: getAttr('urn:oid:2.16.840.1.113730.3.1.241') ||
            `${getAttr('urn:oid:2.5.4.42') || ''} ${getAttr('urn:oid:2.5.4.4') || ''}`.trim() ||
            'Stanford User',

      // Affiliations
      eduPersonAffiliation: getAttr('urn:oid:1.3.6.1.4.1.5923.1.1.1.1'),
      eduPersonScopedAffiliation: getAttr('urn:oid:1.3.6.1.4.1.5923.1.1.1.9'),
      suAffiliation: getAttr('suAffiliation'),
      affiliation: getAttr('urn:oid:1.3.6.1.4.1.5923.1.1.1.1') || getAttr('suAffiliation'),

      // Other
      eduPersonEntitlement: getAttr('urn:oid:1.3.6.1.4.1.5923.1.1.1.7'),
      eduPersonOrcid: getAttr('urn:oid:1.3.6.1.4.1.5923.1.1.1.16'),
      subjectId: getAttr('urn:oasis:names:tc:SAML:attribute:subject-id'),
      pairwiseId: getAttr('urn:oasis:names:tc:SAML:attribute:pairwise-id'),

      authenticationTime: new Date().toISOString(),
      allAttributes: attributes,
    }

    console.log('✅ Successfully parsed user:', user.sunetId || user.email || user.id)

    // Generate JWT token from the SAML profile
    const jwtToken = await generateJWT(user)

    // Set the JWT as a secure HTTP-only cookie
    const cookieStore = await cookies()
    cookieStore.set(getJWTCookieName(), jwtToken, getSecureCookieOptions())

    // Redirect to the application (or a relay state if available)
    const baseUrl = process.env.NEXTAUTH_URL || 'https://churro-test.stanford.edu'
    const redirectUrl = new URL('/auth/test', baseUrl)
    redirectUrl.searchParams.set('saml_success', 'true')

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