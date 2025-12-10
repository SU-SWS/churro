import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'

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

// Extend the session data interface
declare module 'iron-session' {
  interface IronSessionData {
    user?: SamlUser
  }
}

// Validate session secret is configured
if (!process.env.JWT_SECRET) {
  throw new Error(
    'JWT_SECRET environment variable is required for authentication. ' +
    'Generate one with: openssl rand -base64 32'
  )
}

const SESSION_COOKIE_NAME = 'churro-auth-token'

// Iron-session configuration
const sessionOptions = {
  password: process.env.JWT_SECRET,
  cookieName: SESSION_COOKIE_NAME,
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict' as const,
    maxAge: 60 * 60 * 24, // 24 hours in seconds
    path: '/',
  },
} as const

/**
 * Generate and save an encrypted session from user profile data
 */
export async function generateJWT(profile: SamlUser): Promise<string> {
  const cookieStore = await cookies()
  const session = await getIronSession<{ user: SamlUser }>(cookieStore, sessionOptions)

  session.user = profile
  await session.save()

  return SESSION_COOKIE_NAME // Return cookie name for compatibility
}

/**
 * Verify and decode an encrypted session
 */
export async function verifyJWT(token: string): Promise<SamlUser | null> {
  try {
    // For iron-session, we don't need the token parameter - get session from cookies
    const cookieStore = await cookies()
    const session = await getIronSession<{ user: SamlUser }>(cookieStore, sessionOptions)

    return session.user || null
  } catch (error) {
    console.error('Session verification failed:', error)
    return null
  }
}

/**
 * Get the session cookie name
 */
export function getJWTCookieName(): string {
  return SESSION_COOKIE_NAME
}

/**
 * Get secure cookie options for production/development
 *
 * Note: Using single HTTP-only encrypted cookie approach instead of dual cookie pattern
 * (encrypted session + readable auth status cookie) because:
 * - Application has low concurrent usage (~2-30 users max, typically <2 concurrent)
 * - Users unlikely to navigate frequently or load multiple pages per session
 * - Auth status checks are infrequent (mainly on initial page loads)
 * - ~50-100ms API overhead for auth checks is acceptable for this use case
 * - Simpler single-cookie implementation preferred over marginal performance gains
 * - Eliminates complexity of synchronizing two cookies during login/logout
 * - Iron-session provides encryption for enhanced security without added complexity
 */
export function getSecureCookieOptions() {
  // Iron-session handles cookie options internally via sessionOptions
  // This function maintained for API compatibility
  return sessionOptions.cookieOptions
}
