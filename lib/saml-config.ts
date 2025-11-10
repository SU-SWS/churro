import { SAML } from '@node-saml/node-saml'

const baseUrl = process.env.NEXTAUTH_URL || 'https://churro-test.stanford.edu'

// Validate required environment variables
if (!process.env.SAML_CERT) {
  throw new Error('SAML_CERT environment variable is required')
}

if (!process.env.SAML_SP_PRIVATE_KEY) {
  throw new Error('SAML_SP_PRIVATE_KEY environment variable is required')
}

if (!process.env.SAML_SP_CERT) {
  throw new Error('SAML_SP_CERT environment variable is required')
}

export const saml = new SAML({
  // SP (Service Provider) settings
  callbackUrl: `${baseUrl}/api/saml/acs`,
  entryPoint: process.env.SAML_ENTRY_POINT || 'https://login-uat.stanford.edu/idp/profile/SAML2/Redirect/SSO',
  issuer: baseUrl,

  // IdP (Identity Provider) settings
  idpCert: process.env.SAML_CERT,

  // SP encryption/decryption
  decryptionPvk: process.env.SAML_SP_PRIVATE_KEY,

  // SP public certificate (used in metadata generation)
  // Note: This is set via privateKey below, which includes the cert reference

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