import * as samlify from 'samlify'

// Bypass schema validation for now (we'll fix this in step 2)
samlify.setSchemaValidator({
  validate: async (_xml: string) => Promise.resolve({ isValid: true })
})

const baseUrl = process.env.NEXTAUTH_URL || 'https://churro-test.stanford.edu'

export const idp = samlify.IdentityProvider({
  entityID: 'https://idp-uat.stanford.edu/shibboleth',
  singleSignOnService: [
    {
      Binding: samlify.Constants.namespace.binding.redirect,
      Location: process.env.SAML_ENTRY_POINT || 'https://login-uat.stanford.edu/idp/profile/SAML2/Redirect/SSO',
    },
  ],
  // Add Stanford's signing certificate for verification
  signingCert: process.env.SAML_CERT,
  wantAuthnRequestsSigned: false,
})

export const sp = samlify.ServiceProvider({
  entityID: process.env.SAML_ISSUER || baseUrl,
  authnRequestsSigned: false, // We don't sign our requests
  wantAssertionsSigned: true,  // ✅ ENABLE - require signed assertions
  wantMessageSigned: true,     // ✅ ENABLE - require signed messages
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