import { SAML } from '@node-saml/node-saml'
import { getBaseUrl } from '@/lib/url-utils'

// Resolve base URL via the shared utility (single source of truth for URL resolution).
// Throws with a descriptive, environment-aware message if the URL cannot be determined.
const baseUrl = getBaseUrl()

if (!process.env.SAML_CERT) {
  throw new Error('SAML_CERT environment variable is required')
}

if (!process.env.SAML_SP_PRIVATE_KEY) {
  throw new Error('SAML_SP_PRIVATE_KEY environment variable is required')
}

if (!process.env.SAML_SP_CERT) {
  throw new Error('SAML_SP_CERT environment variable is required')
}

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