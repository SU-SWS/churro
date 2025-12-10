import { SignJWT, jwtVerify } from 'jose'

export interface SamlUser {
  id: string

  // Core Stanford Identity
  sunetId?: string
  email?: string
  eduPersonPrincipalName?: string

  // Name
  firstName?: string
  lastName?: string
  displayName?: string
  name?: string

  // Affiliations
  eduPersonAffiliation?: string
  eduPersonScopedAffiliation?: string
  suAffiliation?: string
  affiliation?: string

  // Other SAML Attributes
  eduPersonEntitlement?: string
  eduPersonOrcid?: string
  subjectId?: string
  pairwiseId?: string

  // Metadata
  authenticationTime?: string
  allAttributes?: Record<string, unknown>
}

// Validate JWT secret is configured
if (!process.env.JWT_SECRET) {
  throw new Error(
    'JWT_SECRET environment variable is required for authentication. ' +
    'Generate one with: openssl rand -base64 32'
  )
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET)

const JWT_COOKIE_NAME = 'churro-auth-token'

/**
 * Generate a JWT token from user profile data
 */
export async function generateJWT(profile: SamlUser): Promise<string> {
  const token = await new SignJWT({ ...profile })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h') // Token expires in 24 hours
    .sign(JWT_SECRET)

  return token
}

/**
 * Verify and decode a JWT token
 */
export async function verifyJWT(token: string): Promise<SamlUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as SamlUser
  } catch (error) {
    console.error('JWT verification failed:', error)
    return null
  }
}

/**
 * Get the JWT cookie name
 */
export function getJWTCookieName(): string {
  return JWT_COOKIE_NAME
}

/**
 * Get secure cookie options for production/development
 *
 * Note: Using single HTTP-only cookie approach instead of dual cookie pattern
 * (secure JWT + readable auth status cookie) because:
 * - Application has low concurrent usage (~2-30 users max, typically <2 concurrent)
 * - Users unlikely to navigate frequently or load multiple pages per session
 * - Auth status checks are infrequent (mainly on initial page loads)
 * - ~50-100ms API overhead for auth checks is acceptable for this use case
 * - Simpler single-cookie implementation preferred over marginal performance gains
 * - Eliminates complexity of synchronizing two cookies during login/logout
 */
export function getSecureCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production'

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict' as const,
    maxAge: 60 * 60 * 24, // 24 hours in seconds
    path: '/',
  }
}
