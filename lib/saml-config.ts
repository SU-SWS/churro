import { SAML } from '@node-saml/node-saml'

// Resolve base URL: explicit APP_URL takes precedence, then Vercel's automatic
// per-branch/per-deployment variables (no protocol prefix on Vercel vars)
const resolvedAppUrl =
  process.env.APP_URL ||
  (process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : undefined) ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)

if (!resolvedAppUrl) {
  throw new Error(
    'Could not determine application URL. Set APP_URL, or deploy to Vercel (VERCEL_BRANCH_URL/VERCEL_URL are set automatically).'
  )
}

if (!process.env.SAML_CERT) {
  throw new Error('SAML_CERT environment variable is required')
}

if (!process.env.SAML_SP_PRIVATE_KEY) {
  throw new Error('SAML_SP_PRIVATE_KEY environment variable is required')
}

if (!process.env.SAML_SP_CERT) {
  throw new Error('SAML_SP_CERT environment variable is required')
}

const baseUrl = resolvedAppUrl

// Allow overriding the entity ID for local development
// This lets you use https://localhost:3000 locally while registering
// https://churro-test.stanford.edu as the entity ID in SPDB
const entityId = process.env.SAML_ENTITY_ID || baseUrl

export const saml = new SAML({
  // SP (Service Provider) settings
  callbackUrl: `${baseUrl}/api/saml/acs`,
  entryPoint: process.env.SAML_ENTRY_POINT || 'https://login-uat.stanford.edu/idp/profile/SAML2/Redirect/SSO',
  issuer: entityId, // Use separate entity ID if provided

  // IdP (Identity Provider) settings
  idpCert: process.env.SAML_CERT,

  // SP encryption/decryption
  decryptionPvk: process.env.SAML_SP_PRIVATE_KEY,

  // SP public certificate (used in metadata generation and encryption)
  publicCert: process.env.SAML_SP_CERT,

  // ✅ Enable signing of authentication requests
  privateKey: process.env.SAML_SP_PRIVATE_KEY, // Use your SP private key to sign requests
  signatureAlgorithm: 'sha256',

  // ✅ Sign the metadata XML (recommended for production)
  signMetadata: true,

  // Validation settings
  acceptedClockSkewMs: 300000, // Allow up to 5 minutes clock skew
  wantAssertionsSigned: true,
  wantAuthnResponseSigned: true,

  // ✅ Security: Maximum age for SAML assertions (5 minutes)
  // Prevents old assertions from being replayed
  maxAssertionAgeMs: 300000, // 5 minutes

  // Other settings
  identifierFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
})