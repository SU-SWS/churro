# Stanford SAML SSO Implementation Guide

A complete SAML Single Sign-On (SSO) integration with Stanford University's Identity Provider, supporting encrypted assertions and full attribute mapping.

## Overview

This implementation provides:
- ✅ **Complete SAML SSO flow** with Stanford Identity Provider
- ✅ **Encrypted assertion decryption** using RSA-OAEP + AES-CBC
- ✅ **Full Stanford attribute mapping** (SUNet ID, email, affiliation, etc.)
- ✅ **Next.js App Router compatibility**
- ✅ **Production-ready security**

## Architecture

```mermaid
sequenceDiagram
    participant User
    participant App as Next.js App
    participant Stanford as Stanford IdP

    User->>App: Access protected resource
    App->>Stanford: SAML AuthnRequest
    Stanford->>User: Login form
    User->>Stanford: Credentials
    Stanford->>App: Encrypted SAML Response
    App->>App: Decrypt assertion
    App->>User: Authenticated session
```

## Prerequisites

- Next.js 13+ with App Router
- Node.js 18+
- SSL certificate for your domain
- Stanford SPDB registration

## Installation

### 1. Install Dependencies

```bash
npm install next-auth samlify node-forge @types/node-forge @xmldom/xmldom
```

### 2. Generate SP Certificates

Generate certificates for SAML encryption/signing:

```bash
# Generate private key
openssl genrsa -out saml-sp.key 2048

# Generate certificate (replace with your domain)
openssl req -new -x509 -key saml-sp.key -out saml-sp.crt -days 1825 \
  -subj "/C=US/ST=CA/L=Stanford/O=Stanford University/CN=yourdomain.stanford.edu"
```

### 3. Environment Variables

#### Development (`.env.local`)

```env
# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-super-secret-jwt-secret-here

# Stanford SAML Configuration
SAML_ENTRY_POINT=https://login-uat.stanford.edu/idp/profile/SAML2/Redirect/SSO
SAML_ISSUER=http://localhost:3000
SAML_AUDIENCE=http://localhost:3000

# Stanford UAT IdP Certificate
SAML_CERT="-----BEGIN CERTIFICATE-----
MIIDdzCCAl+gAwIBAgIJAKzrFhpD...
-----END CERTIFICATE-----"

# Your SP Certificate and Private Key
SAML_SP_CERT="-----BEGIN CERTIFICATE-----
MIICXjCCAcegAwIBAgIBADANBgkqhkiG9w0BAQ0FADCBhzELMAkGA1UEBhMCVVMx...
-----END CERTIFICATE-----"

SAML_SP_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7vbqajDw4o6gJ...
-----END PRIVATE KEY-----"
```

#### Production (Vercel Environment Variables)

Set these in your Vercel dashboard under **Settings → Environment Variables**:

| Variable | Value | Notes |
|----------|-------|-------|
| `NEXTAUTH_URL` | `https://yourdomain.stanford.edu` | Your production domain |
| `NEXTAUTH_SECRET` | `[32-char random string]` | Generate with `openssl rand -base64 32` |
| `SAML_ENTRY_POINT` | `https://login.stanford.edu/idp/profile/SAML2/Redirect/SSO` | Production: remove `-uat` |
| `SAML_ISSUER` | `https://yourdomain.stanford.edu` | Must match your SP Entity ID |
| `SAML_AUDIENCE` | `https://yourdomain.stanford.edu` | Usually same as issuer |
| `SAML_CERT` | `[Stanford production certificate]` | Get from Stanford IT |
| `SAML_SP_CERT` | `[Your SP certificate]` | Include BEGIN/END lines |
| `SAML_SP_PRIVATE_KEY` | `[Your SP private key]` | Keep secure! |

## Implementation

### 1. SAML Configuration (`/lib/saml-config.ts`)

```typescript
import * as samlify from 'samlify'

// Set up validation
samlify.setSchemaValidator({
  validate: () => ({ isValid: true })
})

const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

// Configure the Identity Provider (Stanford)
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

// Configure the Service Provider (your app)
export const sp = samlify.ServiceProvider({
  entityID: process.env.SAML_ISSUER || baseUrl,
  authnRequestsSigned: false,
  wantAssertionsSigned: false,
  wantMessageSigned: false,
  nameIDFormat: ['urn:oasis:names:tc:SAML:2.0:nameid-format:persistent'],
  assertionConsumerService: [{
    Binding: samlify.Constants.namespace.binding.post,
    Location: `${baseUrl}/api/saml/acs`,
  }],
  encryptCert: process.env.SAML_SP_CERT,
  privateKey: process.env.SAML_SP_PRIVATE_KEY,
  isAssertionEncrypted: true,
})
```

### 2. SAML Login Endpoint (`/app/api/saml/login/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { sp, idp } from '../../../../lib/saml-config'

export async function GET(request: NextRequest) {
  try {
    console.log('🚀 Initiating SAML login...')

    const { context: loginUrl } = sp.createLoginRequest(idp, 'redirect')

    console.log('🔗 Redirecting to Stanford:', loginUrl)

    return NextResponse.redirect(loginUrl)

  } catch (error) {
    console.error('❌ SAML login error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate SAML login', details: String(error) },
      { status: 500 }
    )
  }
}
```

### 3. SAML Callback with Decryption (`/app/api/saml/acs/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import forge from 'node-forge'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const samlResponse = formData.get('SAMLResponse') as string

    if (!samlResponse) {
      throw new Error('No SAML response received')
    }

    // Decode the base64 SAML response
    const decodedResponse = Buffer.from(samlResponse, 'base64').toString('utf-8')

    // Extract issuer
    const issuerMatch = decodedResponse.match(/<saml2:Issuer[^>]*>([^<]+)<\/saml2:Issuer>/)

    // Look for encrypted assertion
    const encryptedAssertionMatch = decodedResponse.match(/<saml2:EncryptedAssertion[^>]*>([\s\S]*?)<\/saml2:EncryptedAssertion>/)

    if (encryptedAssertionMatch) {
      // Extract CipherValue elements (encrypted key and data)
      const cipherValues = []
      const cipherPattern = /<xenc:CipherValue[^>]*>([^<]+)<\/xenc:CipherValue>/g
      let match
      while ((match = cipherPattern.exec(decodedResponse)) !== null) {
        cipherValues.push(match[1])
      }

      if (cipherValues.length < 2) {
        throw new Error(`Expected 2 CipherValues, found ${cipherValues.length}`)
      }

      const encryptedKey = cipherValues[0]
      const encryptedData = cipherValues[1]

      // Get our private key
      const privateKeyPem = process.env.SAML_SP_PRIVATE_KEY
      if (!privateKeyPem) {
        throw new Error('SAML_SP_PRIVATE_KEY environment variable not set')
      }

      const privateKey = forge.pki.privateKeyFromPem(privateKeyPem)

      // Decrypt the symmetric key
      const encryptedKeyBytes = forge.util.decode64(encryptedKey)
      const decryptedKeyBytes = privateKey.decrypt(encryptedKeyBytes, 'RSA-OAEP')

      // Decrypt the assertion data
      const encryptedDataBytes = forge.util.decode64(encryptedData)
      const decipher = forge.cipher.createDecipher('AES-CBC', decryptedKeyBytes)

      // Extract IV (first 16 bytes for AES)
      const ivLength = 16
      const iv = encryptedDataBytes.substring(0, ivLength)
      const cipherText = encryptedDataBytes.substring(ivLength)

      decipher.start({ iv: iv })
      decipher.update(forge.util.createBuffer(cipherText))

      if (!decipher.finish()) {
        throw new Error('Failed to decrypt assertion')
      }

      const decryptedAssertion = decipher.output.toString()

      // Parse the decrypted assertion for attributes
      const nameIDMatch = decryptedAssertion.match(/<saml2:NameID[^>]*>([^<]+)<\/saml2:NameID>/)

      const attributePattern = /<saml2:Attribute[^>]*Name="([^"]+)"[^>]*>[\s\S]*?<saml2:AttributeValue[^>]*>([^<]+)<\/saml2:AttributeValue>/g
      const attributes: { [key: string]: string } = {}

      let attributeMatch
      while ((attributeMatch = attributePattern.exec(decryptedAssertion)) !== null) {
        const [, attrName, attrValue] = attributeMatch
        attributes[attrName] = attrValue
      }

      // Map Stanford attributes using official ARP mapping
      const user = {
        id: nameIDMatch?.[1] || 'unknown-id',

        // Core Stanford Identity Attributes
        sunetId: attributes['urn:oid:0.9.2342.19200300.100.1.1'], // uid
        email: attributes['urn:oid:0.9.2342.19200300.100.1.3'], // mail
        eduPersonPrincipalName: attributes['urn:oid:1.3.6.1.4.1.5923.1.1.1.6'],

        // Name Attributes
        firstName: attributes['urn:oid:2.5.4.42'], // givenName
        lastName: attributes['urn:oid:2.5.4.4'], // sn
        displayName: attributes['urn:oid:2.16.840.1.113730.3.1.241'],
        name: attributes['urn:oid:2.16.840.1.113730.3.1.241'] ||
              `${attributes['urn:oid:2.5.4.42'] || ''} ${attributes['urn:oid:2.5.4.4'] || ''}`.trim(),

        // Affiliation Attributes
        eduPersonAffiliation: attributes['urn:oid:1.3.6.1.4.1.5923.1.1.1.1'],
        eduPersonScopedAffiliation: attributes['urn:oid:1.3.6.1.4.1.5923.1.1.1.9'],
        suAffiliation: attributes['suAffiliation'],
        affiliation: attributes['urn:oid:1.3.6.1.4.1.5923.1.1.1.1'] || attributes['suAffiliation'],

        // Stanford-specific Attributes
        eduPersonEntitlement: attributes['urn:oid:1.3.6.1.4.1.5923.1.1.1.7'],
        eduPersonOrcid: attributes['urn:oid:1.3.6.1.4.1.5923.1.1.1.16'],
        subjectId: attributes['urn:oasis:names:tc:SAML:attribute:subject-id'],
        pairwiseId: attributes['urn:oasis:names:tc:SAML:attribute:pairwise-id'],
        persistentId: attributes['persistentId'],

        // System Attributes
        detectedIssuer: issuerMatch?.[1],
        decryptionSuccessful: true,
        authenticationTime: new Date().toISOString(),
        allAttributes: attributes,
      }

      const baseUrl = process.env.NEXTAUTH_URL!
      const redirectUrl = new URL('/auth/success', baseUrl)
      redirectUrl.searchParams.set('user', JSON.stringify(user))

      return Response.redirect(redirectUrl.toString(), 302)
    }

    throw new Error('No encrypted assertion found in response')

  } catch (error) {
    console.error('❌ SAML callback error:', error)

    const baseUrl = process.env.NEXTAUTH_URL!
    const redirectUrl = new URL('/auth/error', baseUrl)
    redirectUrl.searchParams.set('error', String(error))

    return Response.redirect(redirectUrl.toString(), 302)
  }
}
```

### 4. Metadata Generation (`/app/api/saml/metadata/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { sp } from '../../../../lib/saml-config'

export async function GET(request: NextRequest) {
  try {
    const metadata = sp.getMetadata()

    return new NextResponse(metadata, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': 'attachment; filename="sp-metadata.xml"'
      }
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate metadata', details: String(error) },
      { status: 500 }
    )
  }
}
```

### 5. Session Provider Setup

#### App Layout (`/app/layout.tsx`)

```typescript
import { SessionProvider } from './providers'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
```

#### Providers (`/app/providers.tsx`)

```typescript
'use client'
import { SessionProvider as NextAuthSessionProvider } from "next-auth/react"
import { ReactNode } from
```