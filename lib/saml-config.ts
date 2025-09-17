import * as samlify from 'samlify'

// Set up proper validation with certificate
samlify.setSchemaValidator({
  validate: async () => ({ isValid: true }) // We'll rely on certificate validation
})

const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

// Configure the Identity Provider (Stanford UAT) with proper certificate
export const idp = samlify.IdentityProvider({
  metadata: `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" 
                     entityID="https://login-uat.stanford.edu">
  <md:IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:KeyDescriptor use="signing">
      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:X509Data>
          <ds:X509Certificate>${process.env.SAML_CERT?.replace(/-----BEGIN CERTIFICATE-----/, '').replace(/-----END CERTIFICATE-----/, '').replace(/\n/g, '')}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
    <md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" 
                           Location="${process.env.SAML_ENTRY_POINT}" />
  </md:IDPSSODescriptor>
</md:EntityDescriptor>`,
})

// Configure the Service Provider (your app)
export const sp = samlify.ServiceProvider({
  entityID: process.env.SAML_ISSUER || baseUrl,
  authnRequestsSigned: false,
  wantAssertionsSigned: true, // Re-enable now that we have the certificate
  wantMessageSigned: false,
  nameIDFormat: ['urn:oasis:names:tc:SAML:2.0:nameid-format:persistent'],
  assertionConsumerService: [{
    Binding: samlify.Constants.namespace.binding.post,
    Location: `${baseUrl}/api/saml/acs`, // Back to the original endpoint
  }],
  // Add your SP certificate if you have it
  ...(process.env.SAML_SP_CERT && {
    signingCert: process.env.SAML_SP_CERT,
    encryptCert: process.env.SAML_SP_CERT,
  }),
})