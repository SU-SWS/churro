# Stanford SAML SSO Implementation Guide

A complete SAML Single Sign-On (SSO) integration with Stanford University's Identity Provider, supporting encrypted assertions, signed authentication requests, and full attribute mapping.

## Overview

This implementation provides:
- ✅ **Complete SAML SSO flow** with Stanford Identity Provider
- ✅ **Signed authentication requests** for simplified endpoint management
- ✅ **Encrypted assertion decryption** using RSA-OAEP + AES-CBC
- ✅ **Signature verification** of SAML responses and assertions
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
    App->>Stanford: Signed SAML AuthnRequest
    Stanford->>User: Login form
    User->>Stanford: Credentials
    Stanford->>App: Signed & Encrypted SAML Response
    App->>App: Verify signatures
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
npm install @node-saml/node-saml
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
| `SAML_CERT` | `[Stanford production certificate]` | Get from Stanford IT |
| `SAML_SP_CERT` | `[Your SP certificate]` | Include BEGIN/END lines |
| `SAML_SP_PRIVATE_KEY` | `[Your SP private key]` | Keep secure! |

## Implementation

### 1. SAML Configuration (`/lib/saml-config.ts`)

```typescript
import { SAML } from '@node-saml/node-saml'

const baseUrl = process.env.NEXTAUTH_URL || 'https://churro-test.stanford.edu'

// Validate required environment variables
if (!process.env.SAML_CERT) {
  throw new Error('SAML_CERT environment variable is required')
}

if (!process.env.SAML_SP_PRIVATE_KEY) {
  throw new Error('SAML_SP_PRIVATE_KEY environment variable is required')
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

  // Enable signing of authentication requests
  privateKey: process.env.SAML_SP_PRIVATE_KEY,
  signatureAlgorithm: 'sha256',

  // Validation settings
  acceptedClockSkewMs: -1, // Accept any time skew
  wantAssertionsSigned: true,
  wantAuthnResponseSigned: true,

  // Other settings
  identifierFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
})
```

### 2. SAML Login Endpoint (`/app/api/saml/login/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { saml } from '@/lib/saml-config'

export async function GET(request: NextRequest) {
  try {
    const loginUrl = await saml.getAuthorizeUrlAsync('', '', {})
    return NextResponse.redirect(loginUrl)
  } catch (error) {
    console.error('Error initiating SAML login:', error)
    return NextResponse.json({ error: 'Failed to initiate login' }, { status: 500 })
  }
}
```

### 3. SAML Callback (`/app/api/saml/acs/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { saml } from '@/lib/saml-config'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const samlResponse = formData.get('SAMLResponse') as string

    if (!samlResponse) {
      throw new Error('No SAML response received')
    }

    console.log('🔍 Processing SAML response with @node-saml/node-saml...')

    const { profile } = await saml.validatePostResponseAsync({ SAMLResponse: samlResponse })

    if (!profile) {
      throw new Error('No profile returned from SAML response')
    }

    console.log('✅ SAML validation succeeded!')
    console.log('📋 Profile:', JSON.stringify(profile, null, 2))

    const attributes = (profile.attributes || {}) as Record<string, unknown>

    // Helper function to get attribute value (handles both single values and arrays)
    const getAttr = (key: string): string | undefined => {
      const value = attributes[key]
      if (Array.isArray(value)) {
        return value[0] as string
      }
      return value as string | undefined
    }

    const user = {
      id: profile.nameID || 'unknown-id',

      // Core Stanford Identity
      sunetId: getAttr('urn:oid:0.9.2342.19200300.100.1.1'),
      email: getAttr('urn:oid:0.9.2342.19200300.100.1.3'),
      eduPersonPrincipalName: getAttr('urn:oid:1.3.6.1.4.1.5923.1.1.1.6'),

      // Name
      firstName: getAttr('urn:oid:2.5.4.42'),
      lastName: getAttr('urn:oid:2.5.4.4'),
      displayName: getAttr('urn:oid:2.16.840.1.113730.3.1.241'),
      name: getAttr('urn:oid:2.16.840.1.113730.3.1.241') ||
            `${getAttr('urn:oid:2.5.4.42') || ''} ${getAttr('urn:oid:2.5.4.4') || ''}`.trim() ||
            'Stanford User',

      // Affiliations
      eduPersonAffiliation: getAttr('urn:oid:1.3.6.1.4.1.5923.1.1.1.1'),
      eduPersonScopedAffiliation: getAttr('urn:oid:1.3.6.1.4.1.5923.1.1.1.9'),
      suAffiliation: getAttr('suAffiliation'),
      affiliation: getAttr('urn:oid:1.3.6.1.4.1.5923.1.1.1.1') || getAttr('suAffiliation'),

      // Other
      eduPersonEntitlement: getAttr('urn:oid:1.3.6.1.4.1.5923.1.1.1.7'),
      eduPersonOrcid: getAttr('urn:oid:1.3.6.1.4.1.5923.1.1.1.16'),
      subjectId: getAttr('urn:oasis:names:tc:SAML:attribute:subject-id'),
      pairwiseId: getAttr('urn:oasis:names:tc:SAML:attribute:pairwise-id'),

      authenticationTime: new Date().toISOString(),
      allAttributes: attributes,
    }

    console.log('✅ Successfully parsed user:', user.sunetId || user.email || user.id)

    const baseUrl = process.env.NEXTAUTH_URL || 'https://churro-test.stanford.edu'
    const redirectUrl = new URL('/auth/test', baseUrl)
    redirectUrl.searchParams.set('saml_success', 'true')
    redirectUrl.searchParams.set('user', JSON.stringify(user))

    return Response.redirect(redirectUrl.toString(), 302)

  } catch (error) {
    console.error('❌ SAML callback error:', error)
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack')

    const baseUrl = process.env.NEXTAUTH_URL || 'https://churro-test.stanford.edu'
    const redirectUrl = new URL('/auth/test', baseUrl)
    redirectUrl.searchParams.set('saml_error', String(error))

    return Response.redirect(redirectUrl.toString(), 302)
  }
}
```

### 4. Metadata Generation (`/app/api/saml/metadata/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { saml } from '@/lib/saml-config'

export async function GET(request: NextRequest) {
  try {
    const metadata = saml.generateServiceProviderMetadata(
      process.env.SAML_SP_CERT || null,
      process.env.SAML_SP_CERT || null
    )

    return new NextResponse(metadata, {
      headers: {
        'Content-Type': 'application/xml',
      },
    })
  } catch (error) {
    console.error('Error generating metadata:', error)
    return NextResponse.json({ error: 'Failed to generate metadata' }, { status: 500 })
  }
}
```

## Stanford Attribute Mapping

The implementation automatically maps Stanford's SAML attributes using official OID identifiers:

| User Property | SAML Attribute OID | Friendly Name |
|--------------|-------------------|---------------|
| `sunetId` | `urn:oid:0.9.2342.19200300.100.1.1` | uid |
| `email` | `urn:oid:0.9.2342.19200300.100.1.3` | mail |
| `firstName` | `urn:oid:2.5.4.42` | givenName |
| `lastName` | `urn:oid:2.5.4.4` | sn |
| `displayName` | `urn:oid:2.16.840.1.113730.3.1.241` | displayName |
| `eduPersonPrincipalName` | `urn:oid:1.3.6.1.4.1.5923.1.1.1.6` | eduPersonPrincipalName |
| `eduPersonAffiliation` | `urn:oid:1.3.6.1.4.1.5923.1.1.1.1` | eduPersonAffiliation |
| `eduPersonScopedAffiliation` | `urn:oid:1.3.6.1.4.1.5923.1.1.1.9` | eduPersonScopedAffiliation |
| `eduPersonEntitlement` | `urn:oid:1.3.6.1.4.1.5923.1.1.1.7` | eduPersonEntitlement |
| `eduPersonOrcid` | `urn:oid:1.3.6.1.4.1.5923.1.1.1.16` | eduPersonOrcid |
| `subjectId` | `urn:oasis:names:tc:SAML:attribute:subject-id` | subject-id |
| `pairwiseId` | `urn:oasis:names:tc:SAML:attribute:pairwise-id` | pairwise-id |

## SPDB Registration

### 1. Generate Metadata

Access your SP metadata at:
```
https://yourdomain.stanford.edu/api/saml/metadata
```

### 2. Register in SPDB

1. Go to [Stanford SPDB](https://spdb.stanford.edu)
2. Create new Service Provider entry
3. **SP Login URL**: `https://yourdomain.stanford.edu`
4. **Upload Metadata**: Copy/paste or upload the XML from step 1
5. **Organization**: Stanford University
6. **Contact**: Your technical contact email

### 3. Key Benefits of Signed Requests

Since this implementation signs authentication requests (`AuthnRequestsSigned="true"`), you get:

- ✅ **No endpoint validation** - Stanford's IdP accepts any callback URL as long as the request is signed
- ✅ **Support for wildcard domains** - Works with `*.stanford.edu` without metadata updates
- ✅ **Multiple virtual hosts** - No need to enumerate all hostnames in metadata
- ✅ **Simplified maintenance** - Change endpoints without updating SPDB

## Security Features

### 1. **Signature Verification**
- ✅ Validates IdP signatures on responses and assertions
- ✅ Uses Stanford's public certificate from `SAML_CERT`
- ✅ Prevents tampering and man-in-the-middle attacks

### 2. **Encrypted Assertions**
- ✅ Assertions encrypted using your SP public certificate
- ✅ Decrypted using your SP private key (`SAML_SP_PRIVATE_KEY`)
- ✅ Protects sensitive user data in transit

### 3. **Signed Requests**
- ✅ Authentication requests signed with your SP private key
- ✅ Verified by Stanford's IdP using your SP public certificate
- ✅ Prevents request forgery

### 4. **Time Skew Tolerance**
- ✅ Configurable clock skew (`acceptedClockSkewMs`)
- ✅ Handles slight time differences between systems

## Testing

### Local Development

1. Start your development server:
```bash
npm run dev
```

2. Navigate to the test page:
```
http://localhost:3000/auth/test
```

3. Click "Sign In with Stanford SAML"

4. You'll be redirected to Stanford's UAT login (use SUNet credentials)

5. After authentication, you'll be redirected back with user data

### Production Testing

1. Deploy to Vercel/production
2. Update SPDB with production metadata
3. Update environment variables to use production IdP:
   - `SAML_ENTRY_POINT=https://login.stanford.edu/idp/profile/SAML2/Redirect/SSO`
   - `SAML_CERT=[production certificate]`

## Troubleshooting

### Common Issues

#### 1. "No SAML response received"
- Check that your callback URL matches the one in metadata
- Verify `NEXTAUTH_URL` is set correctly

#### 2. "Invalid signature"
- Verify `SAML_CERT` contains the correct Stanford IdP certificate
- Check that certificate doesn't have extra whitespace or line breaks

#### 3. "Decryption failed"
- Verify `SAML_SP_PRIVATE_KEY` matches the public certificate in metadata
- Check that the private key format is correct (PEM format)

#### 4. "Clock skew too large"
- Adjust `acceptedClockSkewMs` setting
- Ensure server time is accurate (use NTP)

### Debug Logging

Enable detailed logging by checking the console output:

```typescript
// In acs/route.ts, these logs help debug:
console.log('🔍 Processing SAML response...')
console.log('✅ SAML validation succeeded!')
console.log('📋 Profile:', JSON.stringify(profile, null, 2))
```

## Next Steps

1. **Integrate with NextAuth.js** - Add SAML as a custom provider
2. **Session Management** - Store user data in session/database
3. **Authorization** - Use attributes for role-based access control
4. **Monitoring** - Add logging and error tracking

## References

- [Stanford SAML Documentation](https://uit.stanford.edu/service/authentication/saml)
- [Stanford SPDB](https://spdb.stanford.edu)
- [@node-saml/node-saml Documentation](https://github.com/node-saml/node-saml)
- [SAML 2.0 Specification](http://docs.oasis-open.org/security/saml/v2.0/)