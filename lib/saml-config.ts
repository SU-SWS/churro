import * as samlify from 'samlify'

const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

// Configure the Identity Provider (Stanford)
export const idp = samlify.IdentityProvider({
  metadata: `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" 
                     entityID="https://login.stanford.edu">
  <md:IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" 
                           Location="${process.env.SAML_ENTRY_POINT}" />
  </md:IDPSSODescriptor>
</md:EntityDescriptor>`,
})

// Configure the Service Provider (your app)
export const sp = samlify.ServiceProvider({
  entityID: process.env.SAML_ISSUER || baseUrl,
  authnRequestsSigned: false,
  wantAssertionsSigned: true,
  wantMessageSigned: false,
  nameIDFormat: ['urn:oasis:names:tc:SAML:2.0:nameid-format:persistent'],
  assertionConsumerService: [{
    Binding: samlify.Constants.namespace.binding.post,
    Location: `${baseUrl}/api/saml/acs`,
  }],
})
