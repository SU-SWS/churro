import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const entityId = process.env.SAML_ISSUER || baseUrl
  
  // Get your SP certificate (remove the BEGIN/END lines and newlines for XML)
  const spCert = process.env.SAML_SP_CERT
    ?.replace(/-----BEGIN CERTIFICATE-----/, '')
    .replace(/-----END CERTIFICATE-----/, '')
    .replace(/\n/g, '')
    .trim()

  if (!spCert) {
    return new NextResponse('SP Certificate not configured', { status: 500 })
  }
  
  const metadata = `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" 
                     xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
                     entityID="${entityId}">
  <md:SPSSODescriptor AuthnRequestsSigned="false" 
                      WantAssertionsSigned="true" 
                      protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    
    <!-- Signing Certificate -->
    <md:KeyDescriptor use="signing">
      <ds:KeyInfo>
        <ds:X509Data>
          <ds:X509Certificate>${spCert}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
    
    <!-- Encryption Certificate -->
    <md:KeyDescriptor use="encryption">
      <ds:KeyInfo>
        <ds:X509Data>
          <ds:X509Certificate>${spCert}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
    
    <md:NameIDFormat>urn:oasis:names:tc:SAML:2.0:nameid-format:persistent</md:NameIDFormat>
    <md:NameIDFormat>urn:oasis:names:tc:SAML:2.0:nameid-format:transient</md:NameIDFormat>
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" 
                                Location="${baseUrl}/api/saml/acs" 
                                index="0" 
                                isDefault="true" />
    
    <md:AttributeConsumingService index="0">
      <md:ServiceName xml:lang="en">Cloud Hosting Usage Reporting with Recurring Output (CHURRO)</md:ServiceName>
      <md:RequestedAttribute Name="urn:oid:0.9.2342.19200300.100.1.3" 
                           NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri" 
                           FriendlyName="mail"
                           isRequired="true" />
      <md:RequestedAttribute Name="urn:oid:2.16.840.1.113730.3.1.241" 
                           NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri" 
                           FriendlyName="displayName"
                           isRequired="false" />
      <md:RequestedAttribute Name="urn:oid:2.5.4.42" 
                           NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri" 
                           FriendlyName="givenName"
                           isRequired="false" />
      <md:RequestedAttribute Name="urn:oid:2.5.4.4" 
                           NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri" 
                           FriendlyName="sn"
                           isRequired="false" />
    </md:AttributeConsumingService>
    
  </md:SPSSODescriptor>
  
  <md:Organization>
    <md:OrganizationName xml:lang="en">Stanford University</md:OrganizationName>
    <md:OrganizationDisplayName xml:lang="en">Stanford University</md:OrganizationDisplayName>
    <md:OrganizationURL xml:lang="en">https://stanford.edu</md:OrganizationURL>
  </md:Organization>
  
  <md:ContactPerson contactType="technical">
    <md:GivenName>Stanford Web Services</md:GivenName>
    <md:EmailAddress>sws-developers@lists.stanford.edu</md:EmailAddress>
  </md:ContactPerson>
  
</md:EntityDescriptor>`

  return new NextResponse(metadata, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Content-Disposition': 'attachment; filename="sp-metadata.xml"'
    }
  })
}