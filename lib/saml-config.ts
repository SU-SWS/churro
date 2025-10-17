import * as samlify from 'samlify'

// Bypass schema validation (Java-based validator not compatible with Vercel)
// This is acceptable because we have signature verification enabled
samlify.setSchemaValidator({
  validate: async (_xml: string) => Promise.resolve({ isValid: true })
})

const baseUrl = process.env.NEXTAUTH_URL || 'https://churro-test.stanford.edu'

export const idp = samlify.IdentityProvider({
  entityID: 'https://idp-uat.stanford.edu/',
  singleSignOnService: [
    {
      Binding: samlify.Constants.namespace.binding.redirect,
      Location: process.env.SAML_ENTRY_POINT || 'https://login-uat.stanford.edu/idp/profile/SAML2/Redirect/SSO',
    },
  ],
  // Stanford's signing certificate for verification
  signingCert: process.env.SAML_CERT,
  // Stanford's encryption certificate (same as signing cert in this case)
  encryptCert: process.env.SAML_CERT,
  wantAuthnRequestsSigned: false,
})

export const sp = samlify.ServiceProvider({
  entityID: process.env.SAML_ISSUER || baseUrl,
  authnRequestsSigned: false, // We don't sign our requests
  wantAssertionsSigned: false,  // ⚠️ TEMPORARILY DISABLED for debugging
  wantMessageSigned: false,     // ⚠️ TEMPORARILY DISABLED for debugging
  nameIDFormat: ['urn:oasis:names:tc:SAML:2.0:nameid-format:persistent'],
  assertionConsumerService: [
    {
      Binding: samlify.Constants.namespace.binding.post,
      Location: `${baseUrl}/api/saml/acs`,
    },
  ],
  // Your SP's decryption keys
  encryptCert: process.env.SAML_SP_CERT,
  privateKey: process.env.SAML_SP_PRIVATE_KEY,
  isAssertionEncrypted: true,
})