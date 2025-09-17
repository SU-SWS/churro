import * as samlify from 'samlify'

// Set up validation
samlify.setSchemaValidator({
  validate: async (_xml: string) => Promise.resolve({ isValid: true })
})

const baseUrl = process.env.NEXTAUTH_URL || 'https://churro-test.stanford.edu'

// Configure the Identity Provider
export const idp = samlify.IdentityProvider({
  metadata: `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" 
                     entityID="https://idp-uat.stanford.edu/">
  <md:IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" 
                           Location="${process.env.SAML_ENTRY_POINT}" />
  </md:IDPSSODescriptor>
</md:EntityDescriptor>`,
})

// Configure the Service Provider
export const sp = samlify.ServiceProvider({
  entityID: process.env.SAML_ISSUER || baseUrl,
  authnRequestsSigned: false,
  wantAssertionsSigned: false, // Disable for now
  wantMessageSigned: false,
  nameIDFormat: ['urn:oasis:names:tc:SAML:2.0:nameid-format:persistent'],
  assertionConsumerService: [{
    Binding: samlify.Constants.namespace.binding.post,
    Location: `${baseUrl}/api/saml/acs`,
  }],
  // Add your SP certificates for decryption
  signingCert: process.env.SAML_SP_CERT,
  encryptCert: process.env.SAML_SP_CERT,
  privateKey: process.env.SAML_SP_PRIVATE_KEY,
  // Enable assertion decryption
  isAssertionEncrypted: true,
})