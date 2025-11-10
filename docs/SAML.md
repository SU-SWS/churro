# Stanford SAML SSO Implementation Guide

A complete SAML Single Sign-On (SSO) integration with Stanford University's Identity Provider, supporting encrypted assertions, signed authentication requests, and full attribute mapping.

## Overview

This implementation provides:
- ✅ **Complete SAML SSO flow** with Stanford Identity Provider
- ✅ **Signed authentication requests** for simplified endpoint management
- ✅ **Encrypted assertion decryption** using RSA-OAEP + AES-CBC
- ✅ **Signature verification** of SAML responses and assertions
- ✅ **JWT-based session management** with HTTP-only cookies
- ✅ **Full Stanford attribute mapping** (SUNet ID, email, affiliation, etc.)
- ✅ **Next.js App Router compatibility** with middleware protection
- ✅ **Production-ready security**

## Architecture

```mermaid
sequenceDiagram
    participant User
    participant App as Next.js App
    participant Middleware as Middleware
    participant SAML as SAML Routes
    participant Stanford as Stanford IdP

    User->>App: Access protected resource
    Middleware->>Middleware: Check JWT cookie
    Middleware->>SAML: No valid JWT, redirect to /api/saml/login
    SAML->>Stanford: Signed SAML AuthnRequest
    Stanford->>User: Login form
    User->>Stanford: Credentials
    Stanford->>SAML: Signed & Encrypted SAML Response
    SAML->>SAML: Verify signatures
    SAML->>SAML: Decrypt assertion
    SAML->>SAML: Extract user attributes
    SAML->>SAML: Generate JWT token (jose)
    SAML->>User: Set HTTP-only cookie & redirect
    User->>App: Access resource with JWT cookie
    Middleware->>Middleware: Verify JWT, add user headers
    Middleware->>App: Allow access
    App->>User: Protected content
```

## Prerequisites

- Next.js 13+ with App Router
- Node.js 18+
- SSL certificate for your domain
- Stanford SPDB registration

## Installation

### 1. Install Dependencies

```bash
npm install @node-saml/node-saml jose
```

**Note**: `jose` is used for JWT token generation and verification.

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

  // Enable signing of authentication requests
  privateKey: process.env.SAML_SP_PRIVATE_KEY,
  signatureAlgorithm: 'sha256',

  // Sign the metadata XML (recommended for production)
  signMetadata: true,

  // Validation settings
  acceptedClockSkewMs: 300000, // Allow up to 5 minutes clock skew
  wantAssertionsSigned: true,
  wantAuthnResponseSigned: true,

  // Security: Maximum age for SAML assertions (5 minutes)
  // Prevents old assertions from being replayed
  maxAssertionAgeMs: 300000,

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
import { generateJWT, getJWTCookieName, getSecureCookieOptions, type SamlUser } from '@/lib/jwt-auth'
import { cookies } from 'next/headers'

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

    const attributes = (profile.attributes || {}) as Record<string, unknown>

    // Helper function to get attribute value (handles both single values and arrays)
    const getAttr = (key: string): string | undefined => {
      const value = attributes[key]
      if (Array.isArray(value)) {
        return value[0] as string
      }
      return value as string | undefined
    }

    const user: SamlUser = {
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

    // Generate JWT token from the SAML profile
    const jwtToken = await generateJWT(user)

    // Set the JWT as a secure HTTP-only cookie
    const cookieStore = await cookies()
    cookieStore.set(getJWTCookieName(), jwtToken, getSecureCookieOptions())

    // Redirect to the application (no user data in URL - security best practice)
    const baseUrl = process.env.NEXTAUTH_URL || 'https://churro-test.stanford.edu'
    const redirectUrl = new URL('/auth/test', baseUrl)
    redirectUrl.searchParams.set('saml_success', 'true')

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

### 4. JWT Authentication (`/lib/jwt-auth.ts`)

```typescript
import { SignJWT, jwtVerify } from 'jose'

export interface SamlUser {
  id: string
  sunetId?: string
  email?: string
  name?: string
  // ... all other SAML attributes
}

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || 'default-secret-change-in-production'
)

const JWT_COOKIE_NAME = 'churro-auth-token'

export async function generateJWT(profile: SamlUser): Promise<string> {
  const token = await new SignJWT({ ...profile })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(JWT_SECRET)

  return token
}

export async function verifyJWT(token: string): Promise<SamlUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as SamlUser
  } catch (error) {
    console.error('JWT verification failed:', error)
    return null
  }
}

export function getJWTCookieName(): string {
  return JWT_COOKIE_NAME
}

export function getSecureCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production'

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  }
}
```

### 5. Middleware Protection (`/middleware.ts`)

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyJWT, getJWTCookieName } from '@/lib/jwt-auth'

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(getJWTCookieName())?.value

  // For protected routes, check authentication
  const isProtectedRoute = request.nextUrl.pathname.startsWith('/protected')

  if (isProtectedRoute) {
    if (!token) {
      return NextResponse.redirect(new URL('/api/saml/login', request.url))
    }

    const payload = await verifyJWT(token)
    if (!payload) {
      return NextResponse.redirect(new URL('/api/saml/login', request.url))
    }

    // Add user info to request headers for downstream use
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-id', payload.id)
    if (payload.sunetId) requestHeaders.set('x-user-sunetid', payload.sunetId)
    if (payload.email) requestHeaders.set('x-user-email', payload.email)

    return NextResponse.next({
      request: { headers: requestHeaders },
    })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico).*)'],
}
```

### 6. Metadata Generation (`/app/api/saml/metadata/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { saml } from '@/lib/saml-config'

export async function GET(request: NextRequest) {
  try {
    // Validate that required certificates are present
    if (!process.env.SAML_SP_CERT) {
      return NextResponse.json(
        { error: 'Server configuration error: SAML SP certificate not configured' },
        { status: 500 }
      )
    }

    if (!process.env.SAML_SP_PRIVATE_KEY) {
      return NextResponse.json(
        { error: 'Server configuration error: SAML SP private key not configured' },
        { status: 500 }
      )
    }

    const metadata = saml.generateServiceProviderMetadata(
      process.env.SAML_SP_CERT,
      process.env.SAML_SP_CERT
    )

    return new NextResponse(metadata, {
      headers: {
        'Content-Type': 'application/xml',
      },
    })
  } catch (error) {
    console.error('Error generating metadata:', error)
    return NextResponse.json(
      { error: 'Failed to generate metadata', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
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

### 4. **JWT Session Management**
- ✅ User data stored in signed JWT tokens (not accessible to client JavaScript)
- ✅ HTTP-only cookies prevent XSS attacks
- ✅ 24-hour token expiration
- ✅ Middleware-based route protection

### 5. **Replay Attack Prevention**
- ✅ `maxAssertionAgeMs` limits assertion validity to 5 minutes
- ✅ Signed metadata prevents tampering

### 6. **Time Skew Tolerance**
- ✅ Configurable clock skew (`acceptedClockSkewMs`: 5 minutes)
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

5. After authentication, you'll be redirected back with a JWT cookie set

### Authentication Status API

To check authentication status from client-side code:

```typescript
// Check authentication
const response = await fetch('/api/auth/status')
const { authenticated, user } = await response.json()

// Logout
window.location.href = '/api/auth/logout'
```

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
- Current setting allows 5 minutes of clock skew (`acceptedClockSkewMs: 300000`)
- Ensure server time is accurate (use NTP)

#### 5. "JWT verification failed"
- Verify `NEXTAUTH_SECRET` is set correctly
- Check that the JWT cookie hasn't been tampered with
- Ensure token hasn't expired (24-hour expiration)

### Debug Logging

Enable detailed logging by checking the console output:

```typescript
// In acs/route.ts, these logs help debug:
console.log('🔍 Processing SAML response...')
console.log('✅ SAML validation succeeded!')
console.log('📋 Profile:', JSON.stringify(profile, null, 2))
```

## Next Steps

1. **Protected Routes** - Use middleware to protect routes requiring authentication
2. **Session Management** - JWT tokens are automatically managed via HTTP-only cookies
3. **Authorization** - Use SAML attributes (eduPersonEntitlement, affiliation) for role-based access control
4. **Monitoring** - Add logging and error tracking for SAML and JWT operations

## References

- [Stanford SAML Documentation](https://uit.stanford.edu/service/authentication/saml)
- [Stanford SPDB](https://spdb.stanford.edu)
- [@node-saml/node-saml Documentation](https://github.com/node-saml/node-saml)
- [SAML 2.0 Specification](http://docs.oasis-open.org/security/saml/v2.0/)