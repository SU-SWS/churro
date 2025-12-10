import { NextRequest } from 'next/server'
import { saml } from '@/lib/saml-config'
import { generateJWT, type SamlUser } from '@/lib/jwt-auth'
import { getBaseUrl } from '@/lib/url-utils'

/**
 * Common SAML response processing logic for both POST and GET handlers
 */
async function processSamlResponse(request: NextRequest, samlResponse: string) {
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

  // Generate and save encrypted session from the SAML profile
  // Note: Using single HTTP-only encrypted cookie approach rather than dual cookie pattern
  // (encrypted session + JS-readable auth status cookie) because:
  // - Low concurrent usage (~2-30 users max, typically <2 concurrent)
  // - Users unlikely to load multiple pages per session
  // - Auth status checks are infrequent (mainly on page load)
  // - ~50-100ms API call overhead per auth check is acceptable for this use case
  // - Simpler implementation outweighs marginal performance gains
  // - Iron-session provides encryption for enhanced security without added complexity
  await generateJWT(user)

  // Redirect to the application (or a relay state if available)
  const baseUrl = getBaseUrl(request)
  const redirectUrl = new URL('/auth/test', baseUrl)
  redirectUrl.searchParams.set('saml_success', 'true')

  return Response.redirect(redirectUrl.toString(), 302)
}

/**
 * Handle SAML responses via HTTP-POST binding (form data)
 */
/**
 * Handle SAML responses via HTTP-POST binding (form data)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const samlResponse = formData.get('SAMLResponse') as string

    if (!samlResponse) {
      throw new Error('No SAML response received in form data')
    }

    console.log('📨 POST: Processing SAML response from form data')
    return await processSamlResponse(request, samlResponse)

  } catch (error) {
    console.error('❌ SAML POST callback error:', error)
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack')

    const baseUrl = getBaseUrl(request)
    const redirectUrl = new URL('/auth/test', baseUrl)
    redirectUrl.searchParams.set('saml_error', 'Authentication failed')

    return Response.redirect(redirectUrl.toString(), 302)
  }
}